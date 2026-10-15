import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { companyInsights, medianDays, spendOf } from "../src/company-insights";
import { freelanceInsights, revenueByMonth } from "../src/freelance-insights";
import { daysEnding, monthsEnding, parisDay, retentionStart } from "../src/stat-days";
import { users } from "../src/users";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Les tableaux de bord relus contre la base : chaque chiffre se recalcule à la main depuis les lignes posées ici.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-15T10:00:00Z");
const day = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const DAY_MS = 86_400_000;

describe("jours et mois", () => {
  it("lit le jour à Paris, et compte les jours et les mois à rebours", () => {
    expect(parisDay(new Date("2026-10-14T22:30:00Z"))).toBe("2026-10-15");
    expect(parisDay(new Date("2026-10-14T21:30:00Z"))).toBe("2026-10-14");
    expect(daysEnding("2026-03-01", 3)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
    expect(monthsEnding("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(retentionStart("2026-10-15")).toBe("2025-09-15");
    expect(retentionStart("2026-12-31")).toBe("2025-11-30");
  });
});

describe("tableau de bord freelance", () => {
  it("rend 90 jours complets, les filtres les plus fréquents et des revenus à zéro sans paiement", async () => {
    const owner = await createUser(t.db);
    const profileId = await createProfile(t.db, owner);
    await t.db.profileStatDay.createMany({
      data: [
        { profileId, day: day("2026-10-15"), views: 3, searchAppearances: 5, directoryAppearances: 1, listAdds: 1 },
        { profileId, day: day("2026-09-01"), views: 2, searchAppearances: 0, directoryAppearances: 4, listAdds: 0 },
        // Hors fenêtre : plus de 90 jours avant.
        { profileId, day: day("2026-06-01"), views: 50, searchAppearances: 0, directoryAppearances: 0, listAdds: 0 },
      ],
    });
    await t.db.profileStatKeyword.createMany({
      data: [
        { profileId, day: day("2026-10-15"), kind: "skill", keyword: "react", appearances: 3 },
        { profileId, day: day("2026-10-14"), kind: "skill", keyword: "react", appearances: 2 },
        { profileId, day: day("2026-10-14"), kind: "city", keyword: "lyon", appearances: 4 },
        { profileId, day: day("2026-06-01"), kind: "skill", keyword: "cobol", appearances: 40 },
      ],
    });
    const insights = await freelanceInsights(t.db).forFreelance({ userId: owner }, NOW);
    expect(insights?.days).toHaveLength(90);
    expect(insights?.days.at(-1)).toEqual({ day: "2026-10-15", views: 3, searchAppearances: 5, directoryAppearances: 1, listAdds: 1 });
    expect(insights?.days[0]?.day).toBe("2026-07-18");
    expect(insights?.days.reduce((sum, d) => sum + d.views, 0)).toBe(5);
    expect(insights?.keywords).toEqual([
      { kind: "skill", keyword: "react", appearances: 5 },
      { kind: "city", keyword: "lyon", appearances: 4 },
    ]);
    expect(insights?.revenue?.months).toHaveLength(12);
    expect(insights?.revenue?.months.every((m) => m.receivedCents === 0 && m.heldCents === 0)).toBe(true);
    expect(await freelanceInsights(t.db).forFreelance({ userId: await createUser(t.db) }, NOW)).toBeNull();
  });

  it("place le versé au mois du versement et le bloqué au mois du paiement, net de commission", () => {
    const months = ["2026-09", "2026-10"];
    const base = { amountCents: 100_000, commissionCents: 10_000, currency: "EUR" };
    const revenue = revenueByMonth(
      [
        { ...base, status: "released", createdAt: new Date("2026-09-10T10:00:00Z"), releasedAt: new Date("2026-10-02T10:00:00Z") },
        { ...base, status: "held", createdAt: new Date("2026-09-20T10:00:00Z"), releasedAt: null },
        { ...base, status: "refunded", createdAt: new Date("2026-09-20T10:00:00Z"), releasedAt: null },
      ],
      months,
      "EUR",
    );
    // 100 000 − 10 000 de commission − 2 000 de TVA sur la commission
    expect(revenue).toEqual({ currency: "EUR", months: [{ month: "2026-09", receivedCents: 0, heldCents: 88_000 }, { month: "2026-10", receivedCents: 88_000, heldCents: 0 }] });
    expect(revenueByMonth([{ ...base, status: "held", createdAt: NOW, releasedAt: null }, { ...base, currency: "CHF", status: "held", createdAt: NOW, releasedAt: null }], months, "EUR")).toBeNull();
  });
});

describe("tableau de bord entreprise", () => {
  it("compte missions et candidatures par étape, le délai médian, les publications par mois et l'activité de l'équipe", async () => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const mission = await t.db.jobPost.create({
      data: { organisationId: org, title: "Mission", description: "x", currency: "EUR", workMode: "remote", status: "open", publishedAt: new Date("2026-09-03T10:00:00Z") },
      select: { id: true },
    });
    await t.db.jobPost.create({ data: { organisationId: org, title: "Brouillon", description: "x", currency: "EUR", workMode: "remote" } });
    const applied = new Date("2026-10-01T10:00:00Z");
    const statuses = [
      { status: "submitted" as const, after: 0 },
      { status: "shortlisted" as const, after: 1 },
      { status: "declined" as const, after: 3 },
      { status: "hired" as const, after: 2 },
    ];
    for (const { status, after } of statuses) {
      const profileId = await createProfile(t.db, await createUser(t.db));
      await t.db.application.create({ data: { jobPostId: mission.id, profileId, coverNote: "Bonjour", status, createdAt: applied, updatedAt: new Date(applied.getTime() + after * DAY_MS) } });
    }
    await t.db.organisationStatDay.createMany({ data: [{ organisationId: org, day: day("2026-10-10"), searches: 4 }, { organisationId: org, day: day("2026-01-10"), searches: 99 }] });
    const list = await t.db.freelanceList.create({ data: { organisationId: org, name: "Vivier", createdByUserId: recruiter }, select: { id: true } });
    await t.db.freelanceListItem.create({ data: { listId: list.id, profileId: await createProfile(t.db, await createUser(t.db)), addedByUserId: recruiter } });

    const insights = await companyInsights(t.db).forCompany({ userId: recruiter }, org, NOW);
    expect(insights?.missions).toEqual({ open: 1, draft: 1 });
    expect(insights?.applications).toEqual({ submitted: 1, shortlisted: 1, declined: 1, hired: 1 });
    expect(insights?.firstResponse).toEqual({ medianDays: 2, decided: 3 });
    expect(insights?.publishedByMonth.find((m) => m.month === "2026-09")).toEqual({ month: "2026-09", count: 1 });
    expect(insights?.publishedByMonth).toHaveLength(12);
    expect(insights?.team).toEqual({ searches: 4, listsCreated: 1, profilesAdded: 1 });
    expect(insights?.spend?.months.every((m) => m.paidCents === 0 && m.heldCents === 0)).toBe(true);
    expect(insights?.spend?.costCentres).toEqual([]);
  });

  it("ne montre rien à qui n'est pas membre", async () => {
    const org = await createOrganisation(t.db, await createUser(t.db));
    expect(await companyInsights(t.db).forCompany({ userId: await createUser(t.db) }, org, NOW)).toBeNull();
    expect(await companyInsights(t.db).forCompany({ userId: await createUser(t.db) }, "pas-un-uuid", NOW)).toBeNull();
  });

  it("répartit les dépenses par mois et par centre de coûts, sans additionner deux devises", () => {
    const row = (status: string, amountCents: number, createdAt: string, costCenter: string | null, currency = "EUR") => ({ status, amountCents, currency, createdAt: new Date(createdAt), contract: { costCenter } });
    const spend = spendOf([row("released", 50_000, "2026-09-05T10:00:00Z", "R&D"), row("held", 20_000, "2026-10-05T10:00:00Z", null), row("releasing", 10_000, "2026-10-06T10:00:00Z", "R&D")], ["2026-09", "2026-10"]);
    expect(spend).toEqual({
      currency: "EUR",
      months: [
        { month: "2026-09", paidCents: 50_000, heldCents: 0 },
        { month: "2026-10", paidCents: 0, heldCents: 30_000 },
      ],
      costCentres: [
        { costCenter: "R&D", paidCents: 50_000, heldCents: 10_000 },
        { costCenter: null, paidCents: 0, heldCents: 20_000 },
      ],
    });
    expect(spendOf([row("held", 1, "2026-10-05T10:00:00Z", null), row("held", 1, "2026-10-05T10:00:00Z", null, "CHF")], ["2026-10"])).toBeNull();
  });

  it("prend la médiane au dixième de jour", () => {
    expect(medianDays([])).toBeNull();
    expect(medianDays([DAY_MS, 3 * DAY_MS])).toBe(2);
    expect(medianDays([DAY_MS / 2, DAY_MS, 10 * DAY_MS])).toBe(1);
    expect(medianDays([0.25 * DAY_MS])).toBe(0.3);
  });
});

describe("préférence de langue", () => {
  it("garde la langue des e-mails choisie, et refuse une langue non proposée", async () => {
    const person = await createUser(t.db);
    expect(await users(t.db).lang(person)).toBe("fr");
    expect(await users(t.db).setLang(person, "en")).toBe(true);
    expect(await users(t.db).lang(person)).toBe("en");
    expect(await users(t.db).setLang(person, "de")).toBe(false);
    expect(await users(t.db).lang(person)).toBe("en");
  });
});
