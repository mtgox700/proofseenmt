import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentEvent } from "@proofseen/db";
import { z } from "zod";

/*
 * Webhooks Stripe : vérification de la signature, puis traduction en événement normalisé.
 *
 * La signature couvre « horodatage.corps brut » (HMAC-SHA256 avec le secret de l'endpoint). Un événement trop ancien
 * est refusé même correctement signé : sans cela, un événement intercepté pourrait être rejoué indéfiniment. La
 * comparaison est à temps constant.
 *
 * Les événements qui ne concernent pas un paiement de la plateforme sont ignorés, pas rejetés : Stripe en envoie
 * beaucoup, et répondre en erreur le ferait réessayer pour rien.
 */

/** Tolérance par défaut de Stripe : cinq minutes. */
export const SIGNATURE_TOLERANCE_S = 300;

export type VerifyResult = { readonly ok: true; readonly payload: unknown } | { readonly ok: false; readonly reason: "signature" | "expired" | "format" };

export const verifyStripeSignature = (rawBody: string, header: string | null, secret: string, nowMs: number): VerifyResult => {
  if (header === null || secret === "") return { ok: false, reason: "signature" };
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isInteger(timestamp) || signatures.length === 0) return { ok: false, reason: "signature" };
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  const matches = signatures.some((sig) => {
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) return { ok: false, reason: "signature" };
  if (Math.abs(nowMs / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return { ok: false, reason: "expired" };
  try {
    return { ok: true, payload: JSON.parse(rawBody) as unknown };
  } catch {
    return { ok: false, reason: "format" };
  }
};

/**
 * Plusieurs endpoints, plusieurs secrets : celui de la plateforme (paiements, remboursements, litiges) et celui des
 * comptes connectés (`account.updated` des freelances). Un événement est accepté s'il est signé par l'un d'eux ; s'il
 * l'est mais trop ancien, il est refusé comme tel.
 */
export const verifyStripeSignatureWithAny = (rawBody: string, header: string | null, secrets: readonly string[], nowMs: number): VerifyResult => {
  let refused: VerifyResult = { ok: false, reason: "signature" };
  for (const secret of secrets) {
    if (secret === "") continue;
    const result = verifyStripeSignature(rawBody, header, secret, nowMs);
    if (result.ok) return result;
    if (result.reason !== "signature") refused = result;
  }
  return refused;
};

const EventSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/** L'événement Stripe traduit, ou `null` s'il ne concerne pas un paiement suivi par la plateforme. */
export const toPaymentEvent = (payload: unknown): PaymentEvent | null => {
  const parsed = EventSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { id, type, data } = parsed.data;
  const object = data.object;
  const simple = (t: "payment.succeeded" | "payment.failed" | "payment.canceled" | "dispute.opened", intentId: string | null): PaymentEvent | null =>
    intentId === null ? null : { id, type: t, intentId };
  switch (type) {
    case "payment_intent.succeeded":
      return simple("payment.succeeded", str(object.id));
    case "payment_intent.payment_failed":
      return simple("payment.failed", str(object.id));
    case "payment_intent.canceled":
      return simple("payment.canceled", str(object.id));
    case "charge.refunded": {
      // Montant remboursé cumulé : un remboursement partiel ne doit pas passer pour un remboursement total.
      const intentId = str(object.payment_intent);
      const refunded = object.amount_refunded;
      return intentId === null || typeof refunded !== "number" || !Number.isInteger(refunded) ? null : { id, type: "refund.updated", intentId, amountRefundedCents: refunded };
    }
    case "charge.dispute.created":
      return simple("dispute.opened", str(object.payment_intent));
    case "charge.dispute.closed": {
      const intentId = str(object.payment_intent);
      if (intentId === null || (object.status !== "won" && object.status !== "lost")) return null;
      return { id, type: "dispute.closed", intentId, won: object.status === "won" };
    }
    case "account.updated": {
      const accountId = str(object.id);
      return accountId === null ? null : { id, type: "account.updated", accountId, payoutsEnabled: object.payouts_enabled === true };
    }
    default:
      return null;
  }
};
