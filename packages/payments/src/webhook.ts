import { createHmac, timingSafeEqual } from "node:crypto";
import { isSourceCharge, type PaymentEvent } from "@proofseen/db";
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
 * Plusieurs destinations, plusieurs secrets : celle de la plateforme (paiements, remboursements, litiges), celle des
 * comptes connectés (instantanés v1 `account.updated`) et celle des événements légers v2 des comptes de versement. La
 * signature est la même pour les trois (`Stripe-Signature`, https://docs.stripe.com/webhooks). Un événement est accepté
 * s'il est signé par l'un d'eux ; s'il l'est mais trop ancien, il est refusé comme tel.
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
  // L'heure de l'événement, en secondes : lue avec indulgence (un événement n'est pas rejeté pour une heure illisible).
  created: z.unknown().optional(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

/**
 * Événement « léger » (thin) des comptes v2 : seulement une référence vers le compte, jamais son état
 * (https://docs.stripe.com/event-destinations). Il arrive par une destination « Your account » au format « Thin » :
 * pour un compte v2 qui représente un compte connecté, les événements v2 sont émis dans le périmètre de la plateforme
 * (https://docs.stripe.com/connect/accounts-v2/migrate-integration). `context` est alors nul ; un événement venu d'un
 * autre contexte ne concerne pas nos comptes de versement et est ignoré.
 */
const ThinEventSchema = z.object({
  id: z.string().min(1),
  object: z.literal("v2.core.event"),
  type: z.string(),
  context: z.string().nullish(),
  related_object: z.object({ id: z.string(), type: z.string() }).nullish(),
});

/** Les événements v2 qui signalent qu'un compte de versement a pu devenir prêt (ou cesser de l'être). */
export const ACCOUNT_THIN_EVENTS: ReadonlySet<string> = new Set([
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[requirements].updated",
]);

/**
 * Un compte de versement a peut-être changé. L'événement ne porte pas l'état qui fait foi : il se relit chez Stripe
 * (`payoutAccountReady`) avant d'être appliqué comme `account.updated`.
 */
export interface AccountSignal {
  readonly id: string;
  readonly type: "account.signal";
  readonly accountId: string;
}

export type WebhookEvent = Exclude<PaymentEvent, { readonly type: "account.updated" }> | AccountSignal;

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * La charge d'un paiement réussi (`latest_charge` : un identifiant, ou l'objet charge si Stripe l'a développé). Tout ce qui
 * n'est pas une charge est écarté : l'identifiant finit dans le corps d'un virement.
 */
const chargeOf = (value: unknown): string | null => {
  const candidate = typeof value === "object" && value !== null ? (value as { readonly id?: unknown }).id : value;
  return isSourceCharge(candidate) ? candidate : null;
};

/** L'heure de l'événement (`created`, en secondes depuis 1970), ou rien si elle n'est pas un entier positif : jamais inventée. */
const occurredAtOf = (created: unknown): { readonly occurredAt: Date } | Record<string, never> =>
  typeof created === "number" && Number.isInteger(created) && created > 0 ? { occurredAt: new Date(created * 1000) } : {};

const accountSignal = (id: string, accountId: string | null): AccountSignal | null =>
  accountId !== null && /^acct_[A-Za-z0-9]+$/.test(accountId) ? { id, type: "account.signal", accountId } : null;

const fromThinEvent = (payload: unknown): AccountSignal | null => {
  const thin = ThinEventSchema.safeParse(payload);
  if (!thin.success || !ACCOUNT_THIN_EVENTS.has(thin.data.type) || (thin.data.context ?? null) !== null) return null;
  const related = thin.data.related_object;
  return related?.type === "v2.core.account" ? accountSignal(thin.data.id, related.id) : null;
};

/** L'événement Stripe traduit, ou `null` s'il ne concerne pas un paiement ni un compte de versement suivis. */
export const toPaymentEvent = (payload: unknown): WebhookEvent | null => {
  if (typeof payload === "object" && payload !== null && (payload as { object?: unknown }).object === "v2.core.event") return fromThinEvent(payload);
  const parsed = EventSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { id, type, data, created } = parsed.data;
  const object = data.object;
  const simple = (t: "payment.failed" | "payment.canceled" | "dispute.opened", intentId: string | null): WebhookEvent | null =>
    intentId === null ? null : { id, type: t, intentId };
  switch (type) {
    case "payment_intent.succeeded": {
      const intentId = str(object.id);
      return intentId === null ? null : { id, type: "payment.succeeded", intentId, chargeId: chargeOf(object.latest_charge), ...occurredAtOf(created) };
    }
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
    case "account.updated":
      // Instantané v1 (destination « proofseen-connect ») : pour un compte v2, `payouts_enabled` n'est pas la capacité
      // `stripe_transfers` dont dépendent nos virements. L'événement ne sert que de signal ; l'état se relit en v2.
      return accountSignal(id, str(object.id));
    default:
      return null;
  }
};
