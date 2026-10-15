import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groupStats, MIN_BAROMETER_SAMPLE, missionRate, quantile, rateStat } from "../src/barometer-stats";
import { barometers, MIN_SKILL_DEMAND } from "../src/barometers";
import { missions } from "../src/missions";
import { profiles } from "../src/profiles";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

describe("statistiques des baromètres", () => {
  it("calcule les quartiles par interpolation linéaire", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(sorted, 0.5)).toBe(5.5);
    expect(quantile(sorted, 0.25)).toBe(3.25);
    expect(quantile(sorted, 0.75)).toBe(7.75);
    expect(quantile([42], 0.5)).toBe(42);
    expect(() => quantile([], 0.5)).toThrow(RangeError);
  });

  it("ne publie rien sous dix valeurs, et arrondit à l'euro avec n", () => {
    const nine = Array.from({ length: MIN_BAROMETER_SAMPLE - 1 }, (_, i) => 50_000 + i * 1_000);
    expect(rateStat("rust", "Rust", nine)).toBeNull();
    const ten = [...nine, 60_050];
    expect(rateStat("rust", "Rust", ten)).toEqual({ key: "rust", label: "Rust", n: 10, p25Cents: 52_300, medianCents: 54_500, p75Cents: 56_800 });
  });

  it("regroupe par clé, ne garde que les groupes au seuil, par ordre alphabétique", () => {
    const obs = [
      ...Array.from({ length: 10 }, () => ({ key: "zig", label: "Zig", value: 1_000 })),
      ...Array.from({ length: 10 }, () => ({ key: "ada", label: "Ada", value: 2_000 })),
      ...Array.from({ length: 9 }, () => ({ key: "go", label: "Go", value: 3_000 })),
    ];
    expect(groupStats(obs).map((s) => s.label)).toEqual(["Ada", "Zig"]);
  });

  it("prend le milieu de la fourchette d'une mission, ou sa seule borne", () => {
    expect(missionRate(50_000, 70_000)).toBe(60_000);
    expect(missionRate(null, 70_000)).toBe(70_000);
    expect(missionRate(50_000, null)).toBe(50_000);
    expect(missionRate(null, null)).toBeNull();
  });
});

let drawn = 0;
const nextReference = (): string => `FR-B${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(drawn / 31) % 31]}${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}QZ`;

const ratedProfile = async (dailyRateCents: number | null, city: string, skills: string[]) => {
  const userId = await createUser(t.db);
  await profiles(t.db).create({ userId }, { headline: "Dev", summary: "Résumé.", city, workMode: "remote", dailyRateCents, skills }, nextReference);
  await profiles(t.db).setVisibility({ userId }, "pseudonymous");
};

const publishedMission = async (skills: string[], rate: { min: number | null; max: number | null }, publishedAt: Date) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const created = await missions(t.db).create({ userId: recruiter }, org, {
    title: "Mission",
    description: "Réelle.",
    workMode: "hybrid",
    city: "Lyon",
    skills,
    dailyRateMinCents: rate.min,
    dailyRateMaxCents: rate.max,
  });
  await missions(t.db).publish({ userId: recruiter }, created?.id ?? "", publishedAt);
  return { recruiter, id: created?.id ?? "" };
};

describe("baromètre des TJM", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("dit qu'il n'y a pas assez de données plutôt que d'inventer une statistique", async () => {
    for (let i = 0; i < 3; i += 1) await ratedProfile(60_000, "Nantes", ["Kotlin"]);
    const rates = await barometers(t.db).rates(now);
    expect(rates.profiles.total).toBe(3);
    expect(rates.profiles.overall).toBeNull();
    expect(rates.profiles.bySkill).toEqual([]);
    expect(rates.profiles.byCity).toEqual([]);
    expect(rates.minSample).toBe(10);
  });

  it("publie un groupe dès dix profils, sans compter les profils privés ni ceux sans TJM", async () => {
    for (let i = 0; i < 7; i += 1) await ratedProfile(50_000 + i * 5_000, "Nantes", ["Kotlin"]);
    await ratedProfile(null, "Nantes", ["Kotlin"]);
    const hidden = await createUser(t.db);
    await profiles(t.db).create({ userId: hidden }, { headline: "Dev", summary: "Résumé.", city: "Nantes", workMode: "remote", dailyRateCents: 99_000, skills: ["Kotlin"] }, nextReference);

    const rates = await barometers(t.db).rates(now);
    expect(rates.profiles.total).toBe(10);
    expect(rates.profiles.bySkill).toEqual([expect.objectContaining({ key: "kotlin", label: "Kotlin", n: 10 })]);
    expect(rates.profiles.byCity).toEqual([expect.objectContaining({ label: "Nantes", n: 10 })]);
    expect(rates.profiles.overall?.n).toBe(10);
    expect(rates.computedAt).toEqual(now);
  });

  it("compte les missions ouvertes et les récentes, jamais les brouillons ni les anciennes clôturées", async () => {
    const recent = new Date("2026-10-01T00:00:00Z");
    for (let i = 0; i < 9; i += 1) await publishedMission(["Scala"], { min: 50_000, max: 70_000 }, recent);
    const old = await publishedMission(["Scala"], { min: 90_000, max: null }, new Date("2026-01-01T00:00:00Z"));
    await missions(t.db).close({ userId: old.recruiter }, old.id, new Date("2026-02-01T00:00:00Z"));
    const recruiter = await createUser(t.db);
    await missions(t.db).create({ userId: recruiter }, await createOrganisation(t.db, recruiter), { title: "Brouillon", description: "x", workMode: "remote", skills: ["Scala"], dailyRateMinCents: 10_000 });
    expect((await barometers(t.db).rates(now)).missions.bySkill).toEqual([]);

    const closedRecently = await publishedMission(["Scala"], { min: null, max: 80_000 }, new Date("2026-09-20T00:00:00Z"));
    await missions(t.db).close({ userId: closedRecently.recruiter }, closedRecently.id, new Date("2026-10-10T00:00:00Z"));
    const rates = await barometers(t.db).rates(now);
    expect(rates.missions.bySkill).toEqual([{ key: "scala", label: "Scala", n: 10, p25Cents: 60_000, medianCents: 60_000, p75Cents: 60_000 }]);
    expect(rates.missions.byCity).toEqual([expect.objectContaining({ label: "Lyon", n: 10 })]);
  });
});

describe("baromètre des compétences demandées", () => {
  it("compte les missions des quatre-vingt-dix derniers jours, seulement à partir de cinq par compétence", async () => {
    const now = new Date("2027-06-01T12:00:00Z");
    const inWindow = new Date("2027-05-01T00:00:00Z");
    for (let i = 0; i < MIN_SKILL_DEMAND; i += 1) await publishedMission(["Elm", "OCaml"], { min: null, max: null }, inWindow);
    for (let i = 0; i < MIN_SKILL_DEMAND - 1; i += 1) await publishedMission(["Nim"], { min: null, max: null }, inWindow);
    await publishedMission(["Elm"], { min: null, max: null }, inWindow);
    await publishedMission(["Elm"], { min: null, max: null }, new Date("2027-01-01T00:00:00Z"));

    const demand = await barometers(t.db).skills(now);
    expect(demand.skills).toEqual([
      { key: "elm", label: "Elm", missions: 6 },
      { key: "ocaml", label: "OCaml", missions: 5 },
    ]);
    expect(demand.totalMissions).toBe(10);
    expect(demand.minCount).toBe(5);
    expect(demand.since).toEqual(new Date("2027-03-03T12:00:00Z"));
  });
});
