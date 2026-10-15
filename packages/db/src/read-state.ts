import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";

/*
 * Lu et non lu, par participant (C15).
 *
 * Chaque personne d'un fil a son repère de lecture (`ConversationRead`) : chaque membre d'une entreprise a le sien. Un
 * message est non lu pour elle s'il vient de l'autre côté du fil (pour un membre, du freelance ; pour le freelance, de
 * l'entreprise) et qu'il est postérieur à son repère. Ce qu'écrit un collègue n'est pas « à lire ». Le repère prend
 * la date du dernier message du fil, lue dans la base au moment de la lecture : jamais l'horloge de l'application, qui
 * peut différer de celle qui date les messages. Il ne recule jamais, même si deux onglets lisent dans le désordre.
 *
 * L'accès est dans chaque requête : on ne pose un repère, et on ne compte, que dans les fils dont on est partie.
 */

const Uuid = z.uuid();

/** Au-delà, l'en-tête affiche « 99+ » : compter plus loin ne coûterait que du temps de base. */
export const UNREAD_CAP = 100;

const CountRow = z.object({ conversationId: z.string(), unread: z.number() });
const TotalRow = z.object({ total: z.number() });

export interface ReadState {
  /** Pose le repère de l'acteur au dernier message du fil ; `false` s'il n'en est pas partie ou s'il était déjà à jour. */
  markRead(actor: Actor, conversationId: string): Promise<boolean>;
  /** Nombre de messages non lus par fil de l'acteur ; les fils sans non-lu n'y sont pas. */
  unreadByConversation(actor: Actor): Promise<ReadonlyMap<string, number>>;
  /** Nombre total de messages non lus de l'acteur, plafonné à `UNREAD_CAP`. */
  unreadTotal(actor: Actor): Promise<number>;
  /** Jusqu'où l'autre côté du fil a lu ; `null` s'il n'a rien lu, ou si l'acteur n'est pas partie au fil. */
  otherSideReadAt(actor: Actor, conversationId: string): Promise<Date | null>;
}

const participant = (userId: string): Prisma.ConversationWhereInput => ({
  OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }],
});

export const readState = (db: Db): ReadState => ({
  async markRead(actor, conversationId) {
    if (!Uuid.safeParse(conversationId).success || !Uuid.safeParse(actor.userId).success) return false;
    const moved = await db.$executeRaw`
      INSERT INTO "ConversationRead" ("conversationId", "userId", "readAt")
      SELECT c."id", ${actor.userId}::uuid,
             COALESCE((SELECT max(m."createdAt") FROM "Message" m WHERE m."conversationId" = c."id"), c."createdAt")
      FROM "Conversation" c
      WHERE c."id" = ${conversationId}::uuid
        AND (EXISTS (SELECT 1 FROM "FreelanceProfile" p WHERE p."id" = c."profileId" AND p."userId" = ${actor.userId}::uuid)
          OR EXISTS (SELECT 1 FROM "Membership" mb WHERE mb."organisationId" = c."organisationId" AND mb."userId" = ${actor.userId}::uuid))
      ON CONFLICT ("conversationId", "userId") DO UPDATE SET "readAt" = EXCLUDED."readAt"
      WHERE "ConversationRead"."readAt" < EXCLUDED."readAt"`;
    // Les notifications de ce fil sont lues avec lui : la cloche ne rappelle pas un message déjà lu.
    await db.$executeRaw`
      UPDATE "AppNotification" SET "readAt" = GREATEST(now(), "createdAt")
      WHERE "userId" = ${actor.userId}::uuid AND "readAt" IS NULL
        AND "kind" IN ('message_received', 'contact_received')
        AND "payload"->>'conversationId' = ${conversationId}`;
    return moved > 0;
  },

  async unreadByConversation(actor) {
    if (!Uuid.safeParse(actor.userId).success) return new Map();
    const rows = await db.$queryRaw<unknown[]>`
      SELECT m."conversationId"::text AS "conversationId", count(*)::int AS "unread"
      FROM "Message" m
      JOIN "Conversation" c ON c."id" = m."conversationId"
      JOIN "FreelanceProfile" p ON p."id" = c."profileId"
      LEFT JOIN "ConversationRead" r ON r."conversationId" = m."conversationId" AND r."userId" = ${actor.userId}::uuid
      WHERE (
          -- Le freelance : tout ce que l'entreprise a écrit.
          (p."userId" = ${actor.userId}::uuid AND m."senderUserId" IS DISTINCT FROM ${actor.userId}::uuid)
          -- Un membre : ce que le freelance a écrit, pas les messages de ses collègues.
          OR (m."senderUserId" = p."userId" AND EXISTS (SELECT 1 FROM "Membership" mb WHERE mb."organisationId" = c."organisationId" AND mb."userId" = ${actor.userId}::uuid))
        )
        AND (r."readAt" IS NULL OR m."createdAt" > r."readAt")
      GROUP BY m."conversationId"`;
    return new Map(rows.map((raw) => CountRow.parse(raw)).map((row) => [row.conversationId, row.unread] as const));
  },

  async unreadTotal(actor) {
    if (!Uuid.safeParse(actor.userId).success) return 0;
    const rows = await db.$queryRaw<unknown[]>`
      SELECT count(*)::int AS "total" FROM (
        SELECT 1
        FROM "Message" m
        JOIN "Conversation" c ON c."id" = m."conversationId"
        JOIN "FreelanceProfile" p ON p."id" = c."profileId"
        LEFT JOIN "ConversationRead" r ON r."conversationId" = m."conversationId" AND r."userId" = ${actor.userId}::uuid
        WHERE (
            (p."userId" = ${actor.userId}::uuid AND m."senderUserId" IS DISTINCT FROM ${actor.userId}::uuid)
            OR (m."senderUserId" = p."userId" AND EXISTS (SELECT 1 FROM "Membership" mb WHERE mb."organisationId" = c."organisationId" AND mb."userId" = ${actor.userId}::uuid))
          )
          AND (r."readAt" IS NULL OR m."createdAt" > r."readAt")
        LIMIT ${UNREAD_CAP}
      ) unread`;
    return TotalRow.parse(rows[0] ?? { total: 0 }).total;
  },

  async otherSideReadAt(actor, conversationId) {
    if (!Uuid.safeParse(conversationId).success) return null;
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, ...participant(actor.userId) },
      select: { organisationId: true, profile: { select: { userId: true } } },
    });
    if (conversation === null) return null;
    // L'autre côté d'un membre d'entreprise est le freelance ; celui du freelance, n'importe quel membre de l'entreprise.
    // Un collègue qui lit le fil n'est pas « l'autre côté » : sa lecture ne dit pas que le freelance a lu.
    const others: Prisma.ConversationReadWhereInput =
      conversation.profile.userId === actor.userId
        ? { conversationId, user: { memberships: { some: { organisationId: conversation.organisationId } } } }
        : { conversationId, userId: conversation.profile.userId };
    const { _max } = await db.conversationRead.aggregate({ where: others, _max: { readAt: true } });
    return _max.readAt;
  },
});
