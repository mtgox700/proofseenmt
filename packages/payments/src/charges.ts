import { isSourceCharge, type ChargeFacts } from "@proofseen/db";
import { z } from "zod";

/*
 * Une charge Stripe lue en lecture seule (https://docs.stripe.com/api/charges/object), réduite aux faits qui servent à
 * vérifier la source d'un virement : l'intention qu'elle a encaissée, la devise, le montant, ce qui est remboursé, si elle
 * est payée, et quand elle a été créée. Zod à la frontière : une réponse qui n'a pas cette forme n'est pas une charge.
 */

const ChargeSchema = z.object({
  id: z.string(),
  payment_intent: z.string().nullish(),
  currency: z.string().regex(/^[a-zA-Z]{3}$/),
  amount: z.number().int().nonnegative(),
  amount_refunded: z.number().int().nonnegative(),
  paid: z.boolean(),
  created: z.number().int().positive().nullish(),
});

/** Les faits de la charge, ou `null` si la valeur n'est pas une charge exploitable. */
export const chargeFacts = (raw: unknown): ChargeFacts | null => {
  const parsed = ChargeSchema.safeParse(raw);
  if (!parsed.success || !isSourceCharge(parsed.data.id)) return null;
  const { id, payment_intent, currency, amount, amount_refunded, paid, created } = parsed.data;
  return {
    chargeId: id,
    intentId: payment_intent ?? null,
    currency: currency.toUpperCase(),
    amountCents: amount,
    refundedCents: amount_refunded,
    paid,
    createdAt: created == null ? null : new Date(created * 1000),
  };
};
