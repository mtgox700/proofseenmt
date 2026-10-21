import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { recipientTransfersActive, stripeGateway, StripeError, STRIPE_V2_VERSION, toPaymentEvent, verifyStripeSignatureWithAny } from "../src/index";

/*
 * Comptes de versement en Accounts v2 (2026-10-21) : Stripe refuse désormais `POST /v1/accounts` pour une nouvelle
 * intégration Connect. Ces tests fixent la forme exacte des appels v2 (JSON, Stripe-Version, idempotence), la lecture
 * de l'état « prêt » et le traitement des événements légers (thin), sans appeler Stripe.
 */

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

const call = (fetchMock: ReturnType<typeof vi.fn>, index = 0) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

const recipient = (status: string, extra: Record<string, unknown> = {}) => ({
  id: "acct_1",
  object: "v2.core.account",
  ...extra,
  configuration: { recipient: { applied: true, capabilities: { stripe_balance: { stripe_transfers: { status, status_details: [] } } } } },
});

describe("création du compte de versement (POST /v2/core/accounts)", () => {
  it("envoie le corps JSON recommandé par Stripe, avec Stripe-Version et la clé d'idempotence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "acct_1Nv0FGQ9RKHgCVdK", object: "v2.core.account" }));
    const gateway = stripeGateway({ secretKey: "rk_test_x" }, fetchMock);
    expect(await gateway.createAccount({ email: "camille@example.com", country: "FR", idempotencyKey: "acct-p1" })).toEqual({ accountId: "acct_1Nv0FGQ9RKHgCVdK" });
    const { url, init, headers } = call(fetchMock);
    expect(url).toBe("https://api.stripe.com/v2/core/accounts");
    expect(init.method).toBe("POST");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["stripe-version"]).toBe("2026-09-30.endive");
    expect(headers["idempotency-key"]).toBe("acct-p1");
    expect(headers.authorization).toBe("Bearer rk_test_x");
    expect(JSON.parse(String(init.body))).toEqual({
      contact_email: "camille@example.com",
      dashboard: "express",
      identity: { country: "FR", entity_type: "individual" },
      defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
    });
  });

  it("n'utilise plus l'API v1 des comptes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "acct_1" }));
    await stripeGateway({ secretKey: "sk_test_x" }, fetchMock).createAccount({ email: "a@example.com", country: "FR", idempotencyKey: "k" });
    expect(call(fetchMock).url).not.toContain("/v1/");
  });

  it("rend une erreur courte, sans le message de Stripe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "détails internes" } }), { status: 400 }));
    const error = await stripeGateway({ secretKey: "sk_test_x" }, fetchMock).createAccount({ email: "a@example.com", country: "FR", idempotencyKey: "k" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StripeError);
    expect(String(error)).not.toContain("détails");
  });

  it("garde la règle des paiements réels : une clé réelle sans feu vert ne crée aucun compte", () => {
    const fetchMock = vi.fn();
    expect(() => stripeGateway({ secretKey: "rk_live_x" }, fetchMock)).toThrow(/GO PAIEMENT LIVE/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("lien d'inscription (POST /v2/core/account_links)", () => {
  it("demande l'inscription du compte avec les adresses de retour et d'expiration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ object: "v2.core.account_link", url: "https://accounts.stripe.com/r/acct_1#alu_test" }));
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    const page = "https://proofseen.com/fr/app/facturation";
    expect(await gateway.onboardingLink({ accountId: "acct_1", returnUrl: `${page}?versement=retour`, refreshUrl: `${page}?versement=expire` })).toEqual({
      url: "https://accounts.stripe.com/r/acct_1#alu_test",
    });
    const { url, init, headers } = call(fetchMock);
    expect(url).toBe("https://api.stripe.com/v2/core/account_links");
    expect(headers["stripe-version"]).toBe(STRIPE_V2_VERSION);
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["idempotency-key"]).toMatch(/^link-acct_1-\d+$/);
    expect(JSON.parse(String(init.body))).toEqual({
      account: "acct_1",
      use_case: { type: "account_onboarding", account_onboarding: { return_url: `${page}?versement=retour`, refresh_url: `${page}?versement=expire` } },
    });
  });
});

describe("compte prêt à recevoir des virements", () => {
  it("relit le compte v2 avec configuration.recipient", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(recipient("active")));
    expect(await stripeGateway({ secretKey: "sk_test_x" }, fetchMock).payoutAccountReady("acct_1")).toBe(true);
    const { url, init, headers } = call(fetchMock);
    expect(url).toBe("https://api.stripe.com/v2/core/accounts/acct_1?include[0]=configuration.recipient");
    expect(init.method ?? "GET").toBe("GET");
    expect(headers["stripe-version"]).toBe(STRIPE_V2_VERSION);
  });

  it("refuse un identifiant qui n'est pas un compte, sans appeler Stripe", async () => {
    const fetchMock = vi.fn();
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    await expect(gateway.payoutAccountReady("acct_1/../../v1/balance")).rejects.toThrow(/invalide/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["active", true],
    ["pending", false],
    ["restricted", false],
    ["rejected", false],
    ["unsupported", false],
  ])("stripe_transfers %s → %s", (status, expected) => {
    expect(recipientTransfersActive(recipient(status))).toBe(expected);
  });

  it("vaut « pas prêt » pour un compte fermé, sans configuration recipient, ou une réponse inattendue", () => {
    expect(recipientTransfersActive(recipient("active", { closed: true }))).toBe(false);
    expect(recipientTransfersActive({ id: "acct_1", configuration: null })).toBe(false);
    expect(recipientTransfersActive({ id: "acct_1" })).toBe(false);
    expect(recipientTransfersActive(null)).toBe(false);
    expect(recipientTransfersActive({ configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 1 } } } } } })).toBe(false);
  });
});

