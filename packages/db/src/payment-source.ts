import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import { chargeToRecord } from "./payment-charge";
import { isSourceCharge, SourceChargeMismatchError, SourceChargeMissingError } from "./payment-errors";
import type { ChargeFacts, PaymentGateway } from "./payments";

/*
 * La source d'un virement : la charge qui a encaissé le paiement. Avant de virer, on s'assure qu'elle existe et qu'elle
 * est bien celle de CE paiement, en lisant le prestataire (lectures seules, rien n'est créé ni modifié chez lui) :
 *  - charge inconnue (paiement confirmé avant ce suivi, événement sans `latest_charge`) : on relit l'intention, et on
 *    ne retient sa dernière charge que si l'intention, son statut « succeeded », la devise et le montant correspondent au
 *    paiement, et que la charge n'est pas déjà celle d'un autre paiement ; elle est alors enregistrée, avec la date de la
 *    charge quand le paiement n'en avait pas, puis utilisée ;
 *  - charge connue : on la relit avant le premier virement et on vérifie qu'elle correspond au paiement (intention,
 *    devise, montant, payée) et que ce qui reste après remboursement couvre le virement.
 * Tout échec (lecture impossible, charge non retenue, charge qui ne correspond pas) refuse le virement avec une erreur
 * nommée et signale le paiement à une personne : jamais un virement sans source établie.
 */

export interface PaymentToSource {
  readonly id: string;
  readonly stripeIntentId: string;
  readonly currency: string;
  readonly amountCents: number;
  readonly chargeId: string | null;
  readonly paidAt: Date | null;
}

const matchesPayment = (payment: PaymentToSource, facts: ChargeFacts): boolean =>
  facts.paid && facts.intentId === payment.stripeIntentId && facts.currency.toUpperCase() === payment.currency.toUpperCase() && facts.amountCents === payment.amountCents;

/** Une lecture chez le prestataire qui échoue (réseau, refus, identifiant inconnu) : la source n'est pas établie. */
const read = async <T>(lookup: () => Promise<T>): Promise<T> => {
  try {
    return await lookup();
  } catch {
    throw new SourceChargeMissingError();
  }
};

const recover = async (db: Db, gateway: PaymentGateway, payment: PaymentToSource): Promise<string> => {
  const intent = await read(() => gateway.readIntent(payment.stripeIntentId));
  const facts = intent.charge;
  if (intent.intentId !== payment.stripeIntentId || intent.status !== "succeeded" || facts === null || !isSourceCharge(facts.chargeId) || !matchesPayment(payment, facts)) {
    throw new SourceChargeMissingError();
  }
  try {
    await db.$transaction(async (tx) => {
      const attribution = await chargeToRecord(tx, payment.id, facts.chargeId);
      if (attribution.chargeId === null) throw new SourceChargeMissingError();
      const paidAt = payment.paidAt === null && facts.createdAt !== null ? { paidAt: facts.createdAt } : {};
      await tx.payment.updateMany({ where: { id: payment.id, chargeId: null }, data: { chargeId: facts.chargeId, ...paidAt } });
    });
  } catch (error) {
    if (error instanceof SourceChargeMissingError) throw error;
    // Une charge attribuée entre-temps à un autre paiement (index unique), ou une panne : la source n'est pas établie.
    if (isUniqueViolation(error)) throw new SourceChargeMissingError();
    throw error;
  }
  // Un événement tardif a pu poser la charge entre la lecture et l'écriture : seule celle de la base fait foi.
  const stored = await db.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { chargeId: true } });
  if (stored.chargeId !== facts.chargeId) throw new SourceChargeMissingError();
  return facts.chargeId;
};

const verify = async (gateway: PaymentGateway, payment: PaymentToSource, chargeId: string, transferCents: number): Promise<string> => {
  const facts = await read(() => gateway.readCharge(chargeId));
  if (facts.chargeId !== chargeId || !matchesPayment(payment, facts) || facts.amountCents - facts.refundedCents < transferCents) throw new SourceChargeMismatchError();
  return chargeId;
};

/**
 * La charge établie qui financera un virement de `transferCents`, ou une erreur nommée (le paiement est alors signalé
 * « à revoir » à `now`, ce qui l'écarte de la reprise périodique tant qu'une personne ne l'a pas examiné).
 */
export const establishSource = async (db: Db, gateway: PaymentGateway, payment: PaymentToSource, transferCents: number, now: Date): Promise<string> => {
  try {
    return payment.chargeId === null ? await recover(db, gateway, payment) : await verify(gateway, payment, payment.chargeId, transferCents);
  } catch (error) {
    await db.payment.updateMany({ where: { id: payment.id, needsReviewAt: null }, data: { needsReviewAt: now } });
    throw error;
  }
};
