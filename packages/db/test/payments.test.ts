import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { payments } from "../src/payments";
import { quotes } from "../src/quotes";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, openTestDatabase, payAndHold, type TestDatabase, verifiedVigilance, nextSiret } from "./support/database";

/*
 * Le séquestre, y compris chaque scénario de la revue de sécurité du 2026-10-06 : un paiement retenté après un échec,
 * un litige ou un remboursement arrivé dans le désordre ou après le versement, une validation sans paiement, un
 * versement et un remboursement simultanés, un appel au prestataire qui échoue au milieu.
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
/** Taux d'essai : le vrai taux est une décision du founder. */
const COMMISSION_BP = 1000;

/** Un contrat actif de 10 jours à 600 € HT ; le freelance facture 20 % de TVA et peut recevoir des versements si demandé. */
const activeContract = async (opts: { payouts?: boolean; dailyRateCents?: number; days?: number } = {}) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", address: ADDRESS });
  if (opts.payouts !== false) {
    await t.db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: NOW } });
  }
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: opts.dailyRateCents ?? 60_000, days: opts.days ?? 10 });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-11-02" });
  if (created.kind !== "created") throw new Error(created.kind);
  await contracts(t.db).sign({ userId: recruiter }, created.contract.id, NOW);
  await contracts(t.db).sign({ userId: freelanceUser }, created.contract.id, NOW);
  return { id: created.contract.id, recruiter, freelanceUser, org, profile };
};

const paymentOf = (contractId: string) =>
  t.db.payment.findFirstOrThrow({ where: { contractId }, select: { status: true, refundedCents: true, needsReviewAt: true, stripeIntentId: true } });

describe("parcours séquestre complet", () => {
  it("paie le TTC, bloque, valide, vire le montant moins la commission TTC, émet les deux factures, une seule fois", async () => {
    const c = await activeContract();
    const { gateway, calls, amounts } = fakeGateway();
    const opened = await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    expect(opened).toMatchObject({ kind: "opened", amountCents: 720_000, commissionCents: 60_000 });
    const { stripeIntentId } = await paymentOf(c.id);

    expect(await payments(t.db).applyEvent({ id: "evt_1", type: "payment.succeeded", intentId: stripeIntentId }, NOW)).toBe("applied");
    expect(await payments(t.db).applyEvent({ id: "evt_1", type: "payment.succeeded", intentId: stripeIntentId }, NOW)).toBe("duplicate");
    expect(await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP)).toEqual({ kind: "already_paid" });

    expect((await contracts(t.db).complete({ userId: c.recruiter }, c.id)).kind).toBe("completed");
    const released = await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW);
    expect(released).toMatchObject({ kind: "released" });
    expect(await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW)).toEqual(released);
    expect(calls).toMatchObject({ intents: 1, transfers: 1, refunds: 0 });
    // 720 000 payés − (60 000 de commission + 12 000 de TVA sur la commission)
    expect(amounts).toEqual([648_000]);
    expect(await t.db.invoice.count({ where: { contractId: c.id } })).toBe(2);
  });
});

