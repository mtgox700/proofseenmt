import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { invoices, vatOf } from "../src/invoices";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, payAndHold, type TestDatabase, verifiedVigilance, nextSiret } from "./support/database";

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

/** Un contrat terminé de 10 jours à 600 €, entre une entreprise et un freelance au taux de TVA donné. */
const completedContract = async (vatRateBp: 0 | 2000, freelance?: { userId: string; profile: string }) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = freelance?.userId ?? (await createUser(t.db));
  const profile = freelance?.profile ?? (await createProfile(t.db, freelanceUser));
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp });
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", address: ADDRESS });
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-11-02", endsOn: "2026-11-13" });
  if (created.kind !== "created") throw new Error(created.kind);
  const id = created.contract.id;
  await contracts(t.db).sign({ userId: recruiter }, id, NOW);
  await contracts(t.db).sign({ userId: freelanceUser }, id, NOW);
  await payAndHold(t.db, recruiter, id);
  await contracts(t.db).complete({ userId: recruiter }, id);
  return { id, recruiter, freelanceUser, profile };
};

describe("facture de la mission", () => {
  it("est émise au nom du freelance, avec ses mentions, une seule fois", async () => {
    const c = await completedContract(0);
    const first = await invoices(t.db).issueMission(c.id, NOW);
    if (first.kind !== "issued") throw new Error(first.kind);
    expect(first.invoice).toMatchObject({
      kind: "mission",
      netCents: 600_000,
      vatRateBp: 0,
      vatCents: 0,
      totalCents: 600_000,
      label: "Prestation de services : 10 jours, du 2026-11-02 au 2026-11-13",
      seller: { legalName: "Camille Test EI", siret: expect.stringMatching(/^552100554\d{5}$/) },
      buyer: { legalName: "Acme SAS" },
      dueOn: new Date("2026-12-20T00:00:00Z"),
    });
    expect(first.invoice.number).toMatch(/^FR-[A-Z2-9]{5}-2026-0001$/);
    expect(await invoices(t.db).issueMission(c.id, NOW)).toMatchObject({ kind: "existing", invoice: { number: first.invoice.number } });
    await expect(t.db.invoice.update({ where: { id: first.invoice.id }, data: { label: "Réécrite" } })).rejects.toThrow();
  });

  it("applique la TVA du freelance, et numérote sans trou dans la série de chaque freelance", async () => {
    const a = await completedContract(2000);
    const a1 = await invoices(t.db).issueMission(a.id, NOW);
    expect(a1).toMatchObject({ kind: "issued", invoice: { vatCents: 120_000, totalCents: 720_000 } });
    const a2c = await completedContract(2000, { userId: a.freelanceUser, profile: a.profile });
    const a2 = await invoices(t.db).issueMission(a2c.id, NOW);
    const b = await completedContract(0);
    const b1 = await invoices(t.db).issueMission(b.id, NOW);

    const suffix = (r: typeof a1) => (r.kind === "not_invoiceable" ? "" : r.invoice.number.slice(-9));
    expect([suffix(a1), suffix(a2), suffix(b1)]).toEqual(["2026-0001", "2026-0002", "2026-0001"]);
  });

  it("n'est pas émise pour un contrat non terminé", async () => {
    const recruiter = await createUser(t.db);
    expect(await invoices(t.db).issueMission("00000000-0000-7000-8000-000000000000", NOW)).toEqual({ kind: "not_invoiceable" });
    expect(await invoices(t.db).listMine({ userId: recruiter })).toEqual([]);
  });
});

describe("facture de commission", () => {
  it("va de Proofseen au freelance, dans la série de Proofseen, et l'entreprise ne la voit pas", async () => {
    const c = await completedContract(0);
    await invoices(t.db).issueMission(c.id, NOW);
    const commission = await invoices(t.db).issueCommission(c.id, 60_000, PROOFSEEN, NOW);
    if (commission.kind !== "issued") throw new Error(commission.kind);
    expect(commission.invoice).toMatchObject({
      kind: "commission",
      netCents: 60_000,
      vatRateBp: 2000,
      vatCents: 12_000,
      totalCents: 72_000,
      seller: { legalName: "Proofseen (test)" },
      buyer: { legalName: "Camille Test EI" },
    });
    expect(commission.invoice.number).toMatch(/^PS-2026-\d{4}$/);

    expect((await invoices(t.db).listMine({ userId: c.freelanceUser })).map((i) => i.kind).sort()).toEqual(["commission", "mission"]);
    expect((await invoices(t.db).listMine({ userId: c.recruiter })).map((i) => i.kind)).toEqual(["mission"]);
    expect(await invoices(t.db).find({ userId: c.recruiter }, commission.invoice.id)).toBeNull();
    expect(await invoices(t.db).find({ userId: await createUser(t.db) }, commission.invoice.id)).toBeNull();
  });

  it("refuse une commission nulle ou négative", async () => {
    const c = await completedContract(0);
    expect(() => invoices(t.db).issueCommission(c.id, 0, PROOFSEEN, NOW)).toThrow(/commission/);
  });
});

describe("arrondi de la TVA", () => {
  it.each([
    [100, 2000, 20],
    [333, 2000, 67],
    [1, 550, 0],
    [999_999, 1000, 100_000],
  ])("%i centimes à %i pb → %i", (net, rate, vat) => {
    expect(vatOf(net, rate)).toBe(vat);
  });
});
