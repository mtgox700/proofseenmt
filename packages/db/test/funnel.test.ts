import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { funnel } from "../src/funnel";
import { messaging } from "../src/messaging";
import { missions } from "../src/missions";
import { payments } from "../src/payments";
import { quotes } from "../src/quotes";
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

describe("entonnoir de la marketplace", () => {
  it("compte chaque étape des deux côtés, sans jamais nommer personne", async () => {
    // Trois freelances : un profil privé, un profil publié contacté, un profil prouvé, sous contrat et payé.
    await createProfile(t.db, await createUser(t.db), "private");
    const contactedUser = await createUser(t.db);
    const contacted = await createProfile(t.db, contactedUser);
    const paidUser = await createUser(t.db);
    const paid = await createProfile(t.db, paidUser);
    await verifiedVigilance(t.db, paid);
    await t.db.ownedUrl.create({ data: { profileId: paid, url: "https://paid.dev", urlKey: "https://paid.dev", proofMethod: "meta_tag", verifiedAt: NOW } });

    // Deux entreprises : une qui n'a rien fait, une qui publie, contacte, contracte et paie.
    await createOrganisation(t.db, await createUser(t.db));
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const mission = await missions(t.db).create({ userId: recruiter }, org, { title: "Data engineer", description: "Pipeline Spark.", workMode: "remote", skills: ["Spark"] });
    await missions(t.db).publish({ userId: recruiter }, mission?.id ?? "", NOW);
    await messaging(t.db).contact({ userId: recruiter }, org, contacted, "Bonjour, une mission ?");

    await billing(t.db).setFreelanceIdentity({ userId: paidUser }, { legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
    await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
    await t.db.billingIdentity.update({ where: { profileId: paid }, data: { stripeAccountId: "acct_testfunnel1", payoutsEnabledAt: NOW } });
    const contact = await messaging(t.db).contact({ userId: recruiter }, org, paid, "Bonjour, une mission ?");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: paidUser }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: paidUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
    await quotes(t.db).send({ userId: paidUser }, draft?.id ?? "");
    await quotes(t.db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");
    const created = await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-11-02" });
    if (created.kind !== "created") throw new Error(created.kind);
    await contracts(t.db).sign({ userId: recruiter }, created.contract.id, NOW);
    await contracts(t.db).sign({ userId: paidUser }, created.contract.id, NOW);
    const { gateway } = fakeGateway();
    await payAndHold(t.db, recruiter, created.contract.id, gateway);
    await contracts(t.db).complete({ userId: recruiter }, created.contract.id);
    await payments(t.db).release(created.contract.id, gateway, PROOFSEEN, NOW);

    const measured = await funnel(t.db).measure();
    expect(measured.freelance).toEqual({ profiles: 3, published: 2, provenUrl: 1, firstExchange: 2, contracted: 1, paid: 1 });
    expect(measured.company).toEqual({ organisations: 2, missionPublished: 1, firstExchange: 1, contracted: 1, paid: 1, medianHoursToFirstExchange: 0 });
    // Des totaux seulement : aucune valeur de la mesure n'est un identifiant, un nom ou une adresse.
    expect(JSON.stringify(measured)).toMatch(/^[{}":,a-zA-Z0-9]+$/);
    expect(Object.values(measured.freelance).every((n) => typeof n === "number")).toBe(true);
  });

  it("isole une cohorte par date d'arrivée", async () => {
    const empty = await funnel(t.db).measure({ from: new Date("2099-01-01T00:00:00Z") });
    expect(empty.freelance.profiles).toBe(0);
    expect(empty.company.organisations).toBe(0);
  });
});
