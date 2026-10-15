import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cityPages, MIN_CITY_MISSIONS } from "../src/city-pages";
import { missionTemplates, MAX_TEMPLATES_PER_ORGANISATION } from "../src/mission-templates";
import { missions, type MissionInput } from "../src/missions";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

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

const company = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  return { recruiter, org };
};

/** Une mission publiée à la date donnée. */
const published = async (input: Partial<MissionInput>, at = new Date("2026-10-10T09:00:00Z")) => {
  const { recruiter, org } = await company();
  const draft = await missions(t.db).create({ userId: recruiter }, org, { ...BASE, ...input });
  if (draft === null) throw new Error("mission non créée");
  await missions(t.db).publish({ userId: recruiter }, draft.id, at);
  return { id: draft.id, recruiter, org };
};

const ids = async (filters: Parameters<ReturnType<typeof missions>["search"]>[0]) => (await missions(t.db).search(filters)).items.map((m) => m.id);

describe("recherche plein texte : un filtre, jamais un classement", () => {
  it("trouve dans l'intitulé, la description et les compétences, en français et en anglais", async () => {
    const fr = await published({ title: "Migrations de bases Zorglub", description: "Nous migrons des entrepôts de données." });
    const en = await published({ title: "Zorglub platform engineer", description: "Running Kubernetes clusters for payments." });
    const skill = await published({ title: "Développeuse backend", skills: ["Zorglubscript"], description: "Équipe de six." });
    // Un brouillon n'est pas public : la recherche ne le voit pas.
    const owner = await company();
    expect(await missions(t.db).create({ userId: owner.recruiter }, owner.org, { ...BASE, title: "Zorglub brouillon" })).not.toBeNull();

    // Racines françaises et anglaises : « migration » trouve « migrations », « cluster » trouve « clusters ».
    expect(await ids({ q: "migration zorglub" })).toEqual([fr.id]);
    expect(await ids({ q: "cluster" })).toContain(en.id);
    expect(await ids({ q: "développeuses" })).toContain(skill.id);
    expect(await ids({ q: "zorglubscript" })).toEqual([skill.id]);
    // Une recherche sans résultat reste une liste vide, pas une erreur ; un mot vide ne filtre rien de travers.
    expect(await ids({ q: "introuvablexyz" })).toEqual([]);
  });

  it("garde l'ordre choisi par le visiteur, pas une pertinence", async () => {
    const low = await published({ title: "Quuxification légère", dailyRateMinCents: 30_000, dailyRateMaxCents: 35_000 }, new Date("2026-10-11T09:00:00Z"));
    const high = await published({ title: "Quuxification lourde quux quux quux", dailyRateMinCents: 80_000, dailyRateMaxCents: 90_000 }, new Date("2026-10-09T09:00:00Z"));
    expect(await ids({ q: "quuxification", sort: "recent" })).toEqual([low.id, high.id]);
    expect(await ids({ q: "quuxification", sort: "rate_desc" })).toEqual([high.id, low.id]);
    expect(await ids({ q: "quuxification", sort: "rate_asc" })).toEqual([low.id, high.id]);
  });

  it("ne trouve plus une mission clôturée", async () => {
    const m = await published({ title: "Plopinette à clôturer" });
    expect(await ids({ q: "plopinette" })).toEqual([m.id]);
    await missions(t.db).close({ userId: m.recruiter }, m.id, new Date());
    expect(await ids({ q: "plopinette" })).toEqual([]);
  });

  it("filtre le TJM par le bas et par le haut, et la date de publication", async () => {
    const cheap = await published({ title: "Wibble petit budget", dailyRateMinCents: 30_000, dailyRateMaxCents: 40_000 }, new Date("2026-09-01T09:00:00Z"));
    const dear = await published({ title: "Wibble grand budget", dailyRateMinCents: 90_000, dailyRateMaxCents: 100_000 }, new Date("2026-10-14T09:00:00Z"));
    expect(await ids({ q: "wibble", maxDailyRateCents: 50_000 })).toEqual([cheap.id]);
    expect(await ids({ q: "wibble", minDailyRateCents: 95_000 })).toEqual([dear.id]);
    expect(await ids({ q: "wibble", publishedAfter: new Date("2026-10-01T00:00:00Z") })).toEqual([dear.id]);
  });
});

