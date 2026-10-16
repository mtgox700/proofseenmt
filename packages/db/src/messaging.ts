import { z } from "zod";
import type { Db } from "./client";
import { containsContact } from "./contact-detection";
import { flagFirstContact } from "./contact-review";
import { LISTED_PROFILE } from "./public-visibility";
import { isUniqueViolation } from "./errors";
import { notifications } from "./notifications";
import type { Prisma } from "./generated/client";
import type { ConversationStatus } from "./generated/enums";

/*
 * Messagerie entre une entreprise et un freelance. Le contact passe par la plateforme, et c'est le freelance qui
 * l'accepte :
 *  - une entreprise prend contact avec un profil publié, par un premier message ;
 *  - le freelance accepte ou décline ; tant qu'il n'a pas accepté, l'entreprise ne peut plus écrire ;
 *  - un fil décliné est fermé pour les deux ;
 *  - un fil né d'une candidature est accepté d'emblée, puisque c'est le freelance qui a écrit le premier.
 * Ces règles sont aussi dans la base (déclencheurs) : ce module les applique pour répondre clairement, la base pour
 * qu'aucun autre chemin ne les contourne.
 *
 * Le contrôle d'accès est **dans la requête** : une conversation n'est lue que si « l'acteur en est partie » fait
 * partie du `where`. Celle d'un autre est rendue absente, jamais interdite : « interdit » confirmerait qu'elle existe.
 */

export { containsContact } from "./contact-detection";

export interface Actor {
  readonly userId: string;
}

export interface ConversationSummary {
  readonly id: string;
  readonly organisationId: string;
  readonly profileId: string;
  readonly applicationId: string | null;
  readonly direct: boolean;
  readonly status: ConversationStatus;
  readonly lastMessageAt: Date;
}

/** Une pièce jointe telle que les écrans la montrent : son identifiant et son type, jamais le nom du fichier envoyé. */
export interface MessageAttachment {
  readonly id: string;
  readonly contentType: string;
}

export interface MessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly senderUserId: string | null;
  readonly body: string;
  readonly containsContact: boolean;
  readonly createdAt: Date;
  readonly attachments: readonly MessageAttachment[];
}

/** Pièces jointes déjà déposées par l'acteur, à rattacher au message ; et si leur contenu porte des coordonnées. */
export interface PostAttachments {
  readonly ids: readonly string[];
  readonly containContact: boolean;
}

/** Trois pièces jointes au plus par message (C15) ; la base le vérifie aussi. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

export interface Page<T> {
  readonly items: readonly T[];
  /** À repasser pour obtenir la suite ; `null` quand il n'y en a plus. */
  readonly next: string | null;
}

export type ContactResult =
  | { readonly kind: "opened"; readonly conversation: ConversationSummary }
  /** Un fil existait déjà : le message n'est pas envoyé, l'entreprise est renvoyée vers ce fil. */
  | { readonly kind: "existing"; readonly conversation: ConversationSummary }
  /**
   * Le premier message contient des coordonnées. Il est refusé, pas seulement signalé : il arrive avant que le freelance
   * ait accepté le contact, et le contact passe par la plateforme.
   */
  | { readonly kind: "contact_details" }
  /** Trop de prises de contact de cette entreprise aujourd'hui, ou trop de demandes en attente chez ce freelance. */
  | { readonly kind: "limit" }
  | { readonly kind: "absent" };

export type PostResult =
  | { readonly kind: "sent"; readonly message: MessageRecord }
  | { readonly kind: "absent" }
  /** L'entreprise a déjà écrit et attend l'accord du freelance. */
  | { readonly kind: "waiting" }
  /** Décliné par le freelance, ou fermé par l'une des parties : plus personne n'écrit. */
  | { readonly kind: "closed" }
  /** Des coordonnées avant qu'un contrat soit signé : le contact resterait hors plateforme. */
  | { readonly kind: "contact_details" }
  /** Pièces jointes refusées : trop nombreuses, pas à l'acteur, déjà envoyées, ou fil pas encore accepté. */
  | { readonly kind: "attachments" };