describe("événements légers v2 (thin) des comptes", () => {
  const thin = (type: string, overrides: Record<string, unknown> = {}) => ({
    id: "evt_test_65UIRNU7G1XbhCfOim416TgmEI4ASQ3jHxXt8RFwXoeVwO",
    object: "v2.core.event",
    type,
    livemode: false,
    created: "2026-10-21T10:00:00.000Z",
    context: null,
    related_object: { id: "acct_1T93Q4Pmpb34Vto6", type: "v2.core.account", url: "/v2/core/accounts/acct_1T93Q4Pmpb34Vto6" },
    ...overrides,
  });

  it.each(["v2.core.account[configuration.recipient].capability_status_updated", "v2.core.account[configuration.recipient].updated", "v2.core.account[requirements].updated"])(
    "%s devient un signal de compte, à relire chez Stripe",
    (type) => {
      expect(toPaymentEvent(thin(type))).toEqual({ id: "evt_test_65UIRNU7G1XbhCfOim416TgmEI4ASQ3jHxXt8RFwXoeVwO", type: "account.signal", accountId: "acct_1T93Q4Pmpb34Vto6" });
    },
  );

  it("ignore les autres événements, un autre objet lié, un autre contexte ou une référence mal formée", () => {
    expect(toPaymentEvent(thin("v2.core.account_person.updated"))).toBeNull();
    expect(toPaymentEvent(thin("v2.core.account[requirements].updated", { related_object: { id: "mtr_1", type: "billing.meter" } }))).toBeNull();
    expect(toPaymentEvent(thin("v2.core.account[requirements].updated", { context: "acct_autre" }))).toBeNull();
    expect(toPaymentEvent(thin("v2.core.account[requirements].updated", { related_object: { id: "acct_1/../x", type: "v2.core.account" } }))).toBeNull();
    expect(toPaymentEvent(thin("v2.core.account[requirements].updated", { related_object: null }))).toBeNull();
    expect(toPaymentEvent({ object: "v2.core.event" })).toBeNull();
  });

  it("se vérifie avec le secret de sa propre destination, comme les autres", () => {
    const body = JSON.stringify(thin("v2.core.account[configuration.recipient].capability_status_updated"));
    const now = Date.UTC(2026, 9, 21, 10, 0, 0);
    const t = Math.floor(now / 1000);
    const header = `t=${t},v1=${createHmac("sha256", "whsec_accounts").update(`${t}.${body}`).digest("hex")}`;
    expect(verifyStripeSignatureWithAny(body, header, ["whsec_platform", "whsec_connect", "whsec_accounts"], now)).toMatchObject({ ok: true });
    expect(verifyStripeSignatureWithAny(body, header, ["whsec_platform", "whsec_connect"], now)).toEqual({ ok: false, reason: "signature" });
  });
});

describe("virement au compte v2 (POST /v1/transfers)", () => {
  it("reste un virement v1 vers l'identifiant acct_ du compte, avec son groupe et sa clé d'idempotence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "tr_1" }));
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    expect(await gateway.transfer({ amountCents: 648_000, currency: "EUR", destination: "acct_1Nv0FGQ9RKHgCVdK", contractId: "c-1", idempotencyKey: "release-p1" })).toEqual({ transferId: "tr_1" });
    const { url, init, headers } = call(fetchMock);
    expect(url).toBe("https://api.stripe.com/v1/transfers");
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["idempotency-key"]).toBe("release-p1");
    const form = new URLSearchParams(String(init.body));
    expect(form.get("destination")).toBe("acct_1Nv0FGQ9RKHgCVdK");
    expect(form.get("amount")).toBe("648000");
    expect(form.get("currency")).toBe("eur");
    expect(form.get("transfer_group")).toBe("c-1");
  });
});
