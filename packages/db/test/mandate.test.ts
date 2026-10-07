import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };

describe("mandat de facturation", () => {
  it("aucun contrat sans mandat accepté ; la date du mandat est celle de la première acceptation", async () => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const freelanceUser = await createUser(t.db);
    const profile = await createProfile(t.db, freelanceUser);
    const identity = { legalName: "Camille Test EI", siret: nextSiret("552100554"), address: ADDRESS };
    await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, identity);
    await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
    const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour, une mission ?");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", new Date());
    const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 40_000, days: 5 });
    await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
    await quotes(t.db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");

    expect(await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" })).toEqual({ kind: "seller_identity_missing" });

    await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { ...identity, acceptInvoicingMandate: true });
    const first = (await t.db.billingIdentity.findUniqueOrThrow({ where: { profileId: profile }, select: { invoicingMandateAt: true } })).invoicingMandateAt;
    expect(first).not.toBeNull();
    await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { ...identity, acceptInvoicingMandate: true });
    expect((await t.db.billingIdentity.findUniqueOrThrow({ where: { profileId: profile }, select: { invoicingMandateAt: true } })).invoicingMandateAt).toEqual(first);

    expect(await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" })).toMatchObject({ kind: "created" });
  });
});
