import type { Prisma } from "./generated/client";
import { vigilanceExpiresOn } from "./vigilance";

/*
 * Ce qui empêche un contrat de naître ou d'être signé, vérifié aux deux moments : entre la création et la signature,
 * une entreprise peut fermer et une attestation expirer.
 *
 * Attestation de vigilance : le seuil légal (5 000 € HT) s'apprécie sur la prestation, pas sur un devis — deux devis de
 * 4 900 € entre les mêmes parties la dépassent. On additionne donc les contrats non annulés des six derniers mois entre
 * la même entreprise et le même freelance, dans la devise du contrat. Pour les autres devises, le seuil est fixé
 * prudemment au-dessous de l'équivalent de 5 000 € : mieux vaut demander l'attestation une fois de trop.
 */

export const VIGILANCE_THRESHOLD_BY_CURRENCY: Readonly<Record<string, number>> = { EUR: 500_000, USD: 500_000, CHF: 450_000, GBP: 400_000 };
const SIX_MONTHS_MS = 183 * 86_400_000;

export type ContractBlocker = "registry_ceased" | "vigilance_required";

export interface BlockerInput {
  readonly organisationId: string;
  readonly profileId: string;
  readonly currency: string;
  /** Montant du contrat examiné, toujours compté, même créé il y a plus de six mois. */
  readonly addedCents: number;
  /** À la signature : le contrat examiné, exclu de la somme des contrats antérieurs pour n'être compté qu'une fois. */
  readonly contractId?: string;
  readonly now: Date;
}

export const contractBlocker = async (tx: Prisma.TransactionClient, i: BlockerInput): Promise<ContractBlocker | null> => {
  const [freelanceCeased, companyCeased] = await Promise.all([
    tx.billingIdentity.count({ where: { profileId: i.profileId, registryStatus: "ceased" } }),
    tx.organisation.count({ where: { id: i.organisationId, registryStatus: "ceased" } }),
  ]);
  if (freelanceCeased + companyCeased > 0) return "registry_ceased";

  const threshold = VIGILANCE_THRESHOLD_BY_CURRENCY[i.currency] ?? VIGILANCE_THRESHOLD_BY_CURRENCY.EUR ?? 500_000;
  const recent = await tx.contract.aggregate({
    where: {
      organisationId: i.organisationId,
      profileId: i.profileId,
      currency: i.currency,
      status: { not: "cancelled" },
      createdAt: { gte: new Date(i.now.getTime() - SIX_MONTHS_MS) },
      ...(i.contractId === undefined ? {} : { id: { not: i.contractId } }),
    },
    _sum: { totalCents: true },
  });
  if ((recent._sum.totalCents ?? 0) + i.addedCents < threshold) return null;
  // Seule une attestation vérifiée par un opérateur compte : une déclaration n'est pas une preuve.
  const attestation = await tx.vigilanceAttestation.findUnique({ where: { profileId: i.profileId }, select: { issuedOn: true, verifiedAt: true } });
  const valid = attestation !== null && attestation.verifiedAt !== null && vigilanceExpiresOn(attestation.issuedOn).getTime() > i.now.getTime();
  return valid ? null : "vigilance_required";
};
