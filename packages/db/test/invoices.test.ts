import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { invoices, vatOf } from "../src/invoices";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { payments } from "../src/payments";
import { activeContract } from "./support/active-contract";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, openTestDatabase, PAID_AT, payAndHold, type TestDatabase, verifiedVigilance, nextSiret } from "./support/database";

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
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp });
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
      // Émise sans libération des fonds : pas acquittée, échéance à trente jours (l'acquittement est testé plus bas).
      paidOn: null,
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

  it("émise sans libération des fonds, n'est pas acquittée : échéance à trente jours", async () => {
    const c = await completedContract(0);
    const commission = await invoices(t.db).issueCommission(c.id, 60_000, PROOFSEEN, NOW);
    expect(commission).toMatchObject({ kind: "issued", invoice: { paidOn: null, settlesNumber: null, dueOn: new Date("2026-12-20T00:00:00Z") } });
  });

  it("refuse une commission nulle ou négative", async () => {
    const c = await completedContract(0);
    expect(() => invoices(t.db).issueCommission(c.id, 0, PROOFSEEN, NOW)).toThrow(/commission/);
  });
});

describe("factures émises à la libération des fonds (C. com. L441-9 I)", () => {
  /** Un contrat payé, validé, puis libéré à `at` : les deux factures sont émises par la libération elle-même. */
  const releasedAt = async (at: Date) => {
    const c = await activeContract(t.db);
    const fake = fakeGateway();
    await payAndHold(t.db, c.recruiter, c.id, fake.gateway);
    await contracts(t.db).complete({ userId: c.recruiter }, c.id);
    expect(await payments(t.db).release(c.id, fake.gateway, PROOFSEEN, at)).toMatchObject({ kind: "released" });
    const invoiceOf = (kind: "mission" | "commission") => t.db.invoice.findFirstOrThrow({ where: { contractId: c.id, kind } });
    return { c, mission: await invoiceOf("mission"), commission: await invoiceOf("commission") };
  };

  it("sont acquittées le jour de la libération, échéance le même jour : la date de la charge chez Stripe n'y entre pas", async () => {
    const { mission, commission } = await releasedAt(NOW);
    // La charge date du 18 novembre (PAID_AT), la libération du 20 : c'est le 20 qui compte.
    expect(await t.db.payment.findFirstOrThrow({ where: { contractId: mission.contractId }, select: { paidAt: true } })).toEqual({ paidAt: PAID_AT });
    for (const invoice of [mission, commission]) {
      expect(invoice.paidOn).toEqual(new Date("2026-11-20T00:00:00Z"));
      expect(invoice.dueOn).toEqual(new Date("2026-11-20T00:00:00Z"));
    }
  });

  it("la facture de commission renvoie à celle de la mission, réglée par compensation avec le même versement", async () => {
    const { mission, commission } = await releasedAt(NOW);
    expect(commission.settlesNumber).toBe(mission.number);
    expect(mission.settlesNumber).toBeNull();
  });

  it("compte le jour, l'année du numéro et la date à l'heure de Paris : 23 h 30 UTC le 31 décembre est le 1er janvier 2027", async () => {
    const newYear = new Date("2026-12-31T23:30:00Z");
    const { mission, commission } = await releasedAt(newYear);
    expect(mission.number).toMatch(/-2027-\d{4}$/);
    expect(commission.number).toMatch(/^PS-2027-\d{4}$/);
    for (const invoice of [mission, commission]) {
      expect(invoice.issuedAt).toEqual(newYear);
      expect(invoice.paidOn).toEqual(new Date("2027-01-01T00:00:00Z"));
      expect(invoice.dueOn).toEqual(new Date("2027-01-01T00:00:00Z"));
    }
  });

  it("une facture non acquittée compte ses trente jours depuis le jour de Paris", async () => {
    const c = await completedContract(0);
    const issued = await invoices(t.db).issueMission(c.id, new Date("2026-12-31T23:30:00Z"));
    expect(issued).toMatchObject({ kind: "issued", invoice: { paidOn: null, dueOn: new Date("2027-01-31T00:00:00Z") } });
  });

  it("la base refuse une facture acquittée dont l'échéance n'est pas le jour du paiement", async () => {
    const c = await completedContract(0);
    const issued = await invoices(t.db).issueMission(c.id, NOW);
    if (issued.kind !== "issued") throw new Error(issued.kind);
    const row = await t.db.invoice.findUniqueOrThrow({ where: { id: issued.invoice.id } });
    const copy = { ...row, number: "X-2026-9999", kind: "commission" as const, sellerSnapshot: row.sellerSnapshot ?? {}, buyerSnapshot: row.buyerSnapshot ?? {}, paidOn: new Date("2026-11-18"), dueOn: new Date("2026-12-18") };
    delete (copy as { id?: string }).id;
    await expect(t.db.invoice.create({ data: copy })).rejects.toThrow(/Invoice_due_chk/);
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
