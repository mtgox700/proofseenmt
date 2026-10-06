import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { payments, type PaymentGateway } from "../src/payments";
import { quotes } from "../src/quotes";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const PROOFSEEN: LegalSnapshot = { legalName: "Proofseen (test)", siret: "12345678900011", vatNumber: null, address: ADDRESS, vatRateBp: 2000 };
const NOW = new Date("2026-11-20T10:00:00Z");
/** Taux d'essai : le vrai taux est une décision du founder. */
const COMMISSION_BP = 1000;

/** Prestataire simulé : rend des identifiants stables par clé d'idempotence, comme le fait Stripe, et compte ses appels. */
const fakeGateway = () => {
  const calls = { intents: 0, transfers: 0, refunds: 0 };
  const byKey = new Map<string, string>();
  const stable = (prefix: string, key: string) => {
    const known = byKey.get(key);
    if (known !== undefined) return known;
    const id = `${prefix}_${byKey.size + 1}${Math.random().toString(36).slice(2, 8)}`;
    byKey.set(key, id);
    return id;
  };
  const gateway: PaymentGateway = {
    async createIntent({ idempotencyKey }) {
      calls.intents += 1;
      const intentId = stable("pi", idempotencyKey);
      return { intentId, clientSecret: `${intentId}_secret` };
    },
    async transfer({ idempotencyKey }) {
      calls.transfers += 1;
      return { transferId: stable("tr", idempotencyKey) };
    },
    async refund({ idempotencyKey }) {
      calls.refunds += 1;
      return { refundId: stable("re", idempotencyKey) };
    },
  };
  return { gateway, calls, transferAmounts: [] as number[] };
};