describe("scénarios de la revue de sécurité", () => {
  it("un paiement en échec puis réussi au second essai est bloqué, sans second paiement", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();
    await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    const { stripeIntentId } = await paymentOf(c.id);
    await payments(t.db).applyEvent({ id: "evt_fail", type: "payment.failed", intentId: stripeIntentId }, NOW);
    // L'entreprise revient : on reprend la même intention, on n'en ouvre pas une seconde.
    expect(await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP)).toMatchObject({ kind: "resumed" });
    await payments(t.db).applyEvent({ id: "evt_ok", type: "payment.succeeded", intentId: stripeIntentId }, NOW);
    expect((await paymentOf(c.id)).status).toBe("held");
    expect(calls.intents).toBe(1);
    expect(await t.db.payment.count({ where: { contractId: c.id } })).toBe(1);
  });

  it("un litige arrivé avant le paiement bloque le versement jusqu'à ce qu'il soit gagné", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();
    await payments(t.db).open({ userId: c.recruiter }, c.id, gateway, COMMISSION_BP);
    const { stripeIntentId } = await paymentOf(c.id);
    expect(await payments(t.db).applyEvent({ id: "evt_d", type: "dispute.opened", intentId: stripeIntentId }, NOW)).toBe("applied");
    await payments(t.db).applyEvent({ id: "evt_s", type: "payment.succeeded", intentId: stripeIntentId }, NOW);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    expect(await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW)).toEqual({ kind: "blocked" });
    expect(calls.transfers).toBe(0);
    await payments(t.db).applyEvent({ id: "evt_w", type: "dispute.closed", intentId: stripeIntentId, won: true }, NOW);
    expect(await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW)).toMatchObject({ kind: "released" });
  });

  it("un litige ou un remboursement après le versement est enregistré et marqué à revoir, jamais ignoré", async () => {
    const c = await activeContract();
    const { gateway } = fakeGateway();
    const intent = await payAndHold(t.db, c.recruiter, c.id, gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW);
    expect(await payments(t.db).applyEvent({ id: "evt_late", type: "dispute.opened", intentId: intent }, NOW)).toBe("applied");
    const after = await paymentOf(c.id);
    expect(after.status).toBe("released");
    expect(after.needsReviewAt).not.toBeNull();
  });

  it("un remboursement partiel n'est pas pris pour un total, et bloque le versement", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();
    const intent = await payAndHold(t.db, c.recruiter, c.id, gateway);
    await payments(t.db).applyEvent({ id: "evt_r1", type: "refund.updated", intentId: intent, amountRefundedCents: 100_000 }, NOW);
    expect(await paymentOf(c.id)).toMatchObject({ status: "held", refundedCents: 100_000 });
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    expect(await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW)).toEqual({ kind: "blocked" });
    expect(calls.transfers).toBe(0);
    await payments(t.db).applyEvent({ id: "evt_r2", type: "refund.updated", intentId: intent, amountRefundedCents: 720_000 }, NOW);
    expect((await paymentOf(c.id)).status).toBe("refunded");
  });

  it("ne valide pas une prestation sans fonds bloqués, et la base le refuse aussi", async () => {
    const c = await activeContract();
    expect(await contracts(t.db).complete({ userId: c.recruiter }, c.id)).toEqual({ kind: "not_paid" });
    await expect(t.db.contract.update({ where: { id: c.id }, data: { status: "completed" } })).rejects.toThrow();
  });

  it("réserve la validation aux administrateurs, jamais au freelance, même ajouté comme membre", async () => {
    const c = await activeContract();
    await payAndHold(t.db, c.recruiter, c.id);
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: member, role: "member" } });
    expect(await contracts(t.db).complete({ userId: member }, c.id)).toEqual({ kind: "absent" });
    await expect(t.db.membership.create({ data: { organisationId: c.org, userId: c.freelanceUser, role: "admin" } })).rejects.toThrow();
    expect(await contracts(t.db).complete({ userId: c.freelanceUser }, c.id)).toEqual({ kind: "absent" });
  });

  it("ne rembourse pas et ne vire pas à la fois : un seul des deux gagne", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();
    await payAndHold(t.db, c.recruiter, c.id, gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    const [release, refund] = await Promise.all([payments(t.db).release(c.id, gateway, PROOFSEEN, NOW), payments(t.db).refundHeld(c.id, gateway, NOW)]);
    expect(calls.transfers + calls.refunds).toBe(1);
    expect(release.kind === "released").toBe(!refund);
  });

  it("rend la réservation quand le virement échoue, et le reprend plus tard sans doubler", async () => {
    const c = await activeContract();
    const fake = fakeGateway();
    await payAndHold(t.db, c.recruiter, c.id, fake.gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    fake.state.failNextTransfer = true;
    await expect(payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).rejects.toThrow();
    expect((await paymentOf(c.id)).status).toBe("held");
    expect(await payments(t.db).releaseDue(fake.gateway, PROOFSEEN, NOW)).toMatchObject({ released: 1 });
    expect(fake.calls.transfers).toBe(1);
  });

  it("garde les fonds bloqués tant que le compte de versement n'est pas confirmé par le prestataire", async () => {
    const c = await activeContract({ payouts: false });
    const fake = fakeGateway();
    await payAndHold(t.db, c.recruiter, c.id, fake.gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    expect(await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).toEqual({ kind: "account_missing" });

    const link = await payments(t.db).payoutAccount({ userId: c.freelanceUser }, fake.gateway, { returnUrl: "https://x/r", refreshUrl: "https://x/f" });
    expect(link).toMatchObject({ kind: "link" });
    await payments(t.db).payoutAccount({ userId: c.freelanceUser }, fake.gateway, { returnUrl: "https://x/r", refreshUrl: "https://x/f" });
    expect(fake.calls.accounts).toBe(1);
    const { stripeAccountId } = await t.db.billingIdentity.findUniqueOrThrow({ where: { profileId: c.profile }, select: { stripeAccountId: true } });
    await payments(t.db).applyEvent({ id: `evt_acct_${c.id}`, type: "account.updated", accountId: stripeAccountId ?? "", payoutsEnabled: true }, NOW);
    expect(await payments(t.db).releaseDue(fake.gateway, PROOFSEEN, NOW)).toMatchObject({ released: 1 });
  });

  it("relit le compte chez le prestataire avant de verser : pas prêt, rien ne part et l'état local est corrigé", async () => {
    const c = await activeContract();
    const fake = fakeGateway();
    await payAndHold(t.db, c.recruiter, c.id, fake.gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    const enabledAt = () => t.db.billingIdentity.findUniqueOrThrow({ where: { profileId: c.profile }, select: { payoutsEnabledAt: true } }).then((b) => b.payoutsEnabledAt);

    fake.state.payoutReady = false;
    expect(await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).toEqual({ kind: "account_missing" });
    expect(fake.calls.transfers).toBe(0);
    expect((await paymentOf(c.id)).status).toBe("held");
    expect(await enabledAt()).toBeNull();

    fake.state.payoutReady = true;
    expect(await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, NOW)).toMatchObject({ kind: "released" });
    expect(fake.calls.transfers).toBe(1);
    expect(await enabledAt()).toEqual(NOW);
  });

  it("au retour sur la facturation, confirme un compte ouvert chez le prestataire, une seule fois", async () => {
    const c = await activeContract({ payouts: false });
    const fake = fakeGateway();
    expect(await payments(t.db).confirmPayoutAccount({ userId: c.freelanceUser }, fake.gateway, NOW)).toBeNull();
    expect(fake.calls.readiness).toBe(0);

    await payments(t.db).payoutAccount({ userId: c.freelanceUser }, fake.gateway, { returnUrl: "https://x/r", refreshUrl: "https://x/f" });
    fake.state.payoutReady = false;
    expect(await payments(t.db).confirmPayoutAccount({ userId: c.freelanceUser }, fake.gateway, NOW)).toBe(false);
    fake.state.payoutReady = true;
    expect(await payments(t.db).confirmPayoutAccount({ userId: c.freelanceUser }, fake.gateway, NOW)).toBe(true);
    const { payoutsEnabledAt } = await t.db.billingIdentity.findUniqueOrThrow({ where: { profileId: c.profile }, select: { payoutsEnabledAt: true } });
    expect(payoutsEnabledAt).toEqual(NOW);
    // Déjà prêt : la page ne redemande rien au prestataire.
    expect(await payments(t.db).confirmPayoutAccount({ userId: c.freelanceUser }, fake.gateway, NOW)).toBe(true);
    expect(fake.calls.readiness).toBe(2);
    // Une entreprise n'a pas de compte de versement.
    expect(await payments(t.db).confirmPayoutAccount({ userId: c.recruiter }, fake.gateway, NOW)).toBeNull();
  });

  it("refuse un montant dont la commission arrondie serait nulle", async () => {
    // Un devis ne descend plus sous le plancher : le contrat minuscule est écrit directement, comme une donnée héritée.
    const c = await activeContract();
    const snapshots = await t.db.contract.findUniqueOrThrow({ where: { id: c.id }, select: { sellerSnapshot: true, buyerSnapshot: true } });
    const tiny = await t.db.contract.create({
      data: {
        organisationId: c.org, profileId: c.profile, dailyRateCents: 4, days: 1, totalCents: 4, currency: "EUR",
        sellerSnapshot: snapshots.sellerSnapshot ?? {}, buyerSnapshot: snapshots.buyerSnapshot ?? {}, startsOn: NOW,
        status: "active", acceptedByFreelanceAt: NOW, acceptedByOrgAt: NOW,
      },
      select: { id: true },
    });
    expect(await payments(t.db).open({ userId: c.recruiter }, tiny.id, fakeGateway().gateway, COMMISSION_BP)).toEqual({ kind: "amount_too_small" });
  });

  it("n'annule pas un contrat qui a de l'argent en jeu", async () => {
    const c = await activeContract();
    await payAndHold(t.db, c.recruiter, c.id);
    await expect(t.db.contract.update({ where: { id: c.id }, data: { status: "cancelled" } })).rejects.toThrow();
  });
});

