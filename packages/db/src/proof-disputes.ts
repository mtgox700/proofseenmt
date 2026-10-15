import { z } from "zod";
import { assertOperator, notifyAccount, ReasonSchema, recordAction, type Operator, type OperatorResult } from "./back-office";
import type { Db } from "./client";
import type { ProofMethod } from "./generated/enums";

/*
 * Adresses contestées (C19) : une adresse ne peut être prouvée que par un seul profil. Quand un second freelance la
 * déclare, sa preuve est refusée (« déjà prouvée ailleurs ») — et rien d'autre ne se passe : le premier l'a peut-être
 * prouvée sur une page qui ne lui appartient plus, ou par erreur. La contestation n'est pas stockée à part : elle se lit
 * dans les adresses elles-mêmes (la même clé, prouvée par l'un, déclarée par l'autre).
 *
 * L'opérateur compare les deux profils et leurs dates, contrôle à la main, et peut retirer la preuve du premier, avec un
 * motif qu'il reçoit. L'adresse redevient une simple déclaration : le second peut alors la prouver.
 */

export interface ProofDispute {
  readonly urlKey: string;
  readonly holder: { readonly ownedUrlId: string; readonly reference: string; readonly url: string; readonly proofMethod: ProofMethod; readonly verifiedAt: Date; readonly declaredAt: Date };
  readonly claimant: { readonly ownedUrlId: string; readonly reference: string; readonly url: string; readonly declaredAt: Date };
}

export interface ProofDisputes {
  list(): Promise<readonly ProofDispute[]>;
  /** Retire la preuve d'une adresse prouvée ; l'adresse reste déclarée sur le profil. */
  revoke(ownedUrlId: string, reason: string, now: Date): Promise<OperatorResult>;
}

const Uuid = z.uuid();
const MAX_KEYS = 500;

export const proofDisputes = (db: Db, operator: Operator): ProofDisputes => {
  assertOperator(operator);
  return {
    async list() {
      const claims = await db.ownedUrl.findMany({
        where: { verifiedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: MAX_KEYS,
        select: { id: true, urlKey: true, url: true, profileId: true, createdAt: true, profile: { select: { reference: true } } },
      });
      if (claims.length === 0) return [];
      const holders = await db.ownedUrl.findMany({
        where: { verifiedAt: { not: null }, urlKey: { in: [...new Set(claims.map((c) => c.urlKey))] } },
        select: { id: true, urlKey: true, url: true, profileId: true, proofMethod: true, verifiedAt: true, createdAt: true, profile: { select: { reference: true } } },
      });
      const holderOf = new Map(holders.map((h) => [h.urlKey, h]));
      return claims.flatMap((claim): ProofDispute[] => {
        const holder = holderOf.get(claim.urlKey);
        if (holder === undefined || holder.profileId === claim.profileId || holder.verifiedAt === null) return [];
        return [
          {
            urlKey: claim.urlKey,
            holder: { ownedUrlId: holder.id, reference: holder.profile.reference, url: holder.url, proofMethod: holder.proofMethod, verifiedAt: holder.verifiedAt, declaredAt: holder.createdAt },
            claimant: { ownedUrlId: claim.id, reference: claim.profile.reference, url: claim.url, declaredAt: claim.createdAt },
          },
        ];
      });
    },

    async revoke(ownedUrlId, rawReason, now) {
      const reason = ReasonSchema.parse(rawReason);
      if (!Uuid.safeParse(ownedUrlId).success) return "absent";
      return db.$transaction(async (tx): Promise<OperatorResult> => {
        const row = await tx.ownedUrl.findUnique({ where: { id: ownedUrlId }, select: { url: true, profile: { select: { reference: true, userId: true } } } });
        if (row === null) return "absent";
        const { count } = await tx.ownedUrl.updateMany({ where: { id: ownedUrlId, verifiedAt: { not: null } }, data: { verifiedAt: null, failedAt: null, checkedAt: now } });
        if (count === 0) return "unchanged";
        await recordAction(tx, operator, { action: "proof_revoked", targetType: "owned_url", targetId: ownedUrlId, reason, metadata: { url: row.url, reference: row.profile.reference } }, now);
        await notifyAccount(tx, [row.profile.userId], "proof_revoked", reason, row.url);
        return "done";
      });
    },
  };
};
