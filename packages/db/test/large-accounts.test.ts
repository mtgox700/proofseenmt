import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LegalSnapshot } from "../src/billing";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { gdpr } from "../src/gdpr";
import { largeAccounts } from "../src/large-accounts";
import { messaging } from "../src/messaging";
import { payments } from "../src/payments";
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
const PROOFSEEN: LegalSnapshot = { legalName: "Proofseen (test)", siret: "12345678900011", vatNumber: "FR12123456789", address: ADDRESS, vatRateBp: 2000 };
const NOW = new Date("2026-11-20T10:00:00Z");

/** Une entreprise avec deux administrateurs et un contrat payé, prêt à être validé. */
const heldContract = async (org?: { readonly id: string; readonly owner: string; readonly admin: string }) => {
  const owner = org?.owner ?? (await createUser(t.db));
  const organisationId = org?.id ?? (await createOrganisation(t.db, owner));
  const admin = org?.admin ?? (await createUser(t.db));
  if (org === undefined) {
    await t.db.membership.create({ data: { organisationId, userId: admin, role: "admin" } });
    await billing(t.db).setOrganisationIdentity({ userId: owner }, organisationId, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
  }
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await t.db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: NOW } });
  const contact = await messaging(t.db).contact({ userId: owner }, organisationId, profile, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: owner }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: owner }, draft?.id ?? "", { startsOn: "2026-11-02" }, NOW);
  if (created.kind !== "created") throw new Error(created.kind);
  await contracts(t.db).sign({ userId: owner }, created.contract.id, NOW);
  await contracts(t.db).sign({ userId: freelanceUser }, created.contract.id, NOW);
  const { gateway } = fakeGateway();
  await payAndHold(t.db, owner, created.contract.id, gateway);
  return { owner, admin, organisationId, freelanceUser, profile, contract: created.contract.id, gateway };
};

describe("grands comptes", () => {
  it("validation à deux niveaux : il faut deux administrateurs distincts avant le versement", async () => {
    const c = await heldContract();
    expect(await largeAccounts(t.db).setApprovalLevels({ userId: c.admin }, c.organisationId, 2)).toBe(false);
    expect(await largeAccounts(t.db).setApprovalLevels({ userId: c.owner }, c.organisationId, 2)).toBe(true);

    expect(await contracts(t.db).complete({ userId: c.owner }, c.contract)).toEqual({ kind: "awaiting_second_approval", approvals: 1, required: 2 });
    // Le même administrateur ne compte pas deux fois.
    expect(await contracts(t.db).complete({ userId: c.owner }, c.contract)).toEqual({ kind: "awaiting_second_approval", approvals: 1, required: 2 });
    expect(await t.db.notification.count({ where: { userId: c.admin, payload: { path: ["status"], equals: "second_approval_needed" } } })).toBeGreaterThanOrEqual(1);
    // La base refuse de valider sans la seconde validation, même par une écriture directe.
    await expect(t.db.contract.update({ where: { id: c.contract }, data: { status: "completed" } })).rejects.toThrow(/deux validations/);

    expect(await contracts(t.db).complete({ userId: c.admin }, c.contract)).toMatchObject({ kind: "completed" });
    expect(await payments(t.db).release(c.contract, c.gateway, PROOFSEEN, NOW)).toMatchObject({ kind: "released" });
  });

  it("le freelance ne valide jamais, même devenu administrateur de l'entreprise", async () => {
    const c = await heldContract();
    await expect(t.db.contractApproval.create({ data: { contractId: c.contract, userId: c.freelanceUser } })).rejects.toThrow(/administre pas|propre prestation/);
  });

  it("un administrateur impute un contrat à un centre de coûts ; un tiers ne le peut pas", async () => {
    const c = await heldContract();
    const stranger = await createUser(t.db);
    expect(await largeAccounts(t.db).setCostCenter({ userId: stranger }, c.contract, "IT-42")).toBe(false);
    expect(await largeAccounts(t.db).setCostCenter({ userId: c.admin }, c.contract, "IT-42")).toBe(true);
    expect(await t.db.contract.findUniqueOrThrow({ where: { id: c.contract }, select: { costCenter: true } })).toEqual({ costCenter: "IT-42" });
  });

  it("le vivier privé : les freelances payés par l'entreprise, par des faits, sans score, réservé à ses membres", async () => {
    const first = await heldContract();
    const org = { id: first.organisationId, owner: first.owner, admin: first.admin };
    await contracts(t.db).complete({ userId: first.owner }, first.contract);
    await payments(t.db).release(first.contract, first.gateway, PROOFSEEN, NOW);
    const unpaid = await heldContract(org);

    const pool = await largeAccounts(t.db).talentPool({ userId: first.admin }, first.organisationId);
    expect(pool?.map((p) => p.profileId)).toEqual([first.profile]);
    expect(pool?.[0]).toMatchObject({ paidMissions: 1, totalDays: 10 });
    expect(Object.keys(pool?.[0] ?? {}).filter((k) => /score|rank|rating/i.test(k))).toEqual([]);
    expect(pool?.some((p) => p.profileId === unpaid.profile)).toBe(false);
    expect(await largeAccounts(t.db).talentPool({ userId: first.freelanceUser }, first.organisationId)).toBeNull();
  });

  it("un administrateur qui a validé peut effacer son compte ; la validation reste, sans auteur", async () => {
    const c = await heldContract();
    await contracts(t.db).complete({ userId: c.admin }, c.contract);
    await payments(t.db).release(c.contract, c.gateway, PROOFSEEN, NOW);
    expect(await gdpr(t.db).eraseUser(c.admin)).toBe("erased");
    expect(await t.db.contractApproval.count({ where: { contractId: c.contract, userId: null } })).toBe(1);
  });
});
