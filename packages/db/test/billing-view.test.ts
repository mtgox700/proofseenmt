import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { billingView } from "../src/billing-view";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };

describe("identités de facturation relues", () => {
  it("le freelance relit la sienne, mandat daté, sans identifiant de compte de versement", async () => {
    const user = await createUser(t.db);
    expect(await billingView(t.db).freelance({ userId: user })).toBeNull();
    const profile = await createProfile(t.db, user);
    expect(await billingView(t.db).freelance({ userId: user })).toBeNull();
    await billing(t.db).setFreelanceIdentity({ userId: user }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
    await t.db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: "acct_secret123" } });

    const view = await billingView(t.db).freelance({ userId: user });
    expect(view).toMatchObject({ legalName: "Camille Test EI", vatRateBp: 2000, address: ADDRESS, payoutsReady: false, payoutAccountOpened: true, registry: { status: null } });
    expect(view?.invoicingMandateAt).toBeInstanceOf(Date);
    expect(JSON.stringify(view)).not.toContain("acct_");
    expect(await billingView(t.db).freelance({ userId: await createUser(t.db) })).toBeNull();
  });

  it("l'entreprise relit la sienne, pour ses administrateurs seulement", async () => {
    const owner = await createUser(t.db);
    const organisationId = await createOrganisation(t.db, owner);
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId, userId: member, role: "member" } });
    expect(await billingView(t.db).organisation({ userId: owner }, organisationId)).toMatchObject({ legalName: "Acme", address: null });
    await billing(t.db).setOrganisationIdentity({ userId: owner }, organisationId, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
    expect(await billingView(t.db).organisation({ userId: owner }, organisationId)).toMatchObject({ legalName: "Acme SAS", address: ADDRESS });
    expect(await billingView(t.db).organisation({ userId: member }, organisationId)).toBeNull();
    expect(await billingView(t.db).organisation({ userId: owner }, "pas-un-uuid")).toBeNull();
  });
});