/** Un contrat actif de 10 jours à 600 € HT ; le freelance facture la TVA à 20 % et a un compte de versement si demandé. */
const activeContract = async (withAccount = true) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { legalName: "Camille Test EI", address: ADDRESS, vatRateBp: 2000 });
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", address: ADDRESS });
  if (withAccount) await t.db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}` } });
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-11-02" });
  if (created.kind !== "created") throw new Error(created.kind);
  await contracts(t.db).sign({ userId: recruiter }, created.contract.id, NOW);
  await contracts(t.db).sign({ userId: freelanceUser }, created.contract.id, NOW);
  return { id: created.contract.id, recruiter, freelanceUser };
};

const intentOf = async (contractId: string) => (await t.db.payment.findFirstOrThrow({ where: { contractId }, select: { stripeIntentId: true } })).stripeIntentId;

describe("parcours séquestre complet", () => {
  it("paie le TTC, bloque, valide, vire le montant moins la commission TTC, émet les deux factures", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();

    const opened = await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    expect(opened).toMatchObject({ kind: "opened", amountCents: 720_000, commissionCents: 60_000 });
    expect(await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP)).toEqual({ kind: "already_paid" });

    const intentId = await intentOf(c.id);
    expect(await payments(t.db).applyEvent({ id: "evt_1", type: "payment.succeeded", intentId })).toBe("applied");
    // Stripe renvoie le même événement : il n'est compté qu'une fois.
    expect(await payments(t.db).applyEvent({ id: "evt_1", type: "payment.succeeded", intentId })).toBe("duplicate");
    expect(await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW)).toEqual({ kind: "not_releasable" });

    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    const released = await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW);
    expect(released).toMatchObject({ kind: "released" });
    // Relancer la libération ne vire pas deux fois et n'émet pas d'autres factures.
    const again = await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW);
    expect(again).toEqual(released);
    expect(calls).toEqual({ intents: 1, transfers: 1, refunds: 0 });

    const payment = await t.db.payment.findFirstOrThrow({ where: { contractId: c.id }, select: { status: true, transferId: true } });
    expect(payment.status).toBe("released");
    expect(await t.db.invoice.count({ where: { contractId: c.id } })).toBe(2);
  });

  it("vire exactement le montant payé moins la commission et sa TVA", async () => {
    const c = await activeContract();
    let transferred = 0;
    const { gateway } = fakeGateway();
    const spy: PaymentGateway = { ...gateway, transfer: async (input) => ((transferred = input.amountCents), gateway.transfer(input)) };
    await payments(t.db).open({ userId: c.recruiter }, c.id, spy, COMMISSION_BP);
    await payments(t.db).applyEvent({ id: `evt_${c.id}`, type: "payment.succeeded", intentId: await intentOf(c.id) });
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await payments(t.db).release(c.id, spy, PROOFSEEN, NOW);
    // 720 000 payés − (60 000 de commission + 12 000 de TVA sur la commission)
    expect(transferred).toBe(648_000);
  });
});

describe("événements dans le désordre et cas d'échec", () => {
  it("ignore un événement qui n'a plus de sens, et suit un litige jusqu'au remboursement", async () => {
    const c = await activeContract();
    const { gateway } = fakeGateway();
    await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    const intentId = await intentOf(c.id);

    expect(await payments(t.db).applyEvent({ id: "evt_d0", type: "dispute.opened", intentId })).toBe("ignored");
    expect(await payments(t.db).applyEvent({ id: "evt_s", type: "payment.succeeded", intentId })).toBe("applied");
    expect(await payments(t.db).applyEvent({ id: "evt_f", type: "payment.failed", intentId })).toBe("ignored");
    expect(await payments(t.db).applyEvent({ id: "evt_d1", type: "dispute.opened", intentId })).toBe("applied");
    expect(await payments(t.db).applyEvent({ id: "evt_d2", type: "dispute.lost", intentId })).toBe("applied");
    expect(await t.db.payment.findFirstOrThrow({ where: { contractId: c.id }, select: { status: true, refundedCents: true } })).toEqual({ status: "refunded", refundedCents: 720_000 });
    expect(await payments(t.db).applyEvent({ id: "evt_x", type: "payment.succeeded", intentId: "pi_inconnu" })).toBe("ignored");
  });

  it("garde les fonds bloqués tant que le freelance n'a pas de compte de versement", async () => {
    const c = await activeContract(false);
    const { gateway, calls } = fakeGateway();
    await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    await payments(t.db).applyEvent({ id: `evt_${c.id}`, type: "payment.succeeded", intentId: await intentOf(c.id) });
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    expect(await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW)).toEqual({ kind: "account_missing" });
    expect(calls.transfers).toBe(0);
    expect((await t.db.payment.findFirstOrThrow({ where: { contractId: c.id }, select: { status: true } })).status).toBe("held");
  });

  it("rembourse un paiement bloqué, et ne rembourse jamais deux fois", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();
    await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    await payments(t.db).applyEvent({ id: `evt_${c.id}`, type: "payment.succeeded", intentId: await intentOf(c.id) });
    expect(await payments(t.db).refundHeld(c.id, gateway)).toBe(true);
    expect(await payments(t.db).refundHeld(c.id, gateway)).toBe(false);
    expect(calls.refunds).toBe(1);
  });
});

describe("accès et configuration", () => {
  it("refuse d'ouvrir un paiement sans taux de commission configuré, ou pour un tiers", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();
    await expect(payments(t.db).open({ userId: c.recruiter }, c.id, gateway, Number.NaN)).rejects.toThrow(/commission/);
    expect(await payments(t.db).open({ userId: c.freelanceUser }, c.id, gateway, COMMISSION_BP)).toEqual({ kind: "absent" });
    expect(await payments(t.db).open({ userId: await createUser(t.db) }, c.id, gateway, COMMISSION_BP)).toEqual({ kind: "absent" });
    expect(calls.intents).toBe(0);
  });

  it("montre la commission au freelance, jamais à l'entreprise", async () => {
    const c = await activeContract();
    const { gateway } = fakeGateway();
    await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    expect(await payments(t.db).find({ userId: c.freelanceUser }, c.id)).toMatchObject({ commissionCents: 60_000 });
    expect(await payments(t.db).find({ userId: c.recruiter }, c.id)).toMatchObject({ commissionCents: null, amountCents: 720_000 });
    expect(await payments(t.db).find({ userId: await createUser(t.db) }, c.id)).toBeNull();
  });
});
