import { assertOperator, notifyAccount, ReasonSchema, recordAction, type Operator, type OperatorResult } from "./back-office";
import type { Db } from "./client";
import { ProfileReferenceInputSchema } from "./moderation";
import { sixMonthsBefore, vigilanceExpiresOn } from "./vigilance";

/*
 * Attestations de vigilance URSSAF à vérifier, depuis l'écran de l'opérateur (C19) : la même règle que la commande
 * `vigilance` de la CLI. L'opérateur contrôle le code et l'entité sur le site de l'URSSAF, à la main (aucune
 * automatisation), puis marque vérifiée en recopiant le code contrôlé — seule l'attestation de ce code l'est, une
 * attestation redéclarée entre-temps ne l'est pas à sa place. Ou il la refuse, avec un motif que le freelance reçoit.
 */

export interface PendingAttestation {
  readonly reference: string;
  readonly issuedOn: Date;
  readonly expiresOn: Date;
  readonly securityCode: string;
  readonly declaredAt: Date;
  /** L'entité à laquelle l'attestation doit appartenir : l'identité de facturation déclarée. */
  readonly legalName: string | null;
  readonly siret: string | null;
}

/** Une attestation vérifiée, relue en base : ce que l'accusé de l'opérateur montre, jamais ce que dit une adresse. */
export interface VerifiedAttestation {
  readonly reference: string;
  readonly issuedOn: Date;
  readonly expiresOn: Date;
  readonly verifiedAt: Date;
}

export interface VigilanceDesk {
  /** Les attestations déclarées, en cours de validité, ni vérifiées ni refusées ; les plus anciennes d'abord. */
  pending(now: Date): Promise<readonly PendingAttestation[]>;
  pendingCount(now: Date): Promise<number>;
  verify(reference: string, securityCode: string, now: Date): Promise<OperatorResult>;
  reject(reference: string, reason: string, now: Date): Promise<OperatorResult>;
  /** L'attestation de ce profil si elle est vérifiée et non refusée ; `null` sinon, ou pour une référence mal formée. */
  verified(reference: string): Promise<VerifiedAttestation | null>;
}

const MAX_PENDING = 200;
const normaliseCode = (code: string): string => code.replace(/[\s-]/g, "").toUpperCase();

export const vigilanceDesk = (db: Db, operator: Operator): VigilanceDesk => {
  assertOperator(operator);
  const open = (now: Date) => ({ verifiedAt: null, rejectedAt: null, issuedOn: { gt: sixMonthsBefore(now) } });

  return {
    async pending(now) {
      const rows = await db.vigilanceAttestation.findMany({
        where: open(now),
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: MAX_PENDING,
        select: { issuedOn: true, securityCode: true, updatedAt: true, profile: { select: { reference: true, billing: { select: { legalName: true, siret: true } } } } },
      });
      return rows.map((r) => ({
        reference: r.profile.reference,
        issuedOn: r.issuedOn,
        expiresOn: vigilanceExpiresOn(r.issuedOn),
        securityCode: r.securityCode,
        declaredAt: r.updatedAt,
        legalName: r.profile.billing?.legalName ?? null,
        siret: r.profile.billing?.siret ?? null,
      }));
    },

    pendingCount: (now) => db.vigilanceAttestation.count({ where: open(now) }),

    async verify(rawReference, securityCode, now) {
      const reference = ProfileReferenceInputSchema.safeParse(rawReference);
      if (!reference.success) return "absent";
      return db.$transaction(async (tx): Promise<OperatorResult> => {
        const row = await tx.vigilanceAttestation.findFirst({ where: { profile: { reference: reference.data } }, select: { id: true, securityCode: true, verifiedAt: true, rejectedAt: true } });
        // Le code contrôlé fait partie de la condition : un code qui ne correspond pas ne marque rien, comme en CLI.
        if (row === null || row.securityCode !== normaliseCode(securityCode)) return "absent";
        const { count } = await tx.vigilanceAttestation.updateMany({ where: { id: row.id, securityCode: row.securityCode, verifiedAt: null, rejectedAt: null }, data: { verifiedAt: now } });
        if (count === 0) return "unchanged";
        await recordAction(tx, operator, { action: "vigilance_verified", targetType: "vigilance", targetId: row.id, reason: null, metadata: { reference: reference.data } }, now);
        return "done";
      });
    },

    async reject(rawReference, rawReason, now) {
      const reason = ReasonSchema.parse(rawReason);
      const reference = ProfileReferenceInputSchema.safeParse(rawReference);
      if (!reference.success) return "absent";
      return db.$transaction(async (tx): Promise<OperatorResult> => {
        const row = await tx.vigilanceAttestation.findFirst({ where: { profile: { reference: reference.data } }, select: { id: true, profile: { select: { userId: true } } } });
        if (row === null) return "absent";
        const { count } = await tx.vigilanceAttestation.updateMany({ where: { id: row.id, verifiedAt: null, rejectedAt: null }, data: { rejectedAt: now, rejectionReason: reason } });
        if (count === 0) return "unchanged";
        await recordAction(tx, operator, { action: "vigilance_rejected", targetType: "vigilance", targetId: row.id, reason, metadata: { reference: reference.data } }, now);
        await notifyAccount(tx, [row.profile.userId], "vigilance_rejected", reason);
        return "done";
      });
    },

    async verified(rawReference) {
      const reference = ProfileReferenceInputSchema.safeParse(rawReference);
      if (!reference.success) return null;
      const row = await db.vigilanceAttestation.findFirst({
        where: { profile: { reference: reference.data }, verifiedAt: { not: null }, rejectedAt: null },
        select: { issuedOn: true, verifiedAt: true },
      });
      if (row === null || row.verifiedAt === null) return null;
      return { reference: reference.data, issuedOn: row.issuedOn, expiresOn: vigilanceExpiresOn(row.issuedOn), verifiedAt: row.verifiedAt };
    },
  };
};
