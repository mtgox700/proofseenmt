import { z } from "zod";
import type { Db } from "./client";
import type { InvitationKind } from "./generated/enums";
import { senderLabel } from "./invitations";
import { MAX_ATTEMPTS } from "./notifications";

/*
 * File d'envoi des e-mails d'invitation (C23). Le destinataire n'a peut-être pas de compte : c'est l'invitation qui
 * porte son état d'envoi, comme une demande de confirmation de mission. Prise en charge sous bail (`FOR UPDATE SKIP
 * LOCKED`), nouvel essai avec attente croissante, abandon après cinq échecs.
 *
 * Le même e-mail part, que l'adresse ait un compte ou non : rien n'est lu dans la table des comptes. Une invitation
 * décidée, révoquée ou échue ne part plus, ni celle d'un expéditeur ou d'une entreprise masqués par un opérateur. Le
 * jeton du lien n'est pas en base : l'appelant le recalcule à partir de l'identifiant et du secret du serveur.
 */

const LEASE_MS = 5 * 60_000;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

export interface PendingInvitationEmail {
  readonly id: string;
  readonly to: string;
  readonly lang: "fr" | "en";
  readonly attempts: number;
  readonly kind: InvitationKind;
  readonly inviter: string;
  readonly message: string | null;
  readonly expiresAt: Date;
  /** La relance unique, et non le premier envoi. */
  readonly reminder: boolean;
}

export interface InvitationMail {
  claim(limit: number, now: Date): Promise<readonly PendingInvitationEmail[]>;
  markSent(id: string, now: Date): Promise<void>;
  markFailed(id: string, attempts: number, now: Date): Promise<void>;
}

const Picked = z.object({ id: z.string() });

export const invitationMail = (db: Db): InvitationMail => ({
  async claim(limit, now) {
    const lease = new Date(now.getTime() + LEASE_MS);
    const picked = await db.$queryRaw<unknown[]>`
      WITH picked AS (
        SELECT i."id" FROM "Invitation" i
        JOIN "User" s ON s."id" = i."senderUserId"
        LEFT JOIN "Organisation" o ON o."id" = i."organisationId"
        WHERE i."emailSentAt" IS NULL AND i."status" = 'pending' AND i."expiresAt" > ${now}
          AND i."emailSendAfter" <= ${now} AND i."emailAttempts" < ${MAX_ATTEMPTS}
          AND s."suspendedAt" IS NULL AND (o."id" IS NULL OR o."suspendedAt" IS NULL)
        ORDER BY i."emailSendAfter", i."id"
        LIMIT ${Math.max(1, limit)}
        FOR UPDATE OF i SKIP LOCKED
      )
      UPDATE "Invitation" r SET "emailSendAfter" = ${lease}
      FROM picked WHERE r."id" = picked."id"
      RETURNING r."id"`;
    const ids = picked.map((row) => Picked.parse(row).id);
    if (ids.length === 0) return [];
    const rows = await db.invitation.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        kind: true,
        email: true,
        lang: true,
        emailAttempts: true,
        message: true,
        expiresAt: true,
        remindedAt: true,
        organisation: { select: { name: true } },
        sender: { select: { displayName: true, freelanceProfile: { select: { reference: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      to: r.email,
      lang: r.lang === "en" ? ("en" as const) : ("fr" as const),
      attempts: r.emailAttempts,
      kind: r.kind,
      inviter: r.organisation?.name ?? senderLabel(r.sender.displayName, r.sender.freelanceProfile?.reference ?? null),
      message: r.message,
      expiresAt: r.expiresAt,
      reminder: r.remindedAt !== null,
    }));
  },

  async markSent(id, now) {
    await db.invitation.updateMany({ where: { id }, data: { emailSentAt: now } });
  },

  async markFailed(id, attempts, now) {
    const next = attempts + 1;
    const wait = BACKOFF_MS[Math.min(next - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0];
    await db.invitation.updateMany({ where: { id }, data: { emailAttempts: next, emailSendAfter: new Date(now.getTime() + wait) } });
  },
});
