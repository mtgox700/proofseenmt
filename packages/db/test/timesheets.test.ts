import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { timesheets } from "../src/timesheets";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, type TestDatabase, verifiedVigilance } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const NOW = new Date("2026-12-05T10:00:00Z");

/** Un contrat signé, en régie par défaut : 600 € par jour, 20 jours au plus, de décembre à février. */
const signed = async (mode: "monthly" | "fixed" = "monthly", days = 20) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
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
    const submitted = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 30, note: "Sprint 1 et 2" }, NOW);
    expect(submitted).toMatchObject({ kind: "submitted", timesheet: { status: "submitted", halfDays: 30 } });
    if (submitted.kind !== "submitted") throw new Error(submitted.kind);
    expect(await t.db.notification.count({ where: { userId: c.recruiter, kind: "contract_update", payload: { path: ["status"], equals: "timesheet_submitted" } } })).toBe(1);

    expect(await timesheets(t.db).decide({ userId: c.recruiter }, submitted.timesheet.id, "approved", NOW)).toMatchObject({ kind: "decided", timesheet: { status: "approved" } });
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 10 }, NOW)).toEqual({ kind: "locked" });
    await expect(t.db.timesheet.update({ where: { id: submitted.timesheet.id }, data: { halfDays: 2 } })).rejects.toThrow(/validé ne change plus/);
  });

  it("un relevé refusé se corrige et se redépose", async () => {
    const c = await signed();
    const first = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-01", halfDays: 44 }, NOW);
    if (first.kind !== "submitted") throw new Error(first.kind);
    await timesheets(t.db).decide({ userId: c.recruiter }, first.timesheet.id, "rejected", NOW);
    const again = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-01", halfDays: 40 }, NOW);
    expect(again).toMatchObject({ kind: "submitted", timesheet: { id: first.timesheet.id, status: "submitted", halfDays: 40, decidedAt: null } });
    expect(await t.db.notification.count({ where: { userId: c.freelanceUser, payload: { path: ["status"], equals: "timesheet_rejected" } } })).toBe(1);
  });

  it("refuse un mois hors de la période, un forfait, et un tiers", async () => {
    const c = await signed();
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-11", halfDays: 4 }, NOW)).toEqual({ kind: "out_of_period" });
    expect(await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-03", halfDays: 4 }, NOW)).toEqual({ kind: "out_of_period" });
    expect(await timesheets(t.db).submit({ userId: c.recruiter }, c.contract, { month: "2026-12", halfDays: 4 }, NOW)).toEqual({ kind: "absent" });
    const fixed = await signed("fixed");
    expect(await timesheets(t.db).submit({ userId: fixed.freelanceUser }, fixed.contract, { month: "2026-12", halfDays: 4 }, NOW)).toEqual({ kind: "absent" });
    // La base refuse aussi, même écrite directement.
    await expect(t.db.timesheet.create({ data: { contractId: fixed.contract, month: "2026-12", halfDays: 4 } })).rejects.toThrow(/pas en régie/);
  });

  it("seul un administrateur de l'entreprise décide, jamais le freelance ni un tiers", async () => {
    const c = await signed();
    const s = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 10 }, NOW);
    if (s.kind !== "submitted") throw new Error(s.kind);
    const stranger = await createUser(t.db);
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: member, role: "member" } });
    expect(await timesheets(t.db).decide({ userId: c.freelanceUser }, s.timesheet.id, "approved", NOW)).toEqual({ kind: "absent" });
    expect(await timesheets(t.db).decide({ userId: stranger }, s.timesheet.id, "approved", NOW)).toEqual({ kind: "absent" });
    expect(await timesheets(t.db).decide({ userId: member }, s.timesheet.id, "approved", NOW)).toEqual({ kind: "absent" });
    expect(await timesheets(t.db).list({ userId: stranger }, c.contract)).toBeNull();
    expect(await timesheets(t.db).list({ userId: c.freelanceUser }, c.contract)).toHaveLength(1);
  });

  it("ne valide jamais au-delà du plafond de jours du contrat", async () => {
    const c = await signed("monthly", 20);
    const dec = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2026-12", halfDays: 30 }, NOW);
    const jan = await timesheets(t.db).submit({ userId: c.freelanceUser }, c.contract, { month: "2027-01", halfDays: 20 }, NOW);
    if (dec.kind !== "submitted" || jan.kind !== "submitted") throw new Error("relevés non déposés");
    expect(await timesheets(t.db).decide({ userId: c.recruiter }, dec.timesheet.id, "approved", NOW)).toMatchObject({ kind: "decided" });
    // 30 + 20 demi-journées = 25 jours, au-delà des 20 du contrat.
    expect(await timesheets(t.db).decide({ userId: c.recruiter }, jan.timesheet.id, "approved", NOW)).toEqual({ kind: "over_cap" });
    expect(await t.db.timesheet.findUniqueOrThrow({ where: { id: jan.timesheet.id }, select: { status: true } })).toEqual({ status: "submitted" });
  });
});
