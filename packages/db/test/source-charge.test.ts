import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { chargeToRecord } from "../src/payment-charge";
import { SourceChargeMismatchError, SourceChargeMissingError } from "../src/payment-errors";
import { payments } from "../src/payments";
import { activeContract, type ActiveContract } from "./support/active-contract";
import { chargeOf, DB_STARTUP_MS, fakeGateway, openTestDatabase, PAID_AT, payAndHold, type TestDatabase } from "./support/database";

/*
 * K2 : chaque virement est rattaché à la charge du paiement qui le finance (`source_transaction`). Sans cela, il est
 * pris sur le solde commun de la plateforme : l'argent bloqué d'un client pourrait payer un autre freelance. Une charge
 * inconnue est lue chez le prestataire (lecture seule) et vérifiée avant d'être utilisée ; jamais de virement sans source.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const PROOFSEEN: LegalSnapshot = { legalName: "Proofseen (test)", siret: "12345678900011", vatNumber: "FR12123456789", address: ADDRESS, vatRateBp: 2000 };
const NOW = new Date("2026-11-20T10:00:00Z");

/** Le paiement ouvert mais pas encore confirmé : l'intention existe, la charge n'est pas connue. */
const openOnly = async (recruiter: string, contractId: string, gateway = fakeGateway().gateway): Promise<string> => {
  const opened = await payments(t.db).open({ userId: recruiter }, contractId, gateway);
  if (opened.kind !== "opened") throw new Error(opened.kind);
  return (await t.db.payment.findUniqueOrThrow({ where: { id: opened.paymentId }, select: { stripeIntentId: true } })).stripeIntentId;
};

/** Un paiement confirmé avant ce suivi : bloqué, sans charge ni date d'encaissement (rien ne l'a écrite). */
const legacyHeld = async (c: ActiveContract, gateway = fakeGateway().gateway): Promise<string> => {
  const intent = await openOnly(c.recruiter, c.id, gateway);
  await t.db.payment.update({ where: { stripeIntentId: intent }, data: { status: "held" } });
  return intent;
};

const stateOf = (intent: string) => t.db.payment.findUniqueOrThrow({ where: { stripeIntentId: intent }, select: { status: true, chargeId: true, paidAt: true, needsReviewAt: true, claimedAt: true } });

