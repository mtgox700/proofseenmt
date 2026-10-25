import { describe, expect, it, vi } from "vitest";
import { SourceChargeMissingError } from "@proofseen/db";
import { stripeGateway } from "../src/index";

/*
 * K2 : un virement est toujours rattaché à la charge du paiement qui le finance (`source_transaction`,
 * https://docs.stripe.com/connect/separate-charges-and-transfers). Sans cela, il est pris sur le solde commun de la
 * plateforme : l'argent d'un client pourrait payer un autre freelance.
 */

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const TRANSFER = { amountCents: 648_000, currency: "EUR", destination: "acct_1Nv0FGQ9RKHgCVdK", contractId: "c-1", idempotencyKey: "release-p1" } as const;

describe("virement rattaché à sa charge", () => {
  it("envoie source_transaction = la charge du contrat dans le corps de la requête", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "tr_1" }));
    await stripeGateway({ secretKey: "sk_test_x" }, fetchMock).transfer({ ...TRANSFER, sourceTransaction: "ch_3Aaa111" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new URLSearchParams(String(init.body)).get("source_transaction")).toBe("ch_3Aaa111");
  });

  it("deux contrats, deux charges : chaque virement porte la charge de son propre contrat, jamais celle de l'autre", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok({ id: "tr_1" })));
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    await gateway.transfer({ ...TRANSFER, contractId: "contrat-A", idempotencyKey: "release-A", sourceTransaction: "ch_A" });
    await gateway.transfer({ ...TRANSFER, contractId: "contrat-B", idempotencyKey: "release-B", sourceTransaction: "ch_B" });
    const forms = fetchMock.mock.calls.map(([, init]) => new URLSearchParams(String((init as RequestInit).body)));
    expect(forms.map((f) => [f.get("transfer_group"), f.get("source_transaction")])).toEqual([
      ["contrat-A", "ch_A"],
      ["contrat-B", "ch_B"],
    ]);
  });

  it.each([
    ["absente", undefined],
    ["vide", ""],
    ["nulle", null],
    ["une intention et non une charge", "pi_3Aaa111"],
    ["un identifiant qui injecte un autre champ", "ch_1&destination=acct_pirate"],
  ])("refuse le virement quand la charge est %s, sans appeler Stripe", async (_label, charge) => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "tr_1" }));
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    const error = await gateway.transfer({ ...TRANSFER, sourceTransaction: charge as unknown as string }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceChargeMissingError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/*
 * Lectures seules (GET) qui servent à retrouver puis vérifier la charge d'un paiement : l'intention avec sa dernière
 * charge développée (https://docs.stripe.com/api/payment_intents/retrieve, paramètre expand), et la charge
 * (https://docs.stripe.com/api/charges/retrieve). Aucune ne crée ni ne modifie rien chez Stripe.
 */
const CHARGE = { id: "ch_3Nv0", payment_intent: "pi_3Nv0", currency: "eur", amount: 720_000, amount_refunded: 1_000, paid: true, created: 1_763_456_789 };
const FACTS = { chargeId: "ch_3Nv0", intentId: "pi_3Nv0", currency: "EUR", amountCents: 720_000, refundedCents: 1_000, paid: true, createdAt: new Date(1_763_456_789_000) };

describe("lecture de l'intention et de sa charge", () => {
  it("relit l'intention avec sa dernière charge développée, en lecture seule, et rend des faits normalisés", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "pi_3Nv0", status: "succeeded", latest_charge: CHARGE }));
    const read = await stripeGateway({ secretKey: "sk_test_x" }, fetchMock).readIntent("pi_3Nv0");
    expect(read).toEqual({ intentId: "pi_3Nv0", status: "succeeded", charge: FACTS });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith("https://api.stripe.com/v1/payment_intents/pi_3Nv0?")).toBe(true);
    expect(new URL(url).searchParams.get("expand[0]")).toBe("latest_charge");
    expect(init.method ?? "GET").toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("sans charge, ou avec une charge non développée, ne rend aucune charge", async () => {
    const none = vi.fn().mockResolvedValue(ok({ id: "pi_3Nv0", status: "requires_payment_method", latest_charge: null }));
    expect((await stripeGateway({ secretKey: "sk_test_x" }, none).readIntent("pi_3Nv0")).charge).toBeNull();
    const bare = vi.fn().mockResolvedValue(ok({ id: "pi_3Nv0", status: "succeeded", latest_charge: "ch_3Nv0" }));
    expect((await stripeGateway({ secretKey: "sk_test_x" }, bare).readIntent("pi_3Nv0")).charge).toBeNull();
  });

  it("relit une charge par son identifiant", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(CHARGE));
    expect(await stripeGateway({ secretKey: "sk_test_x" }, fetchMock).readCharge("ch_3Nv0")).toEqual(FACTS);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://api.stripe.com/v1/charges/ch_3Nv0");
  });

  it.each([["../transfers"], ["pi_1?x=1"], [""], ["ch_1/refunds"]])("refuse l'identifiant %j sans appeler Stripe", async (bad) => {
    const fetchMock = vi.fn();
    const gateway = stripeGateway({ secretKey: "sk_test_x" }, fetchMock);
    await expect(gateway.readIntent(bad)).rejects.toThrow();
    await expect(gateway.readCharge(bad)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rend une réponse sans les champs attendus comme une charge absente plutôt que de deviner", async () => {
    const odd = vi.fn().mockResolvedValue(ok({ id: "pi_3Nv0", status: "succeeded", latest_charge: { id: "ch_3Nv0" } }));
    expect((await stripeGateway({ secretKey: "sk_test_x" }, odd).readIntent("pi_3Nv0")).charge).toBeNull();
  });

  it("rend une erreur courte quand Stripe refuse", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("détails internes", { status: 404 }));
    const error = await stripeGateway({ secretKey: "sk_test_x" }, fetchMock).readCharge("ch_3Nv0").catch((e: unknown) => e);
    expect(String(error)).toBe("StripeError: Stripe HTTP 404");
  });
});
