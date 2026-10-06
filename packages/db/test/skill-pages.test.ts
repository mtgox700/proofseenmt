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

  it("refuse une clé qui n'est pas sous sa forme normalisée", async () => {
    expect(await skillPages(t.db).page("Elixir")).toBeNull();
    expect(await skillPages(t.db).page("../etc")).toBeNull();
  });
});
