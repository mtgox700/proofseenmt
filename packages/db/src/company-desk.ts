import { z } from "zod";
import type { Db } from "./client";
import type { PaymentStatus } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Ce qui attend une entreprise, compté en base au moment de la lecture : les confirmations de mission en attente, les
 * contrats à signer, les contrats à payer sous séquestre, les candidatures que personne n'a encore ouvertes. Chaque
 * compte reprend exactement la règle de l'écran où l'on agit, pour qu'un chiffre de l'accueil se retrouve ligne à ligne
 * sur la page ouverte par son lien. Rien d'estimé, aucun classement : des comptes et une échéance.
 *
 * Confirmer, signer et payer reviennent aux propriétaires et administrateurs de l'entreprise : pour un autre membre,
 * ces lignes valent `null` (il n'a rien à y faire), jamais un zéro qui laisserait croire que rien n'attend.
 */

const Uuid = z.uuid();
const ADMINS = ["owner", "admin"] as const;

/** Un paiement passé à l'un de ces états a déjà été fait : le contrat n'est plus « à payer » (`payments.open`). */
const PAID: readonly PaymentStatus[] = ["held", "releasing", "released", "refunding", "disputed"];

export interface CompanyDesk {
  /** L'acteur administre l'entreprise : il peut confirmer, signer et payer. */
  readonly admin: boolean;
  /** Demandes de confirmation en attente et non échues, avec la plus proche échéance. */
  readonly confirmations: { readonly count: number; readonly soonest: Date | null } | null;
  /** Contrats qui attendent la signature de l'entreprise (elle signe la première). */
  readonly toSign: number | null;
  /** Contrats au forfait signés des deux côtés, sans paiement fait. */
  readonly toPay: number | null;
  /** Candidatures sur les missions ouvertes que personne de l'entreprise n'a encore ouvertes. */
  readonly unreadApplications: number;
}

export interface CompanyDesks {
  /** `null` si l'acteur n'est pas membre de l'entreprise. */
  forCompany(actor: Actor, organisationId: string, now: Date): Promise<CompanyDesk | null>;
}

export const companyDesk = (db: Db): CompanyDesks => ({
  async forCompany(actor, organisationId, now) {
    if (!Uuid.safeParse(organisationId).success) return null;
    const membership = await db.membership.findFirst({ where: { organisationId, userId: actor.userId }, select: { role: true } });
    if (membership === null) return null;
    // Comme `applicationDetails.open` : tout membre lit les candidatures, et la première ouverture les marque lues.
    const unread = db.application.count({ where: { jobPost: { organisationId, status: "open" }, status: { not: "withdrawn" }, readAt: null } });
    const admin = (ADMINS as readonly string[]).includes(membership.role);
    if (!admin) return { admin, confirmations: null, toSign: null, toPay: null, unreadApplications: await unread };
    // Le freelance qui administre aussi l'entreprise ne se confirme, ne se signe ni ne se paie lui-même.
    const notSelf = { NOT: { profile: { userId: actor.userId } } };
    const [confirmations, toSign, toPay, unreadApplications] = await Promise.all([
      // `listForCompany`, réduit à cette entreprise.
      db.missionConfirmationRequest.aggregate({ where: { organisationId, status: "pending", expiresAt: { gt: now }, ...notSelf }, _count: { _all: true }, _min: { expiresAt: true } }),
      // `contracts.sign` : l'entreprise signe d'abord, le freelance ensuite.
      db.contract.count({ where: { organisationId, status: "pending_signatures", acceptedByOrgAt: null, ...notSelf } }),
      // `payments.open` : un contrat actif au forfait, sans paiement fait (une intention abandonnée reste à payer).
      db.contract.count({ where: { organisationId, status: "active", billing: "fixed", payments: { none: { status: { in: [...PAID] } } }, ...notSelf } }),
      unread,
    ]);
    return {
      admin,
      confirmations: { count: confirmations._count._all, soonest: confirmations._min.expiresAt },
      toSign,
      toPay,
      unreadApplications,
    };
  },
});
