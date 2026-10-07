import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiKeys, MAX_ACTIVE_KEYS } from "../src/api-keys";
import type { LegalSnapshot } from "../src/billing";
import { billing } from "../src/billing";
import { companyApi } from "../src/company-api";
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
const PAGE = { limit: 50 };

interface Company {
  readonly id: string;
  readonly owner: string;
  readonly admins: readonly string[];
}

/** Une entreprise : un propriétaire et autant d'administrateurs que d'équipes. */
const company = async (teams: number): Promise<Company> => {
  const owner = await createUser(t.db);
  const id = await createOrganisation(t.db, owner);
  const admins: string[] = [];
  for (let i = 0; i < teams; i += 1) {
    const admin = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: id, userId: admin, role: "admin" } });
    admins.push(admin);
  }
  await billing(t.db).setOrganisationIdentity({ userId: owner }, id, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
  return { id, owner, admins };
};

/** Un contrat signé et payé sous séquestre entre l'entreprise et un nouveau freelance. */
const heldContract = async (org: Company, freelanceName = "Camille Test EI") => {
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: freelanceName, siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await t.db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: NOW } });
  const contact = await messaging(t.db).contact({ userId: org.owner }, org.id, profile, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: org.owner }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: org.owner }, draft?.id ?? "", { startsOn: "2026-11-02" }, NOW);
  if (created.kind !== "created") throw new Error(created.kind);
  await contracts(t.db).sign({ userId: org.owner }, created.contract.id, NOW);
  await contracts(t.db).sign({ userId: freelanceUser }, created.contract.id, NOW);
  const { gateway } = fakeGateway();
  await payAndHold(t.db, org.owner, created.contract.id, gateway);
  return { contract: created.contract.id, gateway, freelanceUser, profile };
};

describe("grands comptes : parcours complet", () => {
  it("trois équipes, chacune son centre de coûts, validation à deux niveaux jusqu'au versement", async () => {
    const org = await company(3);
    expect(await largeAccounts(t.db).setApprovalLevels({ userId: org.owner }, org.id, 2)).toBe("saved");
    const teams = ["DATA", "WEB", "INFRA"] as const;
    for (const [i, team] of teams.entries()) {
      const admin = org.admins[i] ?? "";
      const c = await heldContract(org);
      expect(await largeAccounts(t.db).setCostCenter({ userId: admin }, c.contract, team)).toBe("saved");
      expect(await contracts(t.db).complete({ userId: admin }, c.contract)).toEqual({ kind: "awaiting_second_approval", approvals: 1, required: 2 });
      expect(await payments(t.db).release(c.contract, c.gateway, PROOFSEEN, NOW)).not.toMatchObject({ kind: "released" });
      const second = org.admins[(i + 1) % teams.length] ?? "";
      expect(await contracts(t.db).complete({ userId: second }, c.contract)).toMatchObject({ kind: "completed" });
      expect(await payments(t.db).release(c.contract, c.gateway, PROOFSEEN, NOW)).toMatchObject({ kind: "released" });
    }
    const listed = await companyApi(t.db).contracts(org.id, PAGE);
    expect(listed.items.map((c) => c.costCenter)).toEqual([...teams]);
    expect(listed.items.every((c) => c.status === "completed")).toBe(true);
    expect((await largeAccounts(t.db).talentPool({ userId: org.owner }, org.id))?.length).toBe(3);
  });
});

