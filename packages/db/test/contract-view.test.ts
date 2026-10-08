import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contractView } from "../src/contract-view";
import { contracts } from "../src/contracts";
import { largeAccounts } from "../src/large-accounts";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, nextSiret, openTestDatabase, payAndHold, type TestDatabase, verifiedVigilance } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const NOW = new Date("2026-11-20T10:00:00Z");

/** Un contrat signé et payé entre une entreprise à deux administrateurs et un freelance. */
const contract = async () => {
  const owner = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, owner);
  const admin = await createUser(t.db);
  await t.db.membership.create({ data: { organisationId, userId: admin, role: "admin" } });
  await billing(t.db).setOrganisationIdentity({ userId: owner }, organisationId, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  const contact = await messaging(t.db).contact({ userId: owner }, organisationId, profile, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: owner }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: owner }, draft?.id ?? "", { startsOn: "2026-11-02" }, NOW);
  if (created.kind !== "created") throw new Error(created.kind);
  const reference = (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profile }, select: { reference: true } })).reference;
  return { owner, admin, organisationId, freelanceUser, reference, contractId: created.contract.id, conversationId: contact.conversation.id, quoteId: draft?.id ?? "" };
};

describe("engager l'entreprise", () => {
  it("un simple membre n'accepte pas de devis, ne crée ni ne signe de contrat", async () => {
    const c = await contract();
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.organisationId, userId: member, role: "member" } });
    expect(await contracts(t.db).sign({ userId: member }, c.contractId, NOW)).toEqual({ kind: "absent" });
    expect(await contracts(t.db).sign({ userId: c.admin }, c.contractId, NOW)).toMatchObject({ kind: "signed" });

    const draft = await quotes(t.db).draft({ userId: c.freelanceUser }, c.conversationId, { dailyRateCents: 50_000, days: 2 });
    await quotes(t.db).send({ userId: c.freelanceUser }, draft?.id ?? "");
    expect(await quotes(t.db).decide({ userId: member }, draft?.id ?? "", "accepted")).toEqual({ kind: "absent" });
  });

  it("un devis ne s'accepte plus, ni ne devient contrat, une fois le fil clos", async () => {
    const owner = await createUser(t.db);
    const organisationId = await createOrganisation(t.db, owner);
    await billing(t.db).setOrganisationIdentity({ userId: owner }, organisationId, { legalName: "Beta SAS", siret: nextSiret("732829320"), address: ADDRESS });
    const freelanceUser = await createUser(t.db);
    const profile = await createProfile(t.db, freelanceUser);
    await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Dom Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
    const contact = await messaging(t.db).contact({ userId: owner }, organisationId, profile, "Bonjour, une mission ?");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
    const sent = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 50_000, days: 2 });
    await quotes(t.db).send({ userId: freelanceUser }, sent?.id ?? "");
    await messaging(t.db).close({ userId: freelanceUser }, contact.conversation.id);
    expect(await quotes(t.db).decide({ userId: owner }, sent?.id ?? "", "accepted")).toEqual({ kind: "absent" });
  });
});

describe("contrats vus des écrans", () => {
  it("l'entreprise ne voit l'identité légale du freelance qu'une fois qu'il a signé", async () => {
    const c = await contract();
    const [before] = await contractView(t.db).list({ userId: c.owner });
    expect(before).toMatchObject({ id: c.contractId, side: "company", counterpart: c.reference, totalCents: 600_000, status: "pending_signatures" });
    expect((await contractView(t.db).find({ userId: c.owner }, c.contractId))?.seller).toEqual({ legalName: c.reference, siret: null });
    await contracts(t.db).sign({ userId: c.freelanceUser }, c.contractId, NOW);
    const [after] = await contractView(t.db).list({ userId: c.owner });
    expect(after?.counterpart).toBe("Camille Test EI");
  });

  it("chaque partie voit l'autre et son propre côté", async () => {
    const c = await contract();
    const [freelance] = await contractView(t.db).list({ userId: c.freelanceUser });
    expect(freelance).toMatchObject({ side: "freelance", counterpart: "Acme SAS" });

    const detail = await contractView(t.db).find({ userId: c.freelanceUser }, c.contractId);
    expect(detail).toMatchObject({ seller: { legalName: "Camille Test EI" }, buyer: { legalName: "Acme SAS" }, role: null, conversationId: c.conversationId, signedByFreelanceAt: null });
    expect((await contractView(t.db).find({ userId: c.admin }, c.contractId))?.role).toBe("admin");
  });

  it("un tiers ne voit rien", async () => {
    const c = await contract();
    const stranger = await createUser(t.db);
    expect(await contractView(t.db).list({ userId: stranger })).toEqual([]);
    expect(await contractView(t.db).find({ userId: stranger }, c.contractId)).toBeNull();
    expect(await contractView(t.db).find({ userId: c.owner }, "pas-un-uuid")).toBeNull();
  });

  it("dit où en sont les validations, comme la base les compte", async () => {
    const c = await contract();
    await contracts(t.db).sign({ userId: c.owner }, c.contractId, NOW);
    await contracts(t.db).sign({ userId: c.freelanceUser }, c.contractId, NOW);
    await payAndHold(t.db, c.owner, c.contractId, fakeGateway().gateway);
    await largeAccounts(t.db).setApprovalLevels({ userId: c.owner }, c.organisationId, 2);
    await contracts(t.db).complete({ userId: c.admin }, c.contractId);
    expect((await contractView(t.db).find({ userId: c.owner }, c.contractId))?.approvals).toEqual({ count: 1, mine: false, required: 2 });
    expect((await contractView(t.db).find({ userId: c.admin }, c.contractId))?.approvals).toEqual({ count: 1, mine: true, required: 2 });
  });
});
