import { isSourceCharge, SourceChargeMissingError, type PaymentGateway } from "@proofseen/db";
import { chargeFacts } from "./charges";
import { ACCOUNT_ID, onboardingLinkBody, recipientAccountBody, recipientTransfersActive, STRIPE_V2_VERSION } from "./connect";

/*
 * Adaptateur Stripe (API REST, sans SDK) : intentions de paiement, virements Connect, remboursements.
 *
 * **Mode test uniquement** tant que le founder n'a pas donné son feu vert : une clé `sk_live_` est refusée sauf si
 * `PROOFSEEN_PAYMENTS_LIVE=GO` est posée, ce qui n'arrive que sur décision explicite (« GO PAIEMENT LIVE »).
 *
 * Chaque appel porte une clé d'idempotence : Stripe rend le même objet si la même clé revient, ce qui rend sûrs les
 * réessais après une panne réseau. L'erreur rendue est un code court, jamais la réponse de Stripe.
 *
 * Les comptes de versement passent par l'API v2 (JSON, `Stripe-Version`, voir `connect.ts`) ; paiements, virements et
 * remboursements restent en v1 : `/v1/transfers` accepte un compte v2 en `destination` dès que sa capacité
 * `stripe_balance.stripe_transfers` est active (« Enables this Account to receive /v1/transfers »,
 * https://docs.stripe.com/api/v2/core/accounts/create).
 */

const API = "https://api.stripe.com/v1";
const API_V2 = "https://api.stripe.com/v2";
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

  const get = async (path: string): Promise<Record<string, unknown>> => {
    const response = await fetchImpl(`${API}${path}`, {
      headers: { authorization: `Bearer ${config.secretKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new StripeError(response.status);
    return (await response.json()) as Record<string, unknown>;
  };

  const postV2 = async (path: string, body: Readonly<Record<string, unknown>>, idempotencyKey: string): Promise<Record<string, unknown>> => {
    const response = await fetchImpl(`${API_V2}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.secretKey}`,
        "content-type": "application/json",
        "stripe-version": STRIPE_V2_VERSION,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new StripeError(response.status);
    return (await response.json()) as Record<string, unknown>;
  };

  const getV2 = async (path: string): Promise<unknown> => {
    const response = await fetchImpl(`${API_V2}${path}`, {
      headers: { authorization: `Bearer ${config.secretKey}`, "stripe-version": STRIPE_V2_VERSION },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new StripeError(response.status);
    return (await response.json()) as unknown;
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

    async transfer({ amountCents, currency, destination, contractId, idempotencyKey, sourceTransaction }) {
      // Jamais de virement sans source : sans `source_transaction`, Stripe puise dans le solde commun de la plateforme
      // (https://docs.stripe.com/connect/separate-charges-and-transfers). Refus avant tout appel réseau.
      if (!isSourceCharge(sourceTransaction)) throw new SourceChargeMissingError();
      const transfer = await post(
        "/transfers",
        {
          amount: amountCents,
          currency: currency.toLowerCase(),
          destination,
          transfer_group: contractId,
          source_transaction: sourceTransaction,
          "metadata[contractId]": contractId,
        },
        idempotencyKey,
      );
      return { transferId: id(transfer) };
    },

    async refund({ intentId, amountCents, idempotencyKey }) {
      const refund = await post("/refunds", { payment_intent: intentId, amount: amountCents }, idempotencyKey);
      return { refundId: id(refund) };
    },

    async intentSecret(intentId) {
      if (!/^pi_[A-Za-z0-9]+$/.test(intentId)) throw new Error("intention invalide");
      return id(await get(`/payment_intents/${intentId}`), "client_secret");
    },

    // Lectures seules : retrouver puis vérifier la charge d'un paiement. Elles ne créent ni ne modifient rien chez Stripe.
    async readIntent(intentId) {
      if (!/^pi_[A-Za-z0-9]+$/.test(intentId)) throw new Error("intention invalide");
      const intent = await get(`/payment_intents/${intentId}?expand[0]=latest_charge`);
      const status = intent.status;
      if (typeof status !== "string") throw new Error("réponse Stripe sans status");
      // Sans le développement demandé, `latest_charge` n'est qu'un identifiant : pas de faits, donc pas de charge retenue.
      return { intentId: id(intent), status, charge: chargeFacts(intent.latest_charge) };
    },

    async readCharge(chargeId) {
      if (!isSourceCharge(chargeId)) throw new Error("charge invalide");
      const facts = chargeFacts(await get(`/charges/${chargeId}`));
      if (facts === null) throw new Error("réponse Stripe sans charge exploitable");
      return facts;
    },

    async findTransfer(contractId) {
      const list = await get(`/transfers?limit=1&transfer_group=${encodeURIComponent(contractId)}`);
      const [first] = Array.isArray(list.data) ? (list.data as Record<string, unknown>[]) : [];
      return first === undefined ? null : id(first);
    },

    async createAccount({ email, country, idempotencyKey }) {
      const account = await postV2("/core/accounts", recipientAccountBody(email, country), idempotencyKey);
      return { accountId: id(account) };
    },

    async onboardingLink({ accountId, returnUrl, refreshUrl }) {
      const link = await postV2("/core/account_links", onboardingLinkBody(accountId, returnUrl, refreshUrl), `link-${accountId}-${Date.now()}`);
      return { url: id(link, "url") };
    },

    async payoutAccountReady(accountId) {
      if (!ACCOUNT_ID.test(accountId)) throw new Error("compte invalide");
      // `configuration` n'est rendu que s'il est demandé ; un tableau en paramètre de requête porte toujours son indice.
      return recipientTransfersActive(await getV2(`/core/accounts/${accountId}?include[0]=configuration.recipient`));
    },
  };
};

/** Le prestataire configuré par l'environnement, ou `null` : sans clé, aucun paiement ne s'ouvre. */
/**
 * Vrai quand les paiements tournent en bac à sable : une clé de test (`sk_test_` ou `rk_test_`) et aucun feu vert des
 * paiements réels. Sans clé, ou avec une clé réelle, c'est faux : les règles des paiements réels s'appliquent.
 */
export const paymentsSandbox = (env: Readonly<Record<string, string | undefined>>): boolean => {
  const secretKey = (env.STRIPE_SECRET_KEY ?? "").trim();
  const test = secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
  return test && env.PROOFSEEN_PAYMENTS_LIVE !== "GO";
};

export const gatewayFromEnv = (env: Readonly<Record<string, string | undefined>>): PaymentGateway | null => {
  const secretKey = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (secretKey === "") return null;
  return stripeGateway({ secretKey, live: env.PROOFSEEN_PAYMENTS_LIVE === "GO" });
};
