import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { dashboards } from "../src/dashboards";
import { messaging } from "../src/messaging";
import { missions } from "../src/missions";
import { payments } from "../src/payments";
import { quotes } from "../src/quotes";
import { reviews } from "../src/reviews";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, openTestDatabase, payAndHold, type TestDatabase, verifiedVigilance, nextSiret } from "./support/database";

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

/** Une entreprise et un freelance avec un contrat actif de 10 jours à 600 €, en franchise de TVA, compte de versement prêt. */
const signedContract = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), address: ADDRESS });
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", address: ADDRESS });
  await t.db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: NOW } });
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
  return { id: created.contract.id, recruiter, freelanceUser, org, profile };
};

describe("avis", () => {
  it("n'existe qu'après une mission terminée et payée, une fois, sans coordonnées, sans agrégat", async () => {
    const c = await signedContract();
    const { gateway } = fakeGateway();
    expect(await reviews(t.db).write({ userId: c.recruiter }, c.id, { rating: 5, body: "Très bien" })).toEqual({ kind: "not_eligible" });
    await payAndHold(t.db, c.recruiter, c.id, gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    // Terminée mais pas encore versée : toujours pas d'avis.
    expect(await reviews(t.db).write({ userId: c.recruiter }, c.id, { rating: 5, body: "Très bien" })).toEqual({ kind: "not_eligible" });
    await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW);

    await expect(reviews(t.db).write({ userId: c.recruiter }, c.id, { rating: 5, body: "Écrivez-lui à jean@exemple.fr" })).rejects.toThrow(/coordonnées/);
    expect(await reviews(t.db).write({ userId: c.freelanceUser }, c.id, { rating: 5, body: "Je me note moi-même" })).toEqual({ kind: "not_eligible" });
    expect(await reviews(t.db).write({ userId: c.recruiter }, c.id, { rating: 4, body: "Livré dans les temps." })).toMatchObject({ kind: "written" });
    expect(await reviews(t.db).write({ userId: c.recruiter }, c.id, { rating: 5, body: "Encore" })).toEqual({ kind: "already_written" });

    const listed = await reviews(t.db).listForProfile(c.profile);
    expect(listed).toMatchObject([{ rating: 4, body: "Livré dans les temps." }]);
    expect(listed[0]).not.toHaveProperty("authorUserId");
  });
});

describe("tableaux de bord", () => {
  it("compte pour le freelance ce qui est versé, bloqué, et ce qui manque à son profil", async () => {
    const c = await signedContract();
    const { gateway } = fakeGateway();
    expect((await dashboards(t.db).freelance({ userId: c.freelanceUser })).money).toBeNull();

    await payAndHold(t.db, c.recruiter, c.id, gateway);
    const held = await dashboards(t.db).freelance({ userId: c.freelanceUser });
    // 600 000 payés (franchise de TVA) − 60 000 de commission − 12 000 de TVA sur la commission
    expect(held.money).toEqual({ currency: "EUR", receivedCents: 0, heldCents: 528_000 });
    expect(held.contracts).toEqual({ active: 1 });
    expect(held.profile).toMatchObject({ published: true, missing: [] });

    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW);
    const paid = await dashboards(t.db).freelance({ userId: c.freelanceUser });
    expect(paid).toMatchObject({ money: { receivedCents: 528_000, heldCents: 0 }, contracts: { completed: 1 }, invoices: 2 });
  });

  it("compte pour l'entreprise ses missions, candidatures, dépenses et seulement ses factures de mission", async () => {
    const c = await signedContract();
    const { gateway } = fakeGateway();
    const mission = (await missions(t.db).create({ userId: c.recruiter }, c.org, { title: "Data", description: "Spark", workMode: "remote" }))?.id ?? "";
    await missions(t.db).publish({ userId: c.recruiter }, mission, NOW);
    await missions(t.db).create({ userId: c.recruiter }, c.org, { title: "Brouillon", description: "x", workMode: "remote" });

    await payAndHold(t.db, c.recruiter, c.id, gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW);

    const board = await dashboards(t.db).company({ userId: c.recruiter }, c.org);
    expect(board).toMatchObject({ missions: { open: 1, draft: 1 }, openApplications: 0, contracts: { completed: 1 }, spend: { currency: "EUR", paidCents: 600_000, heldCents: 0 }, invoices: 1 });
    expect(await dashboards(t.db).company({ userId: c.freelanceUser }, c.org)).toBeNull();
  });

  it("dit qu'il n'y a pas de profil plutôt que d'inventer des chiffres", async () => {
    const me = await createUser(t.db);
    expect(await dashboards(t.db).freelance({ userId: me })).toEqual({ profile: null, applications: {}, contracts: {}, money: null, invoices: 0, reviews: 0 });
  });
});
