import { z } from "zod";
import { APP_NOTIFICATION_KINDS, appNotificationPayload, type AppNotificationPayload } from "./app-notifications";
import type { Db } from "./client";
import type { AppNotificationKind } from "./generated/enums";

/*
 * File des notifications poussées (C20), vidée par la tâche planifiée.
 *
 * Même bail que la file des e-mails : la prise en charge verrouille ses lignes (`FOR UPDATE SKIP LOCKED`) et repousse
 * leur prochaine tentative ; deux tâches qui se chevauchent ne poussent jamais deux fois la même notification.
 *
 * Ce qui ne sert plus est retiré avant chaque prise en charge : une notification déjà lue dans l'application, un compte
 * suspendu, une attente de plus d'un jour (pousser « nouveau message » le lendemain n'aide personne), une ligne qui a
 * épuisé ses essais. L'appareil d'un autre compte ne reçoit jamais la notification : la prise en charge revérifie que
 * l'abonnement et la notification sont à la même personne.
 *
 * Seules des références quittent la base : le type de la notification, sa charge réduite et la langue de la personne.
 * Jamais le texte d'un message.
 */

export const MAX_PUSH_ATTEMPTS = 3;
/** Au-delà, une notification poussée n'a plus d'intérêt : elle est retirée de la file. */
export const PUSH_STALE_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
/** Attente avant chaque nouvelle tentative : 1 min, puis 10 min. */
const BACKOFF_MS = [60_000, 10 * 60_000] as const;

export interface PendingPush {
  readonly id: string;
  readonly attempts: number;
  readonly subscription: { readonly id: string; readonly endpoint: string; readonly p256dh: string; readonly auth: string };
  readonly notification: { readonly id: string; readonly kind: AppNotificationKind; readonly payload: AppNotificationPayload };
  readonly lang: "fr" | "en";
}

export interface PushQueue {
  /** Retire ce qui ne sert plus, puis prend en charge un lot prêt à partir. */
  claim(limit: number, now: Date): Promise<readonly PendingPush[]>;
  /** Poussée acceptée par le service : la ligne part, l'appareil est noté comme joignable. */
  markDelivered(push: PendingPush, now: Date): Promise<void>;
  /** L'appareil n'existe plus (404 ou 410 du service) : l'abonnement et ce qui l'attendait partent. */
  markGone(push: PendingPush): Promise<void>;
  /** Échec passager : nouvelle tentative plus tard, ou abandon après la dernière. */
  markFailed(push: PendingPush, now: Date): Promise<void>;
}

const ClaimedSchema = z.object({
  id: z.string(),
  attempts: z.number(),
  subscriptionId: z.string(),
  endpoint: z.string(),
  p256dh: z.string(),
  auth: z.string(),
  notificationId: z.string(),
  kind: z.enum(APP_NOTIFICATION_KINDS),
  payload: z.unknown(),
  lang: z.string(),
});

export const pushQueue = (db: Db): PushQueue => ({
  async claim(limit, now) {
    const take = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const stale = new Date(now.getTime() - PUSH_STALE_MS);
    await db.$executeRaw`
      DELETE FROM "PushDelivery" d
      USING "AppNotification" n, "PushSubscription" s, "User" u
      WHERE n."id" = d."notificationId" AND s."id" = d."subscriptionId" AND u."id" = s."userId"
        AND (n."readAt" IS NOT NULL OR u."suspendedAt" IS NOT NULL OR n."userId" <> s."userId"
             OR d."createdAt" < ${stale} OR d."attempts" >= ${MAX_PUSH_ATTEMPTS})`;
    const lease = new Date(now.getTime() + LEASE_MS);
    const rows = await db.$queryRaw<unknown[]>`
      WITH picked AS (
        SELECT "id" FROM "PushDelivery"
        WHERE "sendAfter" <= ${now} AND "attempts" < ${MAX_PUSH_ATTEMPTS}
        ORDER BY "sendAfter", "id"
        LIMIT ${take}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "PushDelivery" d SET "sendAfter" = ${lease}
      FROM picked, "PushSubscription" s, "AppNotification" n, "User" u
      WHERE d."id" = picked."id" AND s."id" = d."subscriptionId" AND n."id" = d."notificationId" AND u."id" = s."userId"
        AND n."userId" = s."userId" AND n."readAt" IS NULL AND u."suspendedAt" IS NULL
      RETURNING d."id", d."attempts", s."id" AS "subscriptionId", s."endpoint", s."p256dh", s."auth",
        n."id" AS "notificationId", n."kind"::text AS "kind", n."payload", u."lang"`;
    return rows.map((raw) => {
      const row = ClaimedSchema.parse(raw);
      return {
        id: row.id,
        attempts: row.attempts,
        subscription: { id: row.subscriptionId, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        notification: { id: row.notificationId, kind: row.kind, payload: appNotificationPayload(row.payload) },
        lang: row.lang === "en" ? "en" : "fr",
      };
    });
  },

  async markDelivered(push, now) {
    await db.$transaction(async (tx) => {
      await tx.pushDelivery.deleteMany({ where: { id: push.id } });
      await tx.pushSubscription.updateMany({ where: { id: push.subscription.id }, data: { lastSuccessAt: now, failures: 0 } });
    });
  },

  async markGone(push) {
    await db.pushSubscription.deleteMany({ where: { id: push.subscription.id } });
  },

  async markFailed(push, now) {
    const next = push.attempts + 1;
    await db.$transaction(async (tx) => {
      await tx.pushSubscription.updateMany({ where: { id: push.subscription.id }, data: { failures: { increment: 1 } } });
      if (next >= MAX_PUSH_ATTEMPTS) {
        await tx.pushDelivery.deleteMany({ where: { id: push.id } });
        return;
      }
      const wait = BACKOFF_MS[Math.min(next - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0];
      await tx.pushDelivery.updateMany({ where: { id: push.id }, data: { attempts: next, sendAfter: new Date(now.getTime() + wait) } });
    });
  },
});