describe("la charge du paiement est enregistrée au paiement réussi", () => {
  it("garde latest_charge sur le paiement, et la date d'encaissement", async () => {
    const c = await activeContract(t.db);
    const intent = await openOnly(c.recruiter, c.id);
    expect(await payments(t.db).applyEvent({ id: "evt_a", type: "payment.succeeded", intentId: intent, chargeId: "ch_3Abc123" }, NOW)).toBe("applied");
    expect(await stateOf(intent)).toMatchObject({ status: "held", chargeId: "ch_3Abc123", paidAt: NOW, needsReviewAt: null });
  });

  it("date l'encaissement de l'heure de l'événement Stripe, pas de celle de sa réception (rejeu après une panne)", async () => {
    const c = await activeContract(t.db);
    const intent = await openOnly(c.recruiter, c.id);
    const created = new Date("2026-11-17T08:00:00Z");
    await payments(t.db).applyEvent({ id: "evt_late", type: "payment.succeeded", intentId: intent, chargeId: "ch_3Late1", occurredAt: created }, NOW);
    expect((await stateOf(intent)).paidAt).toEqual(created);
  });

  it("n'acquitte jamais dans le futur : une heure d'événement postérieure à la réception est ramenée à celle-ci", async () => {
    const c = await activeContract(t.db);
    const intent = await openOnly(c.recruiter, c.id);
    await payments(t.db).applyEvent({ id: "evt_future", type: "payment.succeeded", intentId: intent, chargeId: "ch_3Fut1", occurredAt: new Date("2027-01-01T00:00:00Z") }, NOW);
    expect((await stateOf(intent)).paidAt).toEqual(NOW);
  });

  it("n'écrase jamais la charge d'un paiement déjà confirmé (événement rejoué sous un autre identifiant)", async () => {
    const c = await activeContract(t.db);
    const intent = await openOnly(c.recruiter, c.id);
    await payments(t.db).applyEvent({ id: "evt_1", type: "payment.succeeded", intentId: intent, chargeId: "ch_first" }, NOW);
    expect(await payments(t.db).applyEvent({ id: "evt_2", type: "payment.succeeded", intentId: intent, chargeId: "ch_other" }, NOW)).toBe("ignored");
    expect((await stateOf(intent)).chargeId).toBe("ch_first");
  });

  it("la base refuse de réécrire une charge connue, et la date d'encaissement", async () => {
    const c = await activeContract(t.db);
    const intent = await payAndHold(t.db, c.recruiter, c.id);
    await expect(t.db.payment.update({ where: { stripeIntentId: intent }, data: { chargeId: "ch_pirate" } })).rejects.toThrow(/charge/);
    await expect(t.db.payment.update({ where: { stripeIntentId: intent }, data: { paidAt: new Date("2020-01-01T00:00:00Z") } })).rejects.toThrow(/date d'encaissement/);
  });
});

describe("un paiement confirmé sans charge est signalé tout de suite, puis complété par l'événement tardif (H2a, M2)", () => {
  it("à la réception sans latest_charge : bloqué, mais à revoir immédiatement", async () => {
    const c = await activeContract(t.db);
    const intent = await openOnly(c.recruiter, c.id);
    await payments(t.db).applyEvent({ id: "evt_nocharge0", type: "payment.succeeded", intentId: intent, chargeId: null }, NOW);
    const state = await stateOf(intent);
    expect(state).toMatchObject({ status: "held", chargeId: null, paidAt: NOW });
    expect(state.needsReviewAt).not.toBeNull();
  });

  it("un événement tardif qui porte la charge complète un paiement bloqué sans charge, sans toucher à sa date", async () => {
    const c = await activeContract(t.db);
    const intent = await openOnly(c.recruiter, c.id);
    await payments(t.db).applyEvent({ id: "evt_first", type: "payment.succeeded", intentId: intent, chargeId: null }, NOW);
    expect(await payments(t.db).applyEvent({ id: "evt_second", type: "payment.succeeded", intentId: intent, chargeId: "ch_3Done1", occurredAt: new Date("2026-11-25T00:00:00Z") }, new Date("2026-11-26T00:00:00Z"))).toBe("applied");
    expect(await stateOf(intent)).toMatchObject({ status: "held", chargeId: "ch_3Done1", paidAt: NOW });
  });

  it("un événement tardif dont la charge appartient à un autre paiement ne la lui donne pas", async () => {
    const a = await activeContract(t.db);
    const b = await activeContract(t.db);
    const intentB = await payAndHold(t.db, b.recruiter, b.id);
    const intentA = await openOnly(a.recruiter, a.id);
    await payments(t.db).applyEvent({ id: "evt_a1", type: "payment.succeeded", intentId: intentA, chargeId: null }, NOW);
    await payments(t.db).applyEvent({ id: "evt_a2", type: "payment.succeeded", intentId: intentA, chargeId: chargeOf(intentB) }, NOW);
    expect((await stateOf(intentA)).chargeId).toBeNull();
  });
});

describe("le virement porte la charge de son propre contrat", () => {
  it("transmet au prestataire la charge du paiement du contrat libéré", async () => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    const intent = await payAndHold(t.db, c.recruiter, c.id, fake.gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    expect(await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).toMatchObject({ kind: "released" });
    expect(fake.sources).toEqual([chargeOf(intent)]);
  });

  it("un contrat A ne peut pas utiliser la charge du contrat B", async () => {
    const a = await activeContract(t.db);
    const b = await activeContract(t.db);
    const fake = fakeGateway();
    const intentA = await payAndHold(t.db, a.recruiter, a.id, fake.gateway);
    const intentB = await payAndHold(t.db, b.recruiter, b.id, fake.gateway);
    await contracts(t.db).complete({ userId: a.recruiter }, a.id);
    await payments(t.db).release(a.id, fake.gateway, PROOFSEEN, NOW);
    // Seul A est libéré : sa charge, jamais celle de B, qui reste intacte et bloquée.
    expect(fake.sources).toEqual([chargeOf(intentA)]);
    expect(fake.sources).not.toContain(chargeOf(intentB));
    expect((await stateOf(intentB)).status).toBe("held");
  });

  it("une charge déjà attribuée à un autre contrat n'est pas rattachée : le paiement attend une revue, aucun virement ne part", async () => {
    const a = await activeContract(t.db);
    const b = await activeContract(t.db);
    const fake = fakeGateway();
    const intentB = await payAndHold(t.db, b.recruiter, b.id, fake.gateway);
    const intentA = await openOnly(a.recruiter, a.id, fake.gateway);
    // Un événement qui prétend que le paiement de A est financé par la charge de B.
    await payments(t.db).applyEvent({ id: "evt_steal", type: "payment.succeeded", intentId: intentA, chargeId: chargeOf(intentB) }, NOW);
    const paymentA = await stateOf(intentA);
    expect(paymentA).toMatchObject({ status: "held", chargeId: null });
    expect(paymentA.needsReviewAt).not.toBeNull();
    await contracts(t.db).complete({ userId: a.recruiter }, a.id);
    await expect(payments(t.db).release(a.id, fake.gateway, PROOFSEEN, NOW)).rejects.toBeInstanceOf(SourceChargeMissingError);
    expect(fake.calls.transfers).toBe(0);
  });
});

describe("sans charge connue, la charge est relue chez le prestataire avant de virer (H2b)", () => {
  it("la retrouve, la vérifie, l'enregistre avec la date de la charge, puis vire avec elle comme source", async () => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    const intent = await legacyHeld(c, fake.gateway);
    expect(await stateOf(intent)).toMatchObject({ chargeId: null, paidAt: null });
    fake.collect(intent);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);

    expect(await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).toMatchObject({ kind: "released" });
    expect(fake.sources).toEqual([chargeOf(intent)]);
    expect(await stateOf(intent)).toMatchObject({ status: "released", chargeId: chargeOf(intent), paidAt: PAID_AT });
    // La date de la charge (lue chez Stripe) sert au rapprochement bancaire ; la facture est acquittée le jour où les fonds
    // sont mis à la disposition du freelance, la libération (20 novembre), et non le jour de la charge (18 novembre).
    expect(await t.db.invoice.findFirstOrThrow({ where: { contractId: c.id, kind: "mission" }, select: { paidOn: true } })).toEqual({ paidOn: new Date("2026-11-20T00:00:00Z") });
  });

  it("refuse sans rien virer quand la lecture échoue : erreur nommée, paiement à revoir", async () => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    const intent = await legacyHeld(c, fake.gateway);
    fake.collect(intent);
    fake.state.failReads = true;
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    const error = await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceChargeMissingError);
    expect(fake.calls.transfers).toBe(0);
    const state = await stateOf(intent);
    expect(state).toMatchObject({ status: "held", chargeId: null, claimedAt: null });
    expect(state.needsReviewAt).not.toBeNull();
  });

  it.each([
    ["l'intention n'est pas encaissée (aucune charge)", undefined],
    ["la charge n'est pas payée", { paid: false }],
    ["la charge appartient à une autre intention", { intentId: "pi_autre" }],
    ["la devise diffère", { currency: "USD" }],
    ["le montant diffère", { amountCents: 1 }],
  ])("ne retient pas la charge quand %s", async (_label, override) => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    const intent = await legacyHeld(c, fake.gateway);
    if (override !== undefined) fake.collect(intent, override);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await expect(payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).rejects.toBeInstanceOf(SourceChargeMissingError);
    expect(fake.calls.transfers).toBe(0);
    expect(await stateOf(intent)).toMatchObject({ status: "held", chargeId: null });
  });

  it("ne retient pas une charge déjà attribuée à un autre paiement", async () => {
    const other = await activeContract(t.db);
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    const intentOther = await payAndHold(t.db, other.recruiter, other.id, fake.gateway);
    const intent = await legacyHeld(c, fake.gateway);
    fake.collect(intent, { chargeId: chargeOf(intentOther) });
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await expect(payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).rejects.toBeInstanceOf(SourceChargeMissingError);
    expect(fake.calls.transfers).toBe(0);
  });
});

