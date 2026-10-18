import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { AppNotificationKind, NotificationKind } from "./generated/enums";
import type { Actor } from "./messaging";
import { queuePushes } from "./push-enqueue";

/*
 * Centre de notifications de l'application (C15).
 *
 * Une notification de l'application est écrite dans la même transaction que l'événement, à côté de l'e-mail : la
 * personne la voit même si elle a coupé l'e-mail de ce type, et même si aucun e-mail ne part. Comme l'e-mail, elle ne
 * porte que des références (identifiants, statut) : jamais le texte d'un message.
 *
 * Un fil ne fait qu'une notification non lue à la fois : dix messages d'affilée ne font pas sonner dix fois la cloche.
 */

export const APP_NOTIFICATION_KINDS = [
  "contact_received",
  "message_received",
  "application_received",
  "application_read",
  "application_status",
  "mission_invitation",
  "mission_confirmation",
  "contract_update",
  "measurement_done",
  "post_comment",
  "post_reaction",
  "post_share",
  "new_follower",
] as const satisfies readonly AppNotificationKind[];

/** Les e-mails qui ont leur pendant dans l'application ; les autres (alertes, vigilance, entreprises suivies) restent par e-mail. */
const FROM_EMAIL: Readonly<Partial<Record<NotificationKind, AppNotificationKind>>> = {
  contact_received: "contact_received",
  message_received: "message_received",
  application_received: "application_received",
  application_read: "application_read",
  application_status: "application_status",
  mission_invitation: "mission_invitation",
  mission_confirmation: "mission_confirmation",
  contract_update: "contract_update",
};

export const appKindOfEmail = (kind: NotificationKind): AppNotificationKind | null => FROM_EMAIL[kind] ?? null;

/** Ce qui peut être gardé d'une charge : des références et des codes courts, rien d'autre. */
const KEPT_KEYS = ["conversationId", "applicationId", "missionId", "invitationId", "contractId", "requestId", "status", "month", "postId", "commentId"] as const;
const KEPT_VALUE = /^[A-Za-z0-9_-]{1,64}$/;

export type AppNotificationPayload = Readonly<Partial<Record<(typeof KEPT_KEYS)[number], string>>>;

const sanitise = (payload: Readonly<Record<string, unknown>>): AppNotificationPayload =>
  Object.fromEntries(KEPT_KEYS.flatMap((key) => {
    const value = payload[key];
    return typeof value === "string" && KEPT_VALUE.test(value) ? [[key, value]] : [];
  }));

const PayloadSchema = z.record(z.string(), z.unknown());

/** La charge d'une notification relue en base, réduite aux références permises (aussi pour la notification poussée). */
export const appNotificationPayload = (raw: unknown): AppNotificationPayload => {
  const parsed = PayloadSchema.safeParse(raw);
  return parsed.success ? sanitise(parsed.data) : {};
};

/**
 * Les notifications d'un même objet se regroupent : une seule non lue par fil, par publication (réactions, commentaires,
 * partages, C22) et par personne ; les nouveaux abonnés font une seule notification non lue à la fois (`null`).
 */
const COLLAPSED: Readonly<Partial<Record<AppNotificationKind, "conversationId" | "postId" | null>>> = {
  contact_received: "conversationId",
  message_received: "conversationId",
  post_comment: "postId",
  post_reaction: "postId",
  post_share: "postId",
  new_follower: null,
};

export interface AppNotificationView {
  readonly id: string;
  readonly kind: AppNotificationKind;
  readonly payload: AppNotificationPayload;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export const APP_NOTIFICATIONS_PAGE = 50;

/**
 * Écrit une notification pour chaque destinataire, dans la transaction de l'événement, et met en file sa version
 * poussée vers les appareils abonnés (C20). Rend le nombre écrit.
 */
export const recordAppNotifications = async (tx: Prisma.TransactionClient, userIds: readonly string[], kind: AppNotificationKind, payload: Readonly<Record<string, unknown>>): Promise<number> => {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  const kept = sanitise(payload);
  let recipients = unique;
  const key = COLLAPSED[kind];
  const value = key === undefined || key === null ? undefined : kept[key];
  if (key === null || (key !== undefined && value !== undefined)) {
    const waiting = await tx.appNotification.findMany({
      where: { userId: { in: unique }, kind, readAt: null, ...(key === null || value === undefined ? {} : { payload: { path: [key], equals: value } }) },
      select: { userId: true },
    });
    const already = new Set(waiting.map((w) => w.userId));
    recipients = unique.filter((id) => !already.has(id));
  }
  if (recipients.length === 0) return 0;
  const created = await tx.appNotification.createManyAndReturn({ data: recipients.map((userId) => ({ userId, kind, payload: kept as Prisma.InputJsonObject })), select: { id: true } });
  await queuePushes(tx, created.map((row) => row.id));
  return created.length;
};

export interface AppNotifications {
  /** Les dernières notifications de l'acteur, la plus récente d'abord. */
  list(actor: Actor, limit?: number): Promise<readonly AppNotificationView[]>;
  /** Une notification de l'acteur ; `null` pour celle d'un autre, comme pour une inconnue. */
  get(actor: Actor, id: string): Promise<AppNotificationView | null>;
  unreadCount(actor: Actor): Promise<number>;
  /** Marque lue une notification de l'acteur ; `false` si elle n'est pas à lui ou déjà lue. */
  markRead(actor: Actor, id: string): Promise<boolean>;
  /** Marque lues toutes les notifications de l'acteur ; rend leur nombre. */
  markAllRead(actor: Actor): Promise<number>;
}

const Uuid = z.uuid();
const SELECT = { id: true, kind: true, payload: true, readAt: true, createdAt: true } as const;

const view = (row: { id: string; kind: AppNotificationKind; payload: unknown; readAt: Date | null; createdAt: Date }): AppNotificationView => ({
  id: row.id,
  kind: row.kind,
  payload: appNotificationPayload(row.payload),
  readAt: row.readAt,
  createdAt: row.createdAt,
});

export const appNotifications = (db: Db): AppNotifications => ({
  async list(actor, limit = APP_NOTIFICATIONS_PAGE) {
    const take = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await db.appNotification.findMany({ where: { userId: actor.userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, select: SELECT });
    return rows.map(view);
  },

  async get(actor, id) {
    if (!Uuid.safeParse(id).success) return null;
    const row = await db.appNotification.findFirst({ where: { id, userId: actor.userId }, select: SELECT });
    return row === null ? null : view(row);
  },

  unreadCount(actor) {
    return db.appNotification.count({ where: { userId: actor.userId, readAt: null } });
  },

  async markRead(actor, id) {
    if (!Uuid.safeParse(id).success || !Uuid.safeParse(actor.userId).success) return false;
    // L'horloge de la base, comme pour `createdAt` : une lecture n'est jamais datée d'avant la notification.
    const count = await db.$executeRaw`
      UPDATE "AppNotification" SET "readAt" = GREATEST(now(), "createdAt")
      WHERE "id" = ${id}::uuid AND "userId" = ${actor.userId}::uuid AND "readAt" IS NULL`;
    return count === 1;
  },

  async markAllRead(actor) {
    if (!Uuid.safeParse(actor.userId).success) return 0;
    return db.$executeRaw`
      UPDATE "AppNotification" SET "readAt" = GREATEST(now(), "createdAt")
      WHERE "userId" = ${actor.userId}::uuid AND "readAt" IS NULL`;
  },
});
