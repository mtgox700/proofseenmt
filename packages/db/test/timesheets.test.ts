import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { payments } from "../src/payments";
import { messaging } from "../src/messaging";
import { gdpr } from "../src/gdpr";
import { quotes } from "../src/quotes";
import { timesheets } from "../src/timesheets";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, nextSiret, openTestDatabase, type TestDatabase, verifiedVigilance } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const NOW = new Date("2026-12-05T10:00:00Z");
/** Les relevés se déclarent une fois le mois commencé : fin février, décembre et janvier sont déclarables. */
const LATER = new Date("2027-02-25T10:00:00Z");

/** Un contrat signé, en régie par défaut : 600 € par jour, 20 jours au plus, de décembre à février. */
const signed = async (mode: "monthly" | "fixed" = "monthly", days = 20) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days, billing: mode });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-12-01", endsOn: "2027-02-28" }, NOW);
  if (created.kind !== "created") throw new Error(created.kind);
  expect(created.contract.billing).toBe(mode);
  await contracts(t.db).sign({ userId: recruiter }, created.contract.id, NOW);
  await contracts(t.db).sign({ userId: freelanceUser }, created.contract.id, NOW);
  return { recruiter, freelanceUser, org, profile, contract: created.contract.id };
};

describe("relevés mensuels d'un contrat en régie", () => {
  it("le freelance déclare, l'entreprise valide ; un relevé validé ne change plus", async () => {
    const c = await signed();
    const submitted = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 30, note: "Sprint 1 et 2" }, LATER);
    expect(submitted).toMatchObject({ kind: "submitted", timesheet: { status: "submitted", halfDays: 30 } });
    if (submitted.kind !== "submitted") throw new Error(submitted.kind);
    expect(await t.db.notification.count({ where: { userId: c.recruiter, kind: "contract_update", payload: { path: ["status"], equals: "timesheet_submitted" } } })).toBe(1);

    expect(await timesheets(t.db).decide({ userId: c.recruiter }, submitted.timesheet.id, "approved", submitted.timesheet.submittedAt, NOW)).toMatchObject({ kind: "decided", timesheet: { status: "approved" } });
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 10 }, LATER)).toEqual({ kind: "locked" });
    await expect(t.db.timesheet.update({ where: { id: submitted.timesheet.id }, data: { halfDays: 2 } })).rejects.toThrow(/validé ne change plus/);
  });

  it("un relevé refusé se corrige et se redépose", async () => {
    const c = await signed();
    const first = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-01", halfDays: 42 }, LATER);
    if (first.kind !== "submitted") throw new Error(first.kind);
    await timesheets(t.db).decide({ userId: c.recruiter }, first.timesheet.id, "rejected", first.timesheet.submittedAt, NOW);
    const again = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-01", halfDays: 40 }, LATER);
    expect(again).toMatchObject({ kind: "submitted", timesheet: { id: first.timesheet.id, status: "submitted", halfDays: 40, decidedAt: null } });
    expect(await t.db.notification.count({ where: { userId: c.freelanceUser, payload: { path: ["status"], equals: "timesheet_rejected" } } })).toBe(1);
  });

  it("refuse un mois hors de la période, un forfait, et un tiers", async () => {
    const c = await signed();
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-11", halfDays: 4 }, LATER)).toEqual({ kind: "out_of_period" });
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-03", halfDays: 4 }, LATER)).toEqual({ kind: "out_of_period" });
    expect(await timesheets(t.db).submit({ userId: c.recruiter }, c.contract, { month: "2026-12", halfDays: 4 }, LATER)).toEqual({ kind: "absent" });
    const fixed = await signed("fixed");
    expect(await timesheets(t.db).submit({ userId: fixed.freelanceUser }, fixed.contract, { month: "2026-12", halfDays: 4 }, LATER)).toEqual({ kind: "absent" });
    // La base refuse aussi, même écrite directement.
    await expect(t.db.timesheet.create({ data: { contractId: fixed.contract, month: "2026-12", halfDays: 4 } })).rejects.toThrow(/pas en régie/);
  });

  it("seul un administrateur de l'entreprise décide, jamais le freelance ni un tiers", async () => {
    const c = await signed();
    const s = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 10 }, LATER);
    if (s.kind !== "submitted") throw new Error(s.kind);
    const stranger = await createUser(t.db);
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: member, role: "member" } });
    expect(await timesheets(t.db).decide({ userId: c.freelanceUser }, s.timesheet.id, "approved", s.timesheet.submittedAt, NOW)).toEqual({ kind: "absent" });
    expect(await timesheets(t.db).decide({ userId: stranger }, s.timesheet.id, "approved", s.timesheet.submittedAt, NOW)).toEqual({ kind: "absent" });
    expect(await timesheets(t.db).decide({ userId: member }, s.timesheet.id, "approved", s.timesheet.submittedAt, NOW)).toEqual({ kind: "absent" });
    expect(await timesheets(t.db).list({ userId: stranger }, c.contract)).toBeNull();
    expect(await timesheets(t.db).list({ userId: c.freelanceUser }, c.contract)).toHaveLength(1);
  });

  it("un contrat en régie ne se paie pas d'un seul coup : ni par le code, ni en base", async () => {
    const c = await signed();
    expect(await payments(t.db).open({ userId: c.recruiter }, c.contract, fakeGateway().gateway)).toEqual({ kind: "monthly_contract" });
    await expect(t.db.payment.create({ data: { contractId: c.contract, amountCents: 100_000, commissionCents: 10_000, currency: "EUR", stripeIntentId: `pi_${c.contract}` } })).rejects.toThrow(/relevé mensuel/);
  });

  it("ne valide que les chiffres lus : un relevé corrigé entre-temps n'est pas validé", async () => {
    const c = await signed();
    const seen = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 10 }, LATER);
    if (seen.kind !== "submitted") throw new Error(seen.kind);
    await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 46 }, new Date(LATER.getTime() + 60_000));
    expect(await timesheets(t.db).decide({ userId: c.recruiter }, seen.timesheet.id, "approved", seen.timesheet.submittedAt, NOW)).toEqual({ kind: "changed" });
  });

  it("refuse un mois à venir, plus de jours que le mois n'en a d'ouvrés, et des coordonnées dans la note", async () => {
    const c = await signed();
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-01", halfDays: 4 }, NOW)).toEqual({ kind: "implausible" });
    // Février 2027 : 20 jours ouvrés, donc 40 demi-journées au plus.
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-02", halfDays: 42 }, LATER)).toEqual({ kind: "implausible" });
    await expect(timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 4, note: "rappelez-moi au 06 12 34 56 78" }, LATER)).rejects.toThrow();
  });

  it("un administrateur qui a validé un relevé peut quand même effacer son compte ; le relevé reste, sans décideur", async () => {
    const c = await signed();
    const s = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 10 }, LATER);
    if (s.kind !== "submitted") throw new Error(s.kind);
    const admin = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: admin, role: "admin" } });
    expect(await timesheets(t.db).decide({ userId: admin }, s.timesheet.id, "approved", s.timesheet.submittedAt, NOW)).toMatchObject({ kind: "decided" });
    expect(await gdpr(t.db).eraseUser(admin)).toBe("erased");
    expect(await t.db.timesheet.findUniqueOrThrow({ where: { id: s.timesheet.id }, select: { status: true, decidedByUserId: true } })).toEqual({ status: "approved", decidedByUserId: null });
  });

  it("le mode de facturation d'un contrat ne change jamais, même par une écriture directe", async () => {
    const c = await signed();
    await expect(t.db.contract.update({ where: { id: c.contract }, data: { billing: "fixed" } })).rejects.toThrow(/mode de facturation/);
  });

  it("ne valide jamais au-delà du plafond de jours du contrat", async () => {
    const c = await signed("monthly", 20);
    const dec = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 30 }, LATER);
    const jan = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-01", halfDays: 20 }, LATER);
    if (dec.kind !== "submitted" || jan.kind !== "submitted") throw new Error("relevés non déposés");
    expect(await timesheets(t.db).decide({ userId: c.recruiter }, dec.timesheet.id, "approved", dec.timesheet.submittedAt, NOW)).toMatchObject({ kind: "decided" });
    // 30 + 20 demi-journées = 25 jours, au-delà des 20 du contrat.
    expect(await timesheets(t.db).decide({ userId: c.recruiter }, jan.timesheet.id, "approved", jan.timesheet.submittedAt, NOW)).toEqual({ kind: "over_cap" });
    expect(await t.db.timesheet.findUniqueOrThrow({ where: { id: jan.timesheet.id }, select: { status: true } })).toEqual({ status: "submitted" });
  });
});