describe("la charge connue est vérifiée avant le premier virement (B1)", () => {
  it.each([
    ["l'intention de la charge n'est pas celle du paiement", { intentId: "pi_autre" }],
    ["la devise diffère", { currency: "USD" }],
    ["la charge n'est pas payée", { paid: false }],
    ["le reste après remboursement ne couvre pas le virement", { refundedCents: 700_000 }],
  ])("refuse de virer quand %s", async (_label, override) => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    const intent = await payAndHold(t.db, c.recruiter, c.id, fake.gateway);
    fake.collect(intent, override);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await expect(payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).rejects.toBeInstanceOf(SourceChargeMismatchError);
    expect(fake.calls.transfers).toBe(0);
    const state = await stateOf(intent);
    expect(state).toMatchObject({ status: "held", claimedAt: null });
    expect(state.needsReviewAt).not.toBeNull();
  });

  it("refuse aussi quand la charge ne peut pas être vérifiée", async () => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    await payAndHold(t.db, c.recruiter, c.id, fake.gateway);
    fake.state.failReads = true;
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await expect(payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).rejects.toBeInstanceOf(SourceChargeMissingError);
    expect(fake.calls.transfers).toBe(0);
  });
});

describe("sans charge connue ni retrouvée, pas de virement", () => {
  it("refuse avec une erreur nommée, avant toute réservation et tout virement, et ne produit aucune facture", async () => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    const intent = await openOnly(c.recruiter, c.id, fake.gateway);
    await payments(t.db).applyEvent({ id: "evt_nocharge", type: "payment.succeeded", intentId: intent, chargeId: null }, NOW);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);

    const error = await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceChargeMissingError);
    expect((error as Error).name).toBe("SourceChargeMissingError");
    expect(fake.calls.transfers).toBe(0);
    expect(fake.calls.readiness).toBe(0);
    expect(await stateOf(intent)).toMatchObject({ status: "held", claimedAt: null });
    expect(await t.db.invoice.count({ where: { contractId: c.id } })).toBe(0);
  });
});