describe("accès et configuration", () => {
  it("refuse d'ouvrir un paiement sans taux de commission configuré, par le freelance ou par un tiers", async () => {
    const c = await activeContract();
    const { gateway, calls } = fakeGateway();
    await expect(payments(t.db).open({ userId: c.recruiter }, c.id, gateway, Number.NaN)).rejects.toThrow(/commission/);
    expect(await payments(t.db).open({ userId: c.freelanceUser }, c.id, gateway, COMMISSION_BP)).toEqual({ kind: "absent" });
    expect(await payments(t.db).open({ userId: await createUser(t.db) }, c.id, gateway, COMMISSION_BP)).toEqual({ kind: "absent" });
    expect(calls.intents).toBe(0);
  });

  it("montre la commission au freelance, jamais à l'entreprise", async () => {
    const c = await activeContract();
    await payments(t.db).open({ userId: c.recruiter }, c.id, fakeGateway().gateway, COMMISSION_BP);
    expect(await payments(t.db).find({ userId: c.freelanceUser }, c.id)).toMatchObject({ commissionCents: 60_000 });
    expect(await payments(t.db).find({ userId: c.recruiter }, c.id)).toMatchObject({ commissionCents: null, amountCents: 720_000 });
    expect(await payments(t.db).find({ userId: await createUser(t.db) }, c.id)).toBeNull();
  });
});