/** Prises de contact par entreprise et par jour : au-delà, ce n'est plus du recrutement, c'est de la prospection en masse. */
export const MAX_CONTACTS_PER_ORGANISATION_PER_DAY = 50;
/** Demandes en attente chez un même freelance : au-delà, sa boîte devient inutilisable. */
export const MAX_PENDING_PER_PROFILE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PageRequest {
  readonly cursor?: string | undefined;
  readonly limit?: number;
}

export interface Messaging {
  /** Un membre d'une entreprise prend contact avec un profil publié. `absent` pour tout autre acteur ou profil. */
  contact(actor: Actor, organisationId: string, profileId: string, body: string): Promise<ContactResult>;
  /** Le freelance accepte ou décline un contact en attente. `false` si ce n'est pas à lui d'en décider. */
  decide(actor: Actor, conversationId: string, decision: "accepted" | "declined", now: Date): Promise<boolean>;
  /** L'une ou l'autre partie ferme un fil accepté. Définitif. */
  close(actor: Actor, conversationId: string): Promise<boolean>;
  /** Les fils de l'acteur, le plus récemment actif d'abord. */
  listConversations(actor: Actor, page?: PageRequest): Promise<Page<ConversationSummary>>;
  /** Les messages d'un fil, du plus récent au plus ancien. `null` si le fil n'existe pas ou n'est pas le sien. */
  listMessages(actor: Actor, conversationId: string, page?: PageRequest): Promise<Page<MessageRecord> | null>;
  post(actor: Actor, conversationId: string, body: string, attachments?: PostAttachments): Promise<PostResult>;
  /**
   * Vrai si l'acteur peut joindre des fichiers à ce fil : il en est partie et le contact est accepté. Une seule requête
   * légère, posée avant de lire le moindre fichier (revue de sécurité vague 3, M3) ; `post` revérifie au moment d'écrire.
   */
  canAttach(actor: Actor, conversationId: string): Promise<boolean>;
}

const DEFAULT_PAGE = 30;
const MAX_PAGE = 100;

const Uuid = z.uuid();
export const MessageBodySchema = z.string().trim().min(1).max(10_000);
const Limit = z.number().int().min(1).max(MAX_PAGE).default(DEFAULT_PAGE);

const participant = (userId: string): Prisma.ConversationWhereInput => ({
  OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }],
});

const SUMMARY = { id: true, organisationId: true, profileId: true, applicationId: true, direct: true, status: true, lastMessageAt: true } as const;
const MESSAGE = {
  id: true,
  conversationId: true,
  senderUserId: true,
  body: true,
  containsContact: true,
  createdAt: true,
  attachments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, contentType: true } },
} satisfies Prisma.MessageSelect;

/** Levée dans la transaction d'envoi : une pièce jointe ne se rattache pas, le message n'est pas écrit. */
class AttachmentRefused extends Error {
  constructor() {
    super("pièces jointes refusées");
    this.name = "AttachmentRefused";
  }
}

/*
 * Curseur opaque : la date et l'identifiant du dernier élément rendu. Les deux, parce que deux fils peuvent avoir la même
 * date à la milliseconde, et qu'une pagination sur la date seule en sauterait un ou le rendrait deux fois.
 */
const CursorSchema = z.object({ at: z.iso.datetime(), id: Uuid });

const encodeCursor = (at: Date, id: string): string => Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString("base64url");

export class InvalidCursorError extends Error {
  constructor() {
    super("curseur de pagination invalide");
    this.name = "InvalidCursorError";
  }
}

const decodeCursor = (cursor: string | undefined): { at: Date; id: string } | null => {
  if (cursor === undefined) return null;
  try {
    const parsed = CursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return { at: new Date(parsed.at), id: parsed.id };
  } catch {
    throw new InvalidCursorError();
  }
};

const pageOf = <T>(rows: readonly T[], limit: number, key: (row: T) => { at: Date; id: string }): Page<T> => {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, next: rows.length > limit && last !== undefined ? encodeCursor(key(last).at, key(last).id) : null };
};

const findDirect = (db: Db, organisationId: string, profileId: string) =>
  db.conversation.findFirst({ where: { organisationId, profileId, direct: true }, select: SUMMARY });

/** Pourquoi l'acteur ne peut pas écrire dans un fil de ce statut ; `null` s'il le peut. */
const postBlock = (status: ConversationStatus, isFreelance: boolean): PostResult | null => {
  if (status === "declined" || status === "closed") return { kind: "closed" };
  // Avant l'accord, seul le freelance répond ; l'entreprise a déjà écrit son premier message en prenant contact.
  if (status === "pending" && !isFreelance) return { kind: "waiting" };
  return null;
};

