import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missions, type MissionInput } from "../src/missions";
import { foldText, missionSearchText } from "../src/search-text";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Recherche insensible aux accents : le pliage de l'application, le même pliage en SQL pour les missions existantes
 * (migration 20261017090000_search_unaccent), et la recherche qui trouve « développeur » quand on tape « developpeur ».
 */

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, "../prisma/migrations");
const THIS_MIGRATION = "20261017090000_search_unaccent";

const migrationsSql = (keep: (name: string) => boolean): string =>
  readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && keep(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"))
    .join("\n");

const SAMPLES = [
  "Développeur Full-Stack",
  "DÉVELOPPEUSE ÉLÉGANTE",
  "Ingénieur données à Besançon",
  "Cœur de métier, æquo, Straße",
  "Crème brûlée façon Noël, naïve, où, ça",
  "São Paulo, Kraków, Øresund, Łódź, İstanbul, ñandú",
  "rust go c++ .net",
];

describe("pliage du texte cherché", () => {
  it("retire les accents, met en minuscules et défait les ligatures", () => {
    expect(foldText("Développeur Full-Stack")).toBe("developpeur full-stack");
    expect(foldText("DÉVELOPPEUSE ÉLÉGANTE")).toBe("developpeuse elegante");
    expect(foldText("Cœur, Æ, Straße")).toBe("coeur, ae, strasse");
    expect(foldText("Øresund Łódź")).toBe("oresund lodz");
    expect(missionSearchText("Data Ingénieur", "Équipe à Lyon.", "Python dbt")).toBe("data ingenieur equipe a lyon. python dbt");
  });
});

describe("migration : les missions existantes reçoivent le même texte plié", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(migrationsSql((name) => name < THIS_MIGRATION));
  }, DB_STARTUP_MS);

  afterAll(async () => {
    await pg.close();
  });

  it("remplit searchText comme l'application, et la fonction SQL plie comme foldText", async () => {
    const { rows: users } = await pg.query<{ id: string }>(`INSERT INTO "User" ("id","clerkId","email","displayName") VALUES (gen_random_uuid(), 'c1', 'a@test.fr', 'x') RETURNING "id"`);
    const { rows: orgs } = await pg.query<{ id: string }>(`INSERT INTO "Organisation" ("id","name","kind") VALUES (gen_random_uuid(), 'Acme', 'pme') RETURNING "id"`);
    expect(users).toHaveLength(1);
    const org = orgs[0]?.id ?? "";
    await pg.query(
      `INSERT INTO "JobPost" ("id","organisationId","title","description","currency","workMode","status","publishedAt","skillsText")
       VALUES (gen_random_uuid(), $1, 'Développeur Élixir', 'Équipe à Besançon, cœur du métier.', 'EUR', 'remote', 'open', now(), 'Élixir Phœnix')`,
      [org],
    );

    await pg.exec(readFileSync(join(MIGRATIONS, THIS_MIGRATION, "migration.sql"), "utf8"));

    const { rows } = await pg.query<{ searchText: string }>(`SELECT "searchText" FROM "JobPost"`);
    expect(rows[0]?.searchText).toBe(missionSearchText("Développeur Élixir", "Équipe à Besançon, cœur du métier.", "Élixir Phœnix"));
    for (const sample of SAMPLES) {
      const { rows: folded } = await pg.query<{ f: string }>(`SELECT proofseen_fold($1) AS f`, [sample]);
      expect(folded[0]?.f).toBe(foldText(sample));
    }
  });
});

describe("recherche de missions sans accents", () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await openTestDatabase();
  }, DB_STARTUP_MS);

  afterAll(async () => {
    await t.close();
  });

  const BASE: MissionInput = {
    title: "Mission",
    description: "Description de la mission.",
    skills: [],
    durationMonths: 3,
    dailyRateMinCents: 50_000,
    dailyRateMaxCents: 60_000,
    city: null,
    workMode: "remote",
  };

  const published = async (input: Partial<MissionInput>, at: Date) => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const draft = await missions(t.db).create({ userId: recruiter }, org, { ...BASE, ...input });
    if (draft === null) throw new Error("mission non créée");
    await missions(t.db).publish({ userId: recruiter }, draft.id, at);
    return { id: draft.id, recruiter };
  };

  const ids = async (q: string, sort: "recent" | "rate_desc" = "recent") => (await missions(t.db).search({ q, sort })).items.map((m) => m.id);

  it("« developpeur » trouve « Développeur », et l'inverse ; les compétences aussi", async () => {
    const accented = await published({ title: "Développeur Élixir sénior", skills: ["Données temps réel"] }, new Date("2026-10-10T09:00:00Z"));
    const plain = await published({ title: "Developpeur Elixir junior", description: "Equipe a Besancon." }, new Date("2026-10-11T09:00:00Z"));

    expect(await ids("developpeur elixir")).toEqual([plain.id, accented.id]);
    expect(await ids("Développeur Élixir")).toEqual([plain.id, accented.id]);
    expect(await ids("DÉVELOPPEUR ELIXIR")).toEqual([plain.id, accented.id]);
    expect(await ids("senior elixir")).toEqual([accented.id]);
    expect(await ids("donnees temps reel")).toEqual([accented.id]);
    expect(await ids("besançon")).toEqual([plain.id]);
  });

  it("reste un filtre : l'ordre choisi est gardé", async () => {
    const low = await published({ title: "Intégrateur Gloubiboulga", dailyRateMinCents: 30_000, dailyRateMaxCents: 35_000 }, new Date("2026-10-12T09:00:00Z"));
    const high = await published({ title: "Integrateur gloubiboulga", dailyRateMinCents: 80_000, dailyRateMaxCents: 90_000 }, new Date("2026-10-09T09:00:00Z"));
    expect(await ids("integrateur gloubiboulga")).toEqual([low.id, high.id]);
    expect(await ids("intégrateur gloubiboulga", "rate_desc")).toEqual([high.id, low.id]);
  });

  it("suit la modification d'une mission", async () => {
    const m = await published({ title: "Crème Zabaglione" }, new Date("2026-10-13T09:00:00Z"));
    expect(await ids("creme zabaglione")).toEqual([m.id]);
    const updated = await missions(t.db).update({ userId: m.recruiter }, m.id, { ...BASE, title: "Pâtisserie Zabaglione" });
    expect(updated.kind).toBe("ok");
    expect(await ids("creme zabaglione")).toEqual([]);
    expect(await ids("patisserie zabaglione")).toEqual([m.id]);
  });
});
