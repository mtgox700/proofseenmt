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
  const make = (t: PaymentEvent["type"], intentId: string | null): PaymentEvent | null => (intentId === null ? null : { id, type: t, intentId });
  switch (type) {
    case "payment_intent.succeeded":
      return make("payment.succeeded", str(object.id));
    case "payment_intent.payment_failed":
      return make("payment.failed", str(object.id));
    case "payment_intent.canceled":
      return make("payment.canceled", str(object.id));
    case "charge.refunded":
      return make("refund.succeeded", str(object.payment_intent));
    case "charge.dispute.created":
      return make("dispute.opened", str(object.payment_intent));
    case "charge.dispute.closed":
      if (object.status === "won") return make("dispute.won", str(object.payment_intent));
      if (object.status === "lost") return make("dispute.lost", str(object.payment_intent));
      return null;
    default:
      return null;
  }
};