export const messaging = (db: Db): Messaging => ({
  async contact(actor, organisationId, profileId, body) {
    if (!Uuid.safeParse(organisationId).success || !Uuid.safeParse(profileId).success) return { kind: "absent" };
    const text = MessageBodySchema.parse(body);
    const [member, profile] = await Promise.all([
      db.membership.findUnique({ where: { organisationId_userId: { organisationId, userId: actor.userId } }, select: { userId: true } }),
      db.freelanceProfile.findFirst({ where: { id: profileId, ...LISTED_PROFILE }, select: { visibility: true, userId: true } }),
    ]);
    // Une entreprise ne contacte pas un profil privé : il n'est pas censé exister pour elle. Et personne ne se contacte
    // soi-même au nom de son entreprise.
    if (member === null || profile === null || profile.visibility === "private" || profile.userId === actor.userId) return { kind: "absent" };

    const existing = await findDirect(db, organisationId, profileId);
    if (existing !== null) return { kind: "existing", conversation: existing };
    if (containsContact(text)) return { kind: "contact_details" };

    const since = new Date(Date.now() - DAY_MS);
    const [sentToday, pendingForProfile] = await Promise.all([
      db.conversation.count({ where: { organisationId, direct: true, createdAt: { gte: since } } }),
      db.conversation.count({ where: { profileId, status: "pending" } }),
    ]);
    if (sentToday >= MAX_CONTACTS_PER_ORGANISATION_PER_DAY || pendingForProfile >= MAX_PENDING_PER_PROFILE) return { kind: "limit" };

    try {
      const conversation = await db.$transaction(async (tx) => {
        const created = await tx.conversation.create({ data: { organisationId, profileId, direct: true }, select: SUMMARY });
        await tx.message.create({ data: { conversationId: created.id, senderUserId: actor.userId, body: text, containsContact: false } });
        await notifications(db).enqueue(tx, [profile.userId], "contact_received", { conversationId: created.id });
        // Premier contact d'une entreprise récente : signalé aux opérateurs, jamais retenu (C19).
        await flagFirstContact(tx, created.id, actor.userId, new Date());
        return created;
      });
      return { kind: "opened", conversation };
    } catch (error) {
      // Deux clics simultanés : l'index unique a laissé passer le premier, on renvoie vers celui-là.
      if (!isUniqueViolation(error)) throw error;
      const winner = await findDirect(db, organisationId, profileId);
      return winner === null ? { kind: "absent" } : { kind: "existing", conversation: winner };
    }
  },

  async decide(actor, conversationId, decision, now) {
    if (!Uuid.safeParse(conversationId).success) return false;
    // La condition porte tout : bon fil, freelance du profil, encore en attente. Une seule instruction, donc deux
    // décisions simultanées ne peuvent pas se succéder.
    const { count } = await db.conversation.updateMany({
      where: { id: conversationId, status: "pending", profile: { userId: actor.userId } },
      data: { status: decision, decidedAt: now },
    });
    return count === 1;
  },

  async close(actor, conversationId) {
    if (!Uuid.safeParse(conversationId).success) return false;
    const { count } = await db.conversation.updateMany({
      where: { id: conversationId, status: "accepted", ...participant(actor.userId) },
      data: { status: "closed" },
    });
    return count === 1;
  },

  async listConversations(actor, page = {}) {
    const limit = Limit.parse(page.limit);
    const after = decodeCursor(page.cursor);
    const rows = await db.conversation.findMany({
      where: {
        AND: [
          participant(actor.userId),
          ...(after === null ? [] : [{ OR: [{ lastMessageAt: { lt: after.at } }, { lastMessageAt: after.at, id: { lt: after.id } }] }]),
        ],
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: SUMMARY,
    });
    return pageOf(rows, limit, (row) => ({ at: row.lastMessageAt, id: row.id }));
  },

  async listMessages(actor, conversationId, page = {}) {
    if (!Uuid.safeParse(conversationId).success) return null;
    const visible = await db.conversation.count({ where: { id: conversationId, ...participant(actor.userId) } });
    if (visible === 0) return null;
    const limit = Limit.parse(page.limit);
    const before = decodeCursor(page.cursor);
    const rows = await db.message.findMany({
      where: {
        conversationId,
        ...(before === null ? {} : { OR: [{ createdAt: { lt: before.at } }, { createdAt: before.at, id: { lt: before.id } }] }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: MESSAGE,
    });
    return pageOf(rows, limit, (row) => ({ at: row.createdAt, id: row.id }));
  },

  async canAttach(actor, conversationId) {
    if (!Uuid.safeParse(conversationId).success) return false;
    return (await db.conversation.count({ where: { id: conversationId, status: "accepted", ...participant(actor.userId) } })) === 1;
  },

  async post(actor, conversationId, body, attachments) {
    if (!Uuid.safeParse(conversationId).success) return { kind: "absent" };
    const text = MessageBodySchema.parse(body);
    const fileIds = [...new Set(attachments?.ids ?? [])];
    if (fileIds.length > MAX_ATTACHMENTS_PER_MESSAGE || fileIds.some((id) => !Uuid.safeParse(id).success)) return { kind: "attachments" };
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, ...participant(actor.userId) },
      select: { status: true, organisationId: true, profileId: true, profile: { select: { userId: true } }, organisation: { select: { members: { select: { userId: true } } } } },
    });
    if (conversation === null) return { kind: "absent" };
    const fromFreelance = conversation.profile.userId === actor.userId;
    const blocked = postBlock(conversation.status, fromFreelance);
    if (blocked !== null) return blocked;
    // Des fichiers seulement entre parties qui ont accepté l'échange : pas de document joint à une prise de contact.
    if (fileIds.length > 0 && conversation.status !== "accepted") return { kind: "attachments" };
    // Comme sur Malt, les coordonnées s'échangent une fois la mission payée sur la plateforme, pas avant : un contrat
    // signé ne coûte rien, deux comptes complices en signeraient un pour s'échanger leurs numéros. Une fois l'argent
    // engagé, elles passent et restent signalées.
    const flagged = containsContact(text) || (fileIds.length > 0 && attachments?.containContact === true);
    if (flagged) {
      const signed = await db.contract.count({
        where: {
          organisationId: conversation.organisationId,
          profileId: conversation.profileId,
          payments: { some: { status: { in: ["held", "releasing", "released"] } } },
        },
      });
      if (signed === 0) return { kind: "contact_details" };
    }
    const recipients = fromFreelance ? conversation.organisation.members.map((m) => m.userId) : [conversation.profile.userId];
    try {
      const message = await db.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: { conversationId, senderUserId: actor.userId, body: text, containsContact: flagged },
          select: { id: true },
        });
        if (fileIds.length > 0) {
          // Seulement des pièces jointes de l'acteur, encore libres : celles d'un autre ou déjà envoyées font échouer l'envoi.
          const { count } = await tx.storedFile.updateMany({
            where: { id: { in: fileIds }, ownerId: actor.userId, kind: "message_attachment", messageId: null },
            data: { messageId: created.id },
          });
          if (count !== fileIds.length) throw new AttachmentRefused();
        }
        // Un seul « nouveau message » en attente par fil et par destinataire : dix messages d'affilée font un e-mail.
        const waiting = await tx.notification.findMany({
          where: { userId: { in: recipients }, kind: "message_received", sentAt: null, payload: { path: ["conversationId"], equals: conversationId } },
          select: { userId: true },
        });
        const already = new Set(waiting.map((w) => w.userId));
        await notifications(db).enqueue(tx, recipients.filter((id) => id !== actor.userId && !already.has(id)), "message_received", { conversationId });
        return tx.message.findUniqueOrThrow({ where: { id: created.id }, select: MESSAGE });
      });
      return { kind: "sent", message };
    } catch (error) {
      if (error instanceof AttachmentRefused) return { kind: "attachments" };
      // Le fil a été décliné ou fermé entre la lecture et l'écriture : la base a refusé, on dit pourquoi.
      const now = await db.conversation.findUnique({ where: { id: conversationId }, select: { status: true } });
      const reason = now === null ? null : postBlock(now.status, conversation.profile.userId === actor.userId);
      if (reason !== null) return reason;
      throw error;
    }
  },
});
