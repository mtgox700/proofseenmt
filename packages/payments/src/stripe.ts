import type { PaymentGateway } from "@proofseen/db";

/*
 * Adaptateur Stripe (API REST, sans SDK) : intentions de paiement, virements Connect, remboursements.
 *
 * **Mode test uniquement** tant que le founder n'a pas donné son feu vert : une clé `sk_live_` est refusée sauf si
 * `PROOFSEEN_PAYMENTS_LIVE=GO` est posée, ce qui n'arrive que sur décision explicite (« GO PAIEMENT LIVE »).
 *
 * Chaque appel porte une clé d'idempotence : Stripe rend le même objet si la même clé revient, ce qui rend sûrs les
 * réessais après une panne réseau. L'erreur rendue est un code court, jamais la réponse de Stripe.
 */

const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 15_000;

export class StripeError extends Error {
  constructor(readonly status: number) {
    super(`Stripe HTTP ${status}`);
    this.name = "StripeError";
  }
}

const form = (fields: Readonly<Record<string, string | number>>): string =>
  Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

export const stripeGateway = (config: { readonly secretKey: string; readonly live?: boolean }, fetchImpl: typeof fetch = fetch): PaymentGateway => {
  const isTest = config.secretKey.startsWith("sk_test_") || config.secretKey.startsWith("rk_test_");
  const isLive = config.secretKey.startsWith("sk_live_") || config.secretKey.startsWith("rk_live_");
  if (!isTest && !isLive) throw new Error("clé Stripe invalide");
  if (isLive && config.live !== true) throw new Error("clé Stripe réelle refusée : paiements réels non autorisés (GO PAIEMENT LIVE)");

  const post = async (path: string, fields: Readonly<Record<string, string | number>>, idempotencyKey: string): Promise<Record<string, unknown>> => {
    const response = await fetchImpl(`${API}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": idempotencyKey,
      },
      body: form(fields),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new StripeError(response.status);
    return (await response.json()) as Record<string, unknown>;
  };

  const id = (object: Record<string, unknown>, key = "id"): string => {
    const value = object[key];
    if (typeof value !== "string" || value === "") throw new Error(`réponse Stripe sans ${key}`);
    return value;
  };

  return {
    async createIntent({ amountCents, currency, contractId, idempotencyKey }) {
      const intent = await post(
        "/payment_intents",
        {
          amount: amountCents,
          currency: currency.toLowerCase(),
          transfer_group: contractId,
          "metadata[contractId]": contractId,
          "automatic_payment_methods[enabled]": "true",
        },
        idempotencyKey,
      );
      return { intentId: id(intent), clientSecret: id(intent, "client_secret") };
    },

    async transfer({ amountCents, currency, destination, contractId, idempotencyKey }) {
      const transfer = await post(
        "/transfers",
        { amount: amountCents, currency: currency.toLowerCase(), destination, transfer_group: contractId, "metadata[contractId]": contractId },
        idempotencyKey,
      );
      return { transferId: id(transfer) };
    },

    async refund({ intentId, amountCents, idempotencyKey }) {
      const refund = await post("/refunds", { payment_intent: intentId, amount: amountCents }, idempotencyKey);
      return { refundId: id(refund) };
    },
  };
};

/** Le prestataire configuré par l'environnement, ou `null` : sans clé, aucun paiement ne s'ouvre. */
export const gatewayFromEnv = (env: Readonly<Record<string, string | undefined>>): PaymentGateway | null => {
  const secretKey = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (secretKey === "") return null;
  return stripeGateway({ secretKey, live: env.PROOFSEEN_PAYMENTS_LIVE === "GO" });
};
