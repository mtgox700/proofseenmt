import type { Prisma } from "./generated/client";

/*
 * Une facture émise à la libération des fonds est acquittée ce jour-là. La date d'acquittement n'est PAS celle de la
 * charge chez le prestataire : l'article L441-9 I du code de commerce répute le règlement réalisé « à la date à laquelle
 * les fonds sont mis, par le client, à la disposition du bénéficiaire », c'est-à-dire, ici, quand Proofseen les verse au
 * freelance (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414397/). Pour la facture de mission comme
 * pour celle de commission (retenue sur ce même versement), le jour est celui de la libération. La date d'encaissement du
 * paiement (`Payment.paidAt`) sert au rapprochement bancaire, pas aux factures.
 *
 * Tous les jours d'une facture se comptent à l'heure de Paris, comme l'année de son numéro : sinon une facture émise le
 * 31 décembre à 23 h 30 UTC porterait un numéro de 2027 et une date de 2026.
 */

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Le jour civil (à Paris) d'un instant, comme une date sans heure (minuit UTC de ce jour, la forme d'une colonne DATE). */
export const parisDay = (instant: Date): Date => new Date(`${PARIS_DAY.format(instant)}T00:00:00Z`);

/**
 * Le jour où la facture est réglée, ou `null` si les fonds n'ont pas (encore) été mis à la disposition du freelance :
 * la facture garde alors l'échéance habituelle plutôt qu'un acquittement inventé. Jamais après l'émission.
 */
export const settlementDay = async (tx: Prisma.TransactionClient, contractId: string, now: Date): Promise<Date | null> => {
  const released = await tx.payment.findFirst({
    where: { contractId, status: "released", releasedAt: { not: null } },
    orderBy: { releasedAt: "desc" },
    select: { releasedAt: true },
  });
  if (released?.releasedAt == null) return null;
  return parisDay(released.releasedAt.getTime() > now.getTime() ? now : released.releasedAt);
};
