import { z } from "zod";
import type { Db } from "./client";
import type { ConversationStatus } from "./generated/enums";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { readState } from "./read-state";

/*
 * Ce que les écrans montrent d'un fil : de quel côté est la personne, qui est en face, à propos de quelle mission, et le
 * dernier message. Le freelance est désigné par sa référence publique et son titre, jamais par son nom : son identité
 * légale n'apparaît qu'au contrat. L'entreprise est désignée par son nom, public sur ses missions.
 */

const Uuid = z.uuid();
const PREVIEW_LENGTH = 140;
export const INBOX_LIMIT = 50;

export type Side = "company" | "freelance";

export type Counterpart =
  | { readonly kind: "organisation"; readonly name: string }
  | { readonly kind: "profile"; readonly reference: string; readonly headline: string | null };

export interface InboxThread {
  readonly id: string;
  readonly side: Side;
  readonly status: ConversationStatus;
  readonly counterpart: Counterpart;
  readonly missionTitle: string | null;
  readonly lastMessageAt: Date;
  readonly lastMessage: { readonly preview: string; readonly mine: boolean } | null;
  /** Messages de l'autre côté que l'acteur n'a pas encore lus dans ce fil (C15). */
  readonly unread: number;
}

export interface ThreadHeader extends Omit<InboxThread, "lastMessage" | "unread"> {
  readonly organisationId: string;
  readonly profileId: string;
  /** Le freelance décide d'un contact en attente. */
  readonly canDecide: boolean;
  /** Écrire n'est possible qu'une fois le contact accepté. */
  readonly canPost: boolean;
}

const participant = (userId: string): Prisma.ConversationWhereInput => ({
  OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }],
});

const SELECT = {
  id: true,
  organisationId: true,
  profileId: true,
  status: true,
  lastMessageAt: true,
  organisation: { select: { name: true } },
  profile: { select: { userId: true, reference: true, headline: true } },
  application: { select: { jobPost: { select: { title: true } } } },
} as const;

type Row = Prisma.ConversationGetPayload<{ select: typeof SELECT }>;

const preview = (body: string): string => (body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH - 1)}…` : body);

const describe = (row: Row, userId: string): Omit<InboxThread, "lastMessage" | "unread"> => {
  const side: Side = row.profile.userId === userId ? "freelance" : "company";
  return {
    id: row.id,
    side,
    status: row.status,
    counterpart: side === "freelance" ? { kind: "organisation", name: row.organisation.name } : { kind: "profile", reference: row.profile.reference, headline: row.profile.headline },
    missionTitle: row.application?.jobPost.title ?? null,
    lastMessageAt: row.lastMessageAt,
  };
};

export const inbox = (db: Db) => ({
  /** Les fils de l'acteur, le plus récemment actif d'abord. */
  async threads(actor: Actor): Promise<readonly InboxThread[]> {
    const [rows, unread] = await Promise.all([
      db.conversation.findMany({
        where: participant(actor.userId),
        orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
        take: INBOX_LIMIT,
        select: { ...SELECT, messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { body: true, senderUserId: true } } },
      }),
      readState(db).unreadByConversation(actor),
    ]);
    return rows.map((row) => {
      const last = row.messages[0];
      return {
        ...describe(row, actor.userId),
        lastMessage: last === undefined ? null : { preview: preview(last.body), mine: last.senderUserId === actor.userId },
        unread: unread.get(row.id) ?? 0,
      };
    });
  },

  /** Un profil publié, par sa référence publique, pour lui écrire ; `null` s'il est privé ou inconnu. */
  async contactTarget(reference: string): Promise<{ readonly profileId: string; readonly reference: string; readonly headline: string | null } | null> {
    if (!/^FR-[A-Z0-9]{5,8}$/.test(reference)) return null;
    const row = await db.freelanceProfile.findFirst({ where: { reference, visibility: { not: "private" } }, select: { id: true, reference: true, headline: true } });
    return row === null ? null : { profileId: row.id, reference: row.reference, headline: row.headline };
  },

  /** L'en-tête d'un fil, pour ses parties ; `null` pour les autres. */
  async thread(actor: Actor, conversationId: string): Promise<ThreadHeader | null> {
    if (!Uuid.safeParse(conversationId).success) return null;
    const row = await db.conversation.findFirst({ where: { id: conversationId, ...participant(actor.userId) }, select: SELECT });
    if (row === null) return null;
    const head = describe(row, actor.userId);
    return {
      ...head,
      organisationId: row.organisationId,
      profileId: row.profileId,
      canDecide: head.side === "freelance" && row.status === "pending",
      canPost: row.status === "accepted",
    };
  },
});

export type Inbox = ReturnType<typeof inbox>;
