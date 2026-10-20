import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { gatewayFromEnv, paymentsSandbox, stripeGateway, StripeError, toPaymentEvent, verifyStripeSignature, verifyStripeSignatureWithAny } from "../src/index";

const SECRET = "whsec_test_secret";
const NOW_MS = Date.UTC(2026, 10, 20, 10, 0, 0);
const NOW_S = Math.floor(NOW_MS / 1000);

const sign = (body: string, timestamp = NOW_S, secret = SECRET): string => `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

const event = (type: string, object: Record<string, unknown>, id = "evt_1") => JSON.stringify({ id, type, data: { object } });

describe("signature des webhooks", () => {
  it("accepte un événement signé et récent", () => {
    const body = event("payment_intent.succeeded", { id: "pi_1" });
    expect(verifyStripeSignature(body, sign(body), SECRET, NOW_MS)).toMatchObject({ ok: true });
  });

  it("refuse un corps modifié, un mauvais secret, une signature absente", () => {
    const body = event("payment_intent.succeeded", { id: "pi_1" });
    expect(verifyStripeSignature(body.replace("pi_1", "pi_2"), sign(body), SECRET, NOW_MS)).toEqual({ ok: false, reason: "signature" });
    expect(verifyStripeSignature(body, sign(body, NOW_S, "whsec_autre"), SECRET, NOW_MS)).toEqual({ ok: false, reason: "signature" });
    expect(verifyStripeSignature(body, null, SECRET, NOW_MS)).toEqual({ ok: false, reason: "signature" });
    expect(verifyStripeSignature(body, "t=abc,v1=", SECRET, NOW_MS)).toEqual({ ok: false, reason: "signature" });
  });

  it("refuse un événement correctement signé mais trop ancien : on ne le rejoue pas indéfiniment", () => {
    const body = event("payment_intent.succeeded", { id: "pi_1" });
    expect(verifyStripeSignature(body, sign(body, NOW_S - 301), SECRET, NOW_MS)).toEqual({ ok: false, reason: "expired" });
  });

  it("accepte l'une des signatures quand Stripe en envoie plusieurs (rotation du secret)", () => {
    const body = event("payment_intent.succeeded", { id: "pi_1" });
    const header = `t=${NOW_S},v1=${"0".repeat(64)},${sign(body).split(",")[1]}`;
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toMatchObject({ ok: true });
  });
});

describe("traduction des événements", () => {
  it.each([
    ["payment_intent.succeeded", { id: "pi_1" }, { type: "payment.succeeded", intentId: "pi_1" }],
    ["payment_intent.payment_failed", { id: "pi_1" }, { type: "payment.failed", intentId: "pi_1" }],
    // Montant remboursé cumulé : un remboursement partiel reste partiel.
    ["charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 1500 }, { type: "refund.updated", intentId: "pi_1", amountRefundedCents: 1500 }],
    ["charge.dispute.created", { id: "dp_1", payment_intent: "pi_1" }, { type: "dispute.opened", intentId: "pi_1" }],
    ["charge.dispute.closed", { id: "dp_1", payment_intent: "pi_1", status: "lost" }, { type: "dispute.closed", intentId: "pi_1", won: false }],
    ["charge.dispute.closed", { id: "dp_1", payment_intent: "pi_1", status: "won" }, { type: "dispute.closed", intentId: "pi_1", won: true }],
    ["account.updated", { id: "acct_1", payouts_enabled: true }, { type: "account.updated", accountId: "acct_1", payoutsEnabled: true }],
  ])("%s", (type, object, expected) => {
    expect(toPaymentEvent(JSON.parse(event(type, object)))).toEqual({ id: "evt_1", ...expected });
  });

  it("ignore ce qui ne concerne pas un paiement suivi", () => {
    expect(toPaymentEvent(JSON.parse(event("customer.created", { id: "cus_1" })))).toBeNull();
    expect(toPaymentEvent(JSON.parse(event("charge.dispute.closed", { payment_intent: "pi_1", status: "warning_closed" })))).toBeNull();
    expect(toPaymentEvent({ nimporte: "quoi" })).toBeNull();
  });
});

describe("adaptateur Stripe", () => {
  it("refuse une clé réelle sans feu vert explicite, et une clé mal formée", () => {
    expect(() => stripeGateway({ secretKey: "sk_live_x" })).toThrow(/GO PAIEMENT LIVE/);
    expect(() => stripeGateway({ secretKey: "pas-une-cle" })).toThrow(/invalide/);
    expect(gatewayFromEnv({})).toBeNull();
    expect(() => gatewayFromEnv({ STRIPE_SECRET_KEY: "sk_live_x" })).toThrow(/GO PAIEMENT LIVE/);
  });

  it("envoie l'intention avec sa clé d'idempotence et son groupe de virement", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "pi_1", client_secret: "pi_1_secret" }), { status: 200 }));
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    expect(await gateway.createIntent({ amountCents: 720_000, currency: "EUR", contractId: "c-1", idempotencyKey: "pay-c-1-1" })).toEqual({ intentId: "pi_1", clientSecret: "pi_1_secret" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("https://api.stripe.com/v1/payment_intents");
    expect(headers["idempotency-key"]).toBe("pay-c-1-1");
    expect(headers.authorization).toBe("Bearer sk_test_x");
    expect(new URLSearchParams(String(init.body)).get("amount")).toBe("720000");
    expect(new URLSearchParams(String(init.body)).get("currency")).toBe("eur");
    expect(new URLSearchParams(String(init.body)).get("transfer_group")).toBe("c-1");
  });

  it("rend une erreur courte, sans le contenu de la réponse", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("détails internes de Stripe", { status: 402 }));
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    const error = await gateway.transfer({ amountCents: 1, currency: "EUR", destination: "acct_1", contractId: "c-1", idempotencyKey: "k" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StripeError);
    expect(String(error)).not.toContain("détails");
  });
});

describe("deux endpoints, deux secrets (plateforme et comptes connectés)", () => {
  const body = JSON.stringify({ id: "evt_1", type: "account.updated", data: { object: { id: "acct_1", payouts_enabled: true } } });
  const CONNECT = "whsec_connect";

  it("accepte un événement signé par l'un ou l'autre secret", () => {
    expect(verifyStripeSignatureWithAny(body, sign(body), [SECRET, CONNECT], NOW_MS)).toMatchObject({ ok: true });
    expect(verifyStripeSignatureWithAny(body, sign(body, NOW_S, CONNECT), [SECRET, CONNECT], NOW_MS)).toMatchObject({ ok: true });
  });

  it("refuse un événement signé par aucun, ou trop ancien, et ignore un secret vide", () => {
    expect(verifyStripeSignatureWithAny(body, sign(body, NOW_S, "whsec_autre"), [SECRET, CONNECT], NOW_MS)).toEqual({ ok: false, reason: "signature" });
    expect(verifyStripeSignatureWithAny(body, sign(body, NOW_S - 3600, CONNECT), [SECRET, CONNECT], NOW_MS)).toEqual({ ok: false, reason: "expired" });
    expect(verifyStripeSignatureWithAny(body, sign(body), ["", ""], NOW_MS)).toEqual({ ok: false, reason: "signature" });
  });
});

describe("bac à sable des paiements", () => {
  it("une clé de test sans feu vert réel ; jamais sans clé ni avec une clé réelle", () => {
    expect(paymentsSandbox({ STRIPE_SECRET_KEY: "rk_test_abc" })).toBe(true);
    expect(paymentsSandbox({ STRIPE_SECRET_KEY: "sk_test_abc" })).toBe(true);
    expect(paymentsSandbox({ STRIPE_SECRET_KEY: "sk_test_abc", PROOFSEEN_PAYMENTS_LIVE: "GO" })).toBe(false);
    expect(paymentsSandbox({ STRIPE_SECRET_KEY: "rk_live_abc", PROOFSEEN_PAYMENTS_LIVE: "GO" })).toBe(false);
    expect(paymentsSandbox({})).toBe(false);
  });
});
