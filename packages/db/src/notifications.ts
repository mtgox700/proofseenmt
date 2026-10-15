import { z } from "zod";
import { appKindOfEmail, recordAppNotifications } from "./app-notifications";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { NotificationKind } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * File d'envoi des notifications par e-mail.
 *
 * L'événement (une candidature, un message) et sa notification sont écrits dans la même transaction : si l'envoi
 * échoue, la notification reste en file et sera réessayée, au lieu d'être perdue. L'envoi lui-même est fait plus tard
 * par un processus qui prend des lots en charge.
 *
 * Plusieurs processus peuvent envoyer en même temps sans doublon : la prise en charge verrouille les lignes qu'elle
 * prend (`FOR UPDATE SKIP LOCKED`) et repousse leur prochaine tentative, ce qui sert de bail. Un processus qui meurt
 * en plein envoi rend donc ses lignes au bout du bail, sans intervention.
 *
 * Le contenu ne porte que des références. Jamais le texte d'un message : la conversation reste sur la plateforme.
 */

export const NOTIFICATION_KINDS = ["contact_received", "application_received", "message_received", "application_status", "mission_match", "contract_update", "vigilance_expiring", "mission_confirmation", "application_read", "mission_invitation", "company_mission", "account_notice"] as const;

/** Au-delà, la notification est abandonnée : une adresse qui rejette cinq fois de suite ne recevra rien de plus. */
export const MAX_ATTEMPTS = 5;
/** Bail d'un lot pris en charge : le temps d'envoyer, avant qu'un autre processus puisse le reprendre. */
const LEASE_MS = 5 * 60 * 1000;
/** Attente avant chaque nouvelle tentative : 1 min, 5 min, 30 min, 2 h. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

export type NotificationPayload = Readonly<Record<string, string | number | readonly string[]>>;

export interface PendingNotification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly payload: NotificationPayload;
  readonly attempts: number;
  readonly to: { readonly email: string; readonly lang: "fr" | "en"; readonly displayName: string };
}

export interface Notifications {
  /** Met en file pour chaque destinataire qui n'a pas coupé ce type d'e-mail. Rend le nombre de notifications créées. */
  enqueue(tx: Prisma.TransactionClient, userIds: readonly string[], kind: NotificationKind, payload: NotificationPayload): Promise<number>;
  /** Prend en charge un lot prêt à partir, et repousse ses lignes le temps du bail. */
  claim(limit: number, now: Date): Promise<readonly PendingNotification[]>;
  markSent(id: string, now: Date): Promise<void>;
  /** Échec d'envoi : nouvelle tentative plus tard, ou abandon après la dernière. */
  markFailed(id: string, attempts: number, errorName: string, now: Date): Promise<void>;
  preferences(actor: Actor): Promise<Readonly<Record<NotificationKind, boolean>>>;
  setPreference(actor: Actor, kind: NotificationKind, email: boolean): Promise<void>;
}

const ClaimedSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
  attempts: z.number(),
  email: z.string(),
  lang: z.string(),
  displayName: z.string(),
});

export const notifications = (db: Db): Notifications => ({
  async enqueue(tx, userIds, kind, payload) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return 0;
    // La notification de l'application ne dépend pas du choix des e-mails : elle est écrite pour tous (C15).
    const appKind = appKindOfEmail(kind);
    if (appKind !== null) await recordAppNotifications(tx, unique, appKind, payload);
    const muted = await tx.notificationPreference.findMany({ where: { userId: { in: unique }, kind, email: false }, select: { userId: true } });
    const off = new Set(muted.map((m) => m.userId));
    const recipients = unique.filter((id) => !off.has(id));
    if (recipients.length === 0) return 0;
    const { count } = await tx.notification.createMany({ data: recipients.map((userId) => ({ userId, kind, payload: payload as Prisma.InputJsonObject })) });
    return count;
  },

  async claim(limit, now) {
    const lease = new Date(now.getTime() + LEASE_MS);
    const rows = await db.$queryRaw<unknown[]>`
      WITH picked AS (
        SELECT "id" FROM "Notification"
        WHERE "sentAt" IS NULL AND "sendAfter" <= ${now} AND "attempts" < ${MAX_ATTEMPTS}
        ORDER BY "sendAfter", "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "Notification" n SET "sendAfter" = ${lease}
      FROM picked, "User" u
      WHERE n."id" = picked."id" AND u."id" = n."userId"
      RETURNING n."id", n."kind"::text AS "kind", n."payload", n."attempts", u."email", u."lang", u."displayName"`;
    return rows.map((raw) => {
      const row = ClaimedSchema.parse(raw);
      return {
        id: row.id,
        kind: row.kind,
        payload: row.payload,
        attempts: row.attempts,
        to: { email: row.email, lang: row.lang === "en" ? "en" : "fr", displayName: row.displayName },
      };
    });
  },

  async markSent(id, now) {
    await db.notification.update({ where: { id }, data: { sentAt: now } });
  },

  async markFailed(id, attempts, errorName, now) {
    const next = attempts + 1;
    const wait = BACKOFF_MS[Math.min(next - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0];
    await db.notification.update({
      where: { id },
      data: { attempts: next, lastError: errorName.slice(0, 200), sendAfter: new Date(now.getTime() + wait) },
    });
  },

  async preferences(actor) {
    const rows = await db.notificationPreference.findMany({ where: { userId: actor.userId }, select: { kind: true, email: true } });
    const off = new Set(rows.filter((r) => !r.email).map((r) => r.kind));
    return Object.fromEntries(NOTIFICATION_KINDS.map((kind) => [kind, !off.has(kind)])) as Record<NotificationKind, boolean>;
  },

  async setPreference(actor, kind, email) {
    await db.notificationPreference.upsert({
      where: { userId_kind: { userId: actor.userId, kind } },
      create: { userId: actor.userId, kind, email },
      update: { email },
    });
  },
});