describe("la reprise périodique n'est pas affamée par des paiements sans charge (M1)", () => {
  it("51 paiements bloqués sans charge plus un valide : le valide est versé, les autres sortent de la sélection", async () => {
    const base = await activeContract(t.db);
    const snapshots = await t.db.contract.findUniqueOrThrow({ where: { id: base.id }, select: { sellerSnapshot: true, buyerSnapshot: true } });
    for (let i = 0; i < 51; i += 1) {
      const stranded = await t.db.contract.create({
        data: {
          organisationId: base.org, profileId: base.profile, dailyRateCents: 100, days: 1, totalCents: 100, currency: "EUR", commissionBp: 1000,
          sellerSnapshot: snapshots.sellerSnapshot ?? {}, buyerSnapshot: snapshots.buyerSnapshot ?? {}, startsOn: NOW,
          status: "active", acceptedByFreelanceAt: NOW, acceptedByOrgAt: NOW,
        },
        select: { id: true },
      });
      await t.db.payment.create({ data: { contractId: stranded.id, amountCents: 120, commissionCents: 10, currency: "EUR", stripeIntentId: `pi_stranded${i}`, status: "held" } });
      await t.db.contract.update({ where: { id: stranded.id }, data: { status: "completed" } });
    }
    const valid = await activeContract(t.db);
    const fake = fakeGateway();
    const intent = await payAndHold(t.db, valid.recruiter, valid.id, fake.gateway);
    await contracts(t.db).complete({ userId: valid.recruiter }, valid.id);

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const counts = await payments(t.db).releaseDue(fake.gateway, PROOFSEEN, NOW);
      expect(counts.released).toBe(1);
      expect(fake.sources).toEqual([chargeOf(intent)]);
      // Le journal dit le nom de l'erreur, jamais un identifiant ni un montant.
      const lines = log.mock.calls.map((call) => String(call[0]));
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((line) => line.includes("SourceChargeMissingError") && !/pi_|ch_|acct_|\d{3,}/.test(line.replace(/"at":"[^"]*"/, "")))).toBe(true);
    } finally {
      log.mockRestore();
    }
    // Le valide passe en premier (charge connue), puis 49 des 51 sans charge : leur relecture a échoué, ils sont signalés
    // et ne sont plus repris à chaque passage ; les 2 restants sont examinés au passage suivant, et seuls eux.
    const flagged = await t.db.payment.count({ where: { stripeIntentId: { startsWith: "pi_stranded" }, needsReviewAt: { not: null } } });
    expect(flagged).toBe(49);
    const reads = fake.calls.reads;
    await payments(t.db).releaseDue(fake.gateway, PROOFSEEN, NOW);
    expect(fake.calls.reads - reads).toBe(2);
  }, 180_000);
});

describe("l'attribution d'une charge est sérialisée (M1 de la revue base de données)", () => {
  it("prend un verrou consultatif avant de lire à qui appartient la charge", async () => {
    const c = await activeContract(t.db);
    const intent = await openOnly(c.recruiter, c.id);
    const { id } = await t.db.payment.findUniqueOrThrow({ where: { stripeIntentId: intent }, select: { id: true } });
    const locks = await t.db.$transaction(async (tx) => {
      const result = await chargeToRecord(tx, id, "ch_3Lock1");
      const [row] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND granted`;
      return { result, n: row?.n ?? 0 };
    });
    expect(locks.result).toEqual({ chargeId: "ch_3Lock1", conflict: false });
    expect(locks.n).toBeGreaterThanOrEqual(1);
  });
});