describe("pages par ville : seulement avec assez de missions réelles", () => {
  it("n'existe qu'à partir de deux missions ouvertes, et entre alors au sitemap", async () => {
    const first = await published({ title: "Mission à Montbrison", city: "Montbrison", workMode: "onsite", skills: ["Rust"] });
    expect(await cityPages(t.db).page("montbrison")).toBeNull();
    expect((await cityPages(t.db).listForSitemap()).map((c) => c.key)).not.toContain("montbrison");

    const second = await published({ title: "Autre mission à Montbrison", city: "montbrison", workMode: "hybrid", skills: ["Go"] }, new Date("2026-10-12T09:00:00Z"));
    const page = await cityPages(t.db).page("montbrison");
    expect(page?.missions.map((m) => m.id)).toEqual([second.id, first.id]);
    expect(page?.facts).toMatchObject({ missionCount: MIN_CITY_MISSIONS, skills: ["Go", "Rust"], dailyRate: null });
    expect(page?.label).toBe("montbrison");
    expect(await cityPages(t.db).listForSitemap()).toContainEqual({ key: "montbrison", label: "montbrison", missions: 2 });

    // Une clé mal formée ou non normalisée ne répond pas : pas de doublon d'adresse pour une même ville.
    expect(await cityPages(t.db).page("Montbrison")).toBeNull();
    expect(await cityPages(t.db).page("../montbrison")).toBeNull();

    await missions(t.db).close({ userId: second.recruiter }, second.id, new Date());
    expect(await cityPages(t.db).page("montbrison")).toBeNull();
  });
});

describe("modèles et duplication : l'entreprise seule, jamais publics", () => {
  it("enregistre un modèle, le relit, et duplique une mission en brouillon", async () => {
    const m = await published({ title: "Lead data", skills: ["dbt"], questions: ["Votre dernier projet dbt ?"] });
    const outsider = await createUser(t.db);
    expect(await missionTemplates(t.db).saveFromMission({ userId: outsider }, m.id, "Volé")).toEqual({ kind: "absent" });

    const saved = await missionTemplates(t.db).saveFromMission({ userId: m.recruiter }, m.id, "Data");
    expect(saved.kind).toBe("saved");
    const list = await missionTemplates(t.db).list({ userId: m.recruiter }, m.org);
    expect(list).toMatchObject([{ name: "Data", title: "Lead data" }]);
    expect(await missionTemplates(t.db).list({ userId: outsider }, m.org)).toBeNull();
    const templateId = list?.[0]?.id ?? "";
    expect((await missionTemplates(t.db).get({ userId: m.recruiter }, templateId))?.input).toMatchObject({ title: "Lead data", skills: ["dbt"], questions: ["Votre dernier projet dbt ?"] });
    expect(await missionTemplates(t.db).get({ userId: outsider }, templateId)).toBeNull();
    expect(await missionTemplates(t.db).remove({ userId: outsider }, templateId)).toBe(false);

    const copy = await missionTemplates(t.db).duplicate({ userId: m.recruiter }, m.id);
    expect(copy).toMatchObject({ status: "draft", title: "Lead data", skills: ["dbt"], questions: ["Votre dernier projet dbt ?"], publishedAt: null });
    expect(copy?.id).not.toBe(m.id);
    expect(await missionTemplates(t.db).duplicate({ userId: outsider }, m.id)).toBeNull();
    expect(await missionTemplates(t.db).remove({ userId: m.recruiter }, templateId)).toBe(true);
  });

  it(`plafonne à ${MAX_TEMPLATES_PER_ORGANISATION} modèles par entreprise`, async () => {
    const m = await published({ title: "Modèle répété" });
    for (let i = 0; i < MAX_TEMPLATES_PER_ORGANISATION; i += 1) {
      expect((await missionTemplates(t.db).saveFromMission({ userId: m.recruiter }, m.id, `M${i}`)).kind).toBe("saved");
    }
    expect(await missionTemplates(t.db).saveFromMission({ userId: m.recruiter }, m.id, "De trop")).toEqual({ kind: "limit" });
  });
});