describe("clés d'API", () => {
  it("seul un administrateur crée une clé, montrée une fois ; la base n'en garde que l'empreinte", async () => {
    const org = await company(1);
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: org.id, userId: member, role: "member" } });
    expect(await apiKeys(t.db).create({ userId: member }, org.id, "ERP", NOW)).toEqual({ kind: "absent" });
    const created = await apiKeys(t.db).create({ userId: org.admins[0] ?? "" }, org.id, "ERP", NOW);
    if (created.kind !== "created") throw new Error(created.kind);
    expect(created.key).toMatch(/^psk_[A-Za-z0-9_-]{43}$/);
    const stored = await t.db.apiKey.findUniqueOrThrow({ where: { id: created.summary.id } });
    expect(stored.hash).not.toContain(created.key.slice(4));
    expect(stored.prefix).toBe(created.key.slice(0, 12));
    expect(await apiKeys(t.db).authenticate(created.key, NOW)).toEqual({ keyId: created.summary.id, organisationId: org.id });
    expect(await apiKeys(t.db).list({ userId: member }, org.id)).toBeNull();
    expect((await apiKeys(t.db).list({ userId: org.owner }, org.id))?.[0]).not.toHaveProperty("hash");
  });

  it("une clé révoquée est refusée, et ne revit pas même par une écriture directe", async () => {
    const org = await company(1);
    const created = await apiKeys(t.db).create({ userId: org.owner }, org.id, "Compta", NOW);
    if (created.kind !== "created") throw new Error(created.kind);
    const stranger = await createUser(t.db);
    expect(await apiKeys(t.db).revoke({ userId: stranger }, org.id, created.summary.id, NOW)).toBe(false);
    expect(await apiKeys(t.db).revoke({ userId: org.admins[0] ?? "" }, org.id, created.summary.id, NOW)).toBe(true);
    expect(await apiKeys(t.db).revoke({ userId: org.owner }, org.id, created.summary.id, NOW)).toBe(false);
    expect(await apiKeys(t.db).authenticate(created.key, NOW)).toBeNull();
    await expect(t.db.apiKey.update({ where: { id: created.summary.id }, data: { revokedAt: null } })).rejects.toThrow(/révoquée pour toujours/);
  });

  it("refuse une clé mal formée ou inconnue, et plafonne le nombre de clés actives", async () => {
    expect(await apiKeys(t.db).authenticate("psk_court", NOW)).toBeNull();
    expect(await apiKeys(t.db).authenticate(`psk_${"A".repeat(43)}`, NOW)).toBeNull();
    const org = await company(0);
    for (let i = 0; i < MAX_ACTIVE_KEYS; i += 1) expect((await apiKeys(t.db).create({ userId: org.owner }, org.id, `k${i}`, NOW)).kind).toBe("created");
    expect(await apiKeys(t.db).create({ userId: org.owner }, org.id, "une de trop", NOW)).toEqual({ kind: "too_many" });
  });

  it("une clé ne survit pas aux droits de son créateur : effacement, départ ou perte du rôle la révoquent", async () => {
    const org = await company(3);
    const [erased, removed, demoted] = org.admins;
    const keyOf = async (userId: string) => {
      const created = await apiKeys(t.db).create({ userId }, org.id, "ERP", NOW);
      if (created.kind !== "created") throw new Error(created.kind);
      return created;
    };
    const keys = [await keyOf(erased ?? ""), await keyOf(removed ?? ""), await keyOf(demoted ?? ""), await keyOf(org.owner)];
    expect(await gdpr(t.db).eraseUser(erased ?? "")).toBe("erased");
    await t.db.membership.delete({ where: { organisationId_userId: { organisationId: org.id, userId: removed ?? "" } } });
    await t.db.membership.update({ where: { organisationId_userId: { organisationId: org.id, userId: demoted ?? "" } }, data: { role: "member" } });
    const states = await Promise.all(keys.map((k) => apiKeys(t.db).authenticate(k.key, NOW)));
    expect(states.map((s) => s !== null)).toEqual([false, false, false, true]);
    expect(await t.db.apiKey.findUniqueOrThrow({ where: { id: keys[0]?.summary.id ?? "" }, select: { createdByUserId: true } })).toEqual({ createdByUserId: null });
  });
});

describe("API de lecture", () => {
  it("ne rend que les données de l'entreprise appelante, et jamais la facture de commission", async () => {
    const mine = await company(0);
    const other = await company(0);
    const a = await heldContract(mine);
    const b = await heldContract(other);
    for (const [org, c] of [[mine, a], [other, b]] as const) {
      await contracts(t.db).complete({ userId: org.owner }, c.contract);
      await payments(t.db).release(c.contract, c.gateway, PROOFSEEN, NOW);
    }
    const api = companyApi(t.db);
    expect((await api.contracts(mine.id, PAGE)).items.map((c) => c.id)).toEqual([a.contract]);
    const invoices = await api.invoices(mine.id, PAGE);
    expect(invoices.items.length).toBeGreaterThan(0);
    expect(invoices.items.every((i) => i.contractId === a.contract)).toBe(true);
    const kinds = await t.db.invoice.findMany({ where: { id: { in: invoices.items.map((i) => i.id) } }, select: { kind: true } });
    expect(kinds.every((k) => k.kind === "mission")).toBe(true);
    expect(await t.db.invoice.count({ where: { contractId: a.contract, kind: "commission" } })).toBe(1);
  });

  it("ne donne l'identité légale du freelance qu'une fois le contrat signé des deux côtés", async () => {
    const org = await company(0);
    const signed = await heldContract(org, "Camille Signée EI");
    const listed = await companyApi(t.db).contracts(org.id, PAGE);
    expect(listed.items[0]?.freelance.legalName).toBe("Camille Signée EI");
    const pending = await t.db.contract.create({
      data: { organisationId: org.id, profileId: signed.profile, dailyRateCents: 60_000, days: 1, totalCents: 60_000, currency: "EUR", startsOn: new Date("2026-12-01"), sellerSnapshot: { legalName: "Pas encore signé EI", siret: "55210055400011", vatNumber: null, address: ADDRESS, vatRateBp: 2000 }, buyerSnapshot: { legalName: "Acme SAS", siret: null, vatNumber: null, address: ADDRESS, vatRateBp: null } },
      select: { id: true },
    });
    const after = await companyApi(t.db).contracts(org.id, PAGE);
    expect(after.items.find((c) => c.id === pending.id)?.freelance).toMatchObject({ legalName: null, siret: null });
  });

  it("pagine sans trou ni doublon", async () => {
    const org = await company(0);
    const ids = [];
    for (let i = 0; i < 3; i += 1) ids.push((await heldContract(org)).contract);
    const first = await companyApi(t.db).contracts(org.id, { limit: 2 });
    expect(first.items.length).toBe(2);
    const second = await companyApi(t.db).contracts(org.id, { limit: 2, after: first.next ?? undefined });
    expect([...first.items, ...second.items].map((c) => c.id)).toEqual(ids);
    expect(second.next).toBeNull();
  });
});
