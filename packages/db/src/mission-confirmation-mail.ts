import { z } from "zod";
import type { Db } from "./client";
import { containsContact } from "./contact-detection";
import { MAX_ATTEMPTS } from "./notifications";

/*
 * File d'envoi des e-mails de confirmation adressés à un contact sans compte. La file des notifications est rattachée
 * à un compte : ici, le destinataire n'en a pas, et c'est la demande elle-même qui porte son état d'envoi. Les règles
 * sont celles des notifications : prise en charge sous bail (`FOR UPDATE SKIP LOCKED`), nouvel essai avec attente
 * croissante, abandon après cinq échecs.
 *
 * Le jeton du lien n'est pas en base : l'appelant le recalcule à partir de l'identifiant et du secret du serveur. Une
 * demande retirée, décidée ou échue ne part plus.
 */

const LEASE_MS = 5 * 60_000;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

export interface PendingConfirmationEmail {
  readonly id: string;
  readonly to: string;
  readonly lang: "fr" | "en";
  readonly attempts: number;
  /** Nom affiché du freelance, ou sa référence s'il contient une coordonnée. */
  readonly freelancer: string;
  readonly role: string;
  readonly clientName: string;
  readonly startedOn: Date;
  readonly endedOn: Date;
  readonly expiresAt: Date;
}

export interface ConfirmationMail {
  claim(limit: number, now: Date): Promise<readonly PendingConfirmationEmail[]>;
  markSent(id: string, now: Date): Promise<void>;
  markFailed(id: string, attempts: number, now: Date): Promise<void>;
}

const Picked = z.object({ id: z.string() });

export const confirmationMail = (db: Db): ConfirmationMail => ({
  async claim(limit, now) {
    const lease = new Date(now.getTime() + LEASE_MS);
    const picked = await db.$queryRaw<unknown[]>`
      WITH picked AS (
        SELECT "id" FROM "MissionConfirmationRequest"
        WHERE "emailSentAt" IS NULL AND "contactEmail" IS NOT NULL AND "status" = 'pending'
          AND "expiresAt" > ${now} AND "emailSendAfter" <= ${now} AND "emailAttempts" < ${MAX_ATTEMPTS}
        ORDER BY "emailSendAfter", "id"
        LIMIT ${Math.max(1, limit)}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "MissionConfirmationRequest" r SET "emailSendAfter" = ${lease}
      FROM picked WHERE r."id" = picked."id"
      RETURNING r."id"`;
    const ids = picked.map((row) => Picked.parse(row).id);
    if (ids.length === 0) return [];
    const rows = await db.missionConfirmationRequest.findMany({
      where: { id: { in: ids }, contactEmail: { not: null } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        contactEmail: true,
        lang: true,
        emailAttempts: true,
        role: true,
        clientName: true,
        startedOn: true,
        endedOn: true,
        expiresAt: true,
        profile: { select: { reference: true, user: { select: { displayName: true } } } },
      },
    });
    return rows.flatMap((r) =>
      r.contactEmail === null
        ? []
        : [
            {
              id: r.id,
              to: r.contactEmail,
              lang: r.lang === "en" ? ("en" as const) : ("fr" as const),
              attempts: r.emailAttempts,
              freelancer: containsContact(r.profile.user.displayName) ? r.profile.reference : r.profile.user.displayName,
              role: r.role,
              clientName: r.clientName,
              startedOn: r.startedOn,
              endedOn: r.endedOn,
              expiresAt: r.expiresAt,
            },
          ],
    );
  },

  async markSent(id, now) {
    await db.missionConfirmationRequest.updateMany({ where: { id }, data: { emailSentAt: now } });
  },

  async markFailed(id, attempts, now) {
    const next = attempts + 1;
    const wait = BACKOFF_MS[Math.min(next - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0];
    await db.missionConfirmationRequest.updateMany({ where: { id }, data: { emailAttempts: next, emailSendAfter: new Date(now.getTime() + wait) } });
  },
});
