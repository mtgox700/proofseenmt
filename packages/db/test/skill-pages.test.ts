import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missions } from "../src/missions";
import { profiles } from "../src/profiles";
import { skillPages } from "../src/skill-pages";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

let drawn = 0;
const nextReference = (): string => `FR-SK${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}ZQ`;

const publishProfile = async (skills: string[], visibility: "named" | "pseudonymous" = "pseudonymous") => {
  const userId = await createUser(t.db);
  await profiles(t.db).create({ userId }, { headline: "Dev", summary: "Résumé.", city: "Nantes", workMode: "remote", skills }, nextReference);
  await profiles(t.db).setVisibility({ userId }, visibility);
};

const openMission = async (skills: string[]) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const id = (await missions(t.db).create({ userId: recruiter }, org, { title: `Mission ${skills.join(" ")}`, description: "Réelle.", workMode: "remote", skills }))?.id ?? "";
  await missions(t.db).publish({ userId: recruiter }, id, new Date());
};

describe("pages métiers", () => {
  it("n'existe pas sans assez de contenu réel, et apparaît dès qu'il y en a", async () => {
    await publishProfile(["Elixir"]);
    expect(await skillPages(t.db).page("elixir")).toBeNull();
    expect((await skillPages(t.db).listForSitemap()).map((s) => s.key)).not.toContain("elixir");

    await openMission(["Elixir"]);
    const page = await skillPages(t.db).page("elixir");
    expect(page).toMatchObject({ key: "elixir", label: "Elixir" });
    expect(page?.missions).toHaveLength(1);
    expect(page?.profiles).toHaveLength(1);
    expect((await skillPages(t.db).listForSitemap()).map((s) => s.key)).toContain("elixir");
  });

  it("ne compte ni les profils privés ni les missions en brouillon, et cache le nom d'un pseudonyme", async () => {
    const userId = await createUser(t.db);
    await profiles(t.db).create({ userId }, { headline: "Dev", summary: "Résumé.", city: "Nantes", workMode: "remote", skills: ["Haskell"] }, nextReference);
    const recruiter = await createUser(t.db);
    await missions(t.db).create({ userId: recruiter }, await createOrganisation(t.db, recruiter), { title: "Brouillon", description: "x", workMode: "remote", skills: ["Haskell"] });
    await publishProfile(["Haskell"]);
    expect(await skillPages(t.db).page("haskell")).toBeNull();

    await publishProfile(["Haskell"]);
    const page = await skillPages(t.db).page("haskell");
    expect(page?.profiles).toHaveLength(2);
    expect(page?.profiles.every((p) => p.displayName === null)).toBe(true);
  });

  it("compte ses faits dans la base, et ne publie la fourchette de TJM qu'à partir de cinq valeurs", async () => {
    const rated = async (city: string, dailyRateCents: number | null) => {
      const userId = await createUser(t.db);
      await profiles(t.db).create({ userId }, { headline: "Dev", summary: "Résumé.", city, workMode: "remote", dailyRateCents, skills: ["Erlang"] }, nextReference);
      await profiles(t.db).setVisibility({ userId }, "pseudonymous");
    };
    const now = new Date("2026-10-14T09:00:00Z");
    for (const rate of [50_000, 60_000, 70_000, 80_000]) await rated("Nantes", rate);
    await rated("nantes", null);
    await openMission(["Erlang"]);

    const four = await skillPages(t.db).page("erlang", now);
    expect(four?.facts).toEqual({ profileCount: 5, missionCount: 1, dailyRate: null, cities: ["Nantes"] });
    expect(four?.generatedAt).toEqual(now);

    await rated("Brest", 45_000);
    const five = await skillPages(t.db).page("erlang", now);
    expect(five?.facts.dailyRate).toEqual({ n: 5, minCents: 45_000, maxCents: 80_000, currency: "EUR" });
    expect(five?.facts.cities).toEqual(["Brest", "Nantes"]);
  });

  it("donne à l'index des métiers le libellé et les nombres de chaque page", async () => {
    const entry = (await skillPages(t.db).listForSitemap()).find((s) => s.key === "elixir");
    expect(entry).toEqual({ key: "elixir", label: "Elixir", missions: 1, profiles: 1 });
  });

  it("refuse une clé qui n'est pas sous sa forme normalisée", async () => {
    expect(await skillPages(t.db).page("Elixir")).toBeNull();
    expect(await skillPages(t.db).page("../etc")).toBeNull();
  });
});
