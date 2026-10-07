import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { plannedEnd, VALIDATION_GRACE_DAYS, validationReminders } from "../src/validation-reminders";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const SNAPSHOT = { legalName: "Test", country: "FR" };
const DAY_MS = 86_400_000;

/** Un contrat actif dont l'argent est bloqué, avec la fin prévue donnée. */
const heldContract = async (startsOn: Date, endsOn: Date | null, days = 10) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  const contract = await t.db.contract.create({
    data: {
      organisationId: org, profileId: profile, dailyRateCents: 50_000, days, totalCents: 50_000 * days, currency: "EUR",
      sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT, startsOn, endsOn, status: "active",
      acceptedByFreelanceAt: startsOn, acceptedByOrgAt: startsOn,
    },
    select: { id: true },
  });
  const payment = await t.db.payment.create({ data: { contractId: contract.id, amountCents: 50_000 * days, commissionCents: 5_000 * days, currency: "EUR", stripeIntentId: `pi_${contract.id}` }, select: { id: true } });
  await t.db.payment.update({ where: { id: payment.id }, data: { status: "held" } });
  return { recruiter, freelanceUser, contract: contract.id, payment: payment.id };
};

describe("mission payée jamais validée", () => {
  it("calcule la fin prévue : date de fin, sinon début plus les jours ouvrés", () => {
    expect(plannedEnd({ startsOn: new Date("2026-11-02"), endsOn: new Date("2026-11-30"), days: 10 })).toEqual(new Date("2026-11-30"));
    expect(plannedEnd({ startsOn: new Date("2026-11-02"), endsOn: null, days: 10 })).toEqual(new Date("2026-11-16"));
  });

  it(`relance les deux parties et marque le paiement à revoir ${VALIDATION_GRACE_DAYS} jours après la fin prévue, sans rien verser`, async () => {
    const end = new Date("2026-11-30T00:00:00Z");
    const late = await heldContract(new Date("2026-11-02T00:00:00Z"), end);
    const onTime = await heldContract(new Date("2026-11-02T00:00:00Z"), new Date("2026-12-20T00:00:00Z"));
    const now = new Date(end.getTime() + (VALIDATION_GRACE_DAYS + 1) * DAY_MS);

    expect(await validationReminders(t.db).flagOverdue(now)).toBe(1);
    expect(await t.db.payment.findUniqueOrThrow({ where: { id: late.payment }, select: { status: true, needsReviewAt: true } })).toEqual({ status: "held", needsReviewAt: now });
    expect(await t.db.payment.findUniqueOrThrow({ where: { id: onTime.payment }, select: { needsReviewAt: true } })).toEqual({ needsReviewAt: null });
    const reminded = await t.db.notification.findMany({ where: { kind: "contract_update", payload: { path: ["contractId"], equals: late.contract } }, select: { userId: true, payload: true } });
    expect(reminded.map((n) => n.userId).sort()).toEqual([late.recruiter, late.freelanceUser].sort());
    expect(reminded.every((n) => (n.payload as { status?: string }).status === "validation_due")).toBe(true);

    // Rejoué : rien de plus, ni marque ni relance.
    expect(await validationReminders(t.db).flagOverdue(new Date(now.getTime() + DAY_MS))).toBe(0);
    expect(await t.db.notification.count({ where: { kind: "contract_update", payload: { path: ["contractId"], equals: late.contract } } })).toBe(2);
  });

  it("ne relance pas avant la fin du délai", async () => {
    const end = new Date("2027-01-31T00:00:00Z");
    const c = await heldContract(new Date("2027-01-04T00:00:00Z"), end);
    // D'autres contrats de ce fichier peuvent être en retard à cette date : seul celui-ci compte ici.
    await validationReminders(t.db).flagOverdue(new Date(end.getTime() + (VALIDATION_GRACE_DAYS - 1) * DAY_MS));
    expect(await t.db.payment.findUniqueOrThrow({ where: { id: c.payment }, select: { needsReviewAt: true } })).toEqual({ needsReviewAt: null });
  });
});
