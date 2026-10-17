import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jobTitlePages } from "../src/job-title-pages";
import { JOB_TITLES, jobTitlesOf, matchesJobTitle } from "../src/job-titles";
import { missions } from "../src/missions";
import { profiles } from "../src/profiles";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

describe("taxonomie des postes", () => {
  it("une vingtaine de postes, clés d'adresse propres et uniques, libellés en deux langues", () => {
    expect(JOB_TITLES.length).toBeGreaterThanOrEqual(20);
    expect(JOB_TITLES.length).toBeLessThanOrEqual(30);
    expect(new Set(JOB_TITLES.map((t) => t.key)).size).toBe(JOB_TITLES.length);
    for (const t of JOB_TITLES) {
      expect(t.key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(t.label.fr.length).toBeGreaterThan(1);
      expect(t.label.en.length).toBeGreaterThan(1);
    }
  });

  it("reconnaît les intitulés, accents, casse et tirets compris", () => {
    const cases: readonly [string, string][] = [
      ["Développeur Full-Stack React / Node", "developpeur-full-stack"],
      ["Développeuse fullstack", "developpeur-full-stack"],
      ["Data Engineer Spark", "data-engineer"],
      ["Ingénieur de données GCP", "data-engineer"],
      ["Ingénieure DevOps", "devops-sre"],
      ["SRE senior", "devops-sre"],
      ["Product Designer UX/UI", "product-designer"],
      ["UX/UI designer", "product-designer"],
      ["Data Scientist NLP", "data-scientist"],
      ["Développeur mobile Flutter", "developpeur-mobile"],
      ["Développeur iOS", "developpeur-mobile"],
      ["Architecte Cloud AWS", "architecte-cloud"],
      ["Développeur Java / Spring", "developpeur-java"],
      ["Développeur .NET C#", "developpeur-dotnet"],
      ["Cheffe de projet SI", "chef-de-projet"],
      ["Ingénieur QA automatisation", "testeur-qa"],
      ["Pentesteur", "ingenieur-cybersecurite"],
      ["Ingénieur logiciel embarqué", "developpeur-embarque"],
    ];
    for (const [text, key] of cases) expect(jobTitlesOf(text), text).toContain(key);
  });

  it("ne confond pas les mots voisins", () => {
    expect(matchesJobTitle("developpeur-java", "Développeur JavaScript")).toBe(false);
    expect(matchesJobTitle("developpeur-javascript", "Développeur JavaScript")).toBe(true);
    expect(matchesJobTitle("testeur-qa", "Développeur Python, tests automatisés")).toBe(false);
    expect(matchesJobTitle("cto", "Doctorat en physique")).toBe(false);
    expect(matchesJobTitle("devops-sre", "Responsable des ressources")).toBe(false);
    expect(jobTitlesOf("Mission de conseil")).toEqual([]);
  });
});

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

let drawn = 0;
const nextReference = (): string => `FR-JT${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(drawn / 31) % 31]}Z`;

const publishProfile = async (headline: string, dailyRateCents: number | null = null, city = "Nantes") => {
  const userId = await createUser(t.db);
  await profiles(t.db).create({ userId }, { headline, summary: "Résumé.", city, workMode: "remote", skills: [], dailyRateCents }, nextReference);
  await profiles(t.db).setVisibility({ userId }, "pseudonymous");
  return userId;
};

const openMission = async (title: string, rate: number | null = null, org?: { readonly recruiter: string; readonly id: string }) => {
  const recruiter = org?.recruiter ?? (await createUser(t.db));
  const orgId = org?.id ?? (await createOrganisation(t.db, recruiter));
  const id =
    (await missions(t.db).create({ userId: recruiter }, orgId, { title, description: "Réelle.", workMode: "remote", skills: [], dailyRateMinCents: rate, dailyRateMaxCents: rate }))?.id ?? "";
  await missions(t.db).publish({ userId: recruiter }, id, new Date());
  return { id, recruiter, orgId };
};

describe("pages par poste", () => {
  it("n'existe qu'à partir de deux éléments réels, et entre alors à l'index", async () => {
    await publishProfile("Scrum Master certifié");
    expect(await jobTitlePages(t.db).page("scrum-master")).toBeNull();
    expect((await jobTitlePages(t.db).listForSitemap()).map((e) => e.key)).not.toContain("scrum-master");

    const m = await openMission("Coach agile pour une équipe produit");
    const page = await jobTitlePages(t.db).page("scrum-master");
    expect(page).toMatchObject({ key: "scrum-master", label: { fr: "Scrum master / coach agile" }, facts: { missionCount: 1, profileCount: 1, profileRate: null, missionRate: null } });
    expect(page?.missions.map((x) => x.id)).toEqual([m.id]);
    expect(page?.profiles.every((p) => p.displayName === null)).toBe(true);
    expect(await jobTitlePages(t.db).listForSitemap()).toContainEqual({ key: "scrum-master", label: { fr: "Scrum master / coach agile", en: "Scrum master / agile coach" }, missions: 1, profiles: 1 });
  });

  it("refuse une clé inconnue ou mal formée", async () => {
    expect(await jobTitlePages(t.db).page("inconnu")).toBeNull();
    expect(await jobTitlePages(t.db).page("../scrum-master")).toBeNull();
    expect(await jobTitlePages(t.db).page("Scrum-Master")).toBeNull();
  });

  it("exclut ce qu'un opérateur a masqué et les comptes suspendus", async () => {
    const hiddenMission = await openMission("Ingénieur Zigouigoui fiabilité SRE");
    const suspended = await publishProfile("SRE Zigouigoui");
    await openMission("SRE Zigouigoui junior");
    await openMission("DevOps Zigouigoui");
    const before = (await jobTitlePages(t.db).page("devops-sre"))?.facts;
    expect(before?.missionCount).toBe(3);
    expect(before?.profileCount).toBe(1);

    await t.db.jobPost.update({ where: { id: hiddenMission.id }, data: { moderatedAt: new Date(), moderationReason: "test" } });
    await t.db.user.update({ where: { id: suspended }, data: { suspendedAt: new Date(), suspensionReason: "test" } });
    const after = await jobTitlePages(t.db).page("devops-sre");
    expect(after?.facts).toMatchObject({ missionCount: 2, profileCount: 0 });
    expect(after?.missions.map((m) => m.id)).not.toContain(hiddenMission.id);
    expect((await jobTitlePages(t.db).listForSitemap()).find((e) => e.key === "devops-sre")).toMatchObject({ missions: 2, profiles: 0 });
  });

  it("une fourchette de TJM seulement à partir de cinq valeurs, et de trois entreprises côté missions", async () => {
    for (const rate of [40_000, 45_000, 50_000, 55_000]) await publishProfile("Data Scientist", rate);
    expect((await jobTitlePages(t.db).page("data-scientist"))?.facts.profileRate).toBeNull();
    await publishProfile("Data scientist senior", 70_000);
    expect((await jobTitlePages(t.db).page("data-scientist"))?.facts.profileRate).toEqual({ n: 5, minCents: 40_000, maxCents: 70_000, currency: "EUR" });

    // Six missions de deux entreprises : sous la règle des entreprises distinctes, aucune fourchette.
    const a = await openMission("Data scientist A", 60_000);
    const b = await openMission("Data scientist B", 62_000);
    const orgA = { recruiter: a.recruiter, id: a.orgId };
    const orgB = { recruiter: b.recruiter, id: b.orgId };
    for (const rate of [61_000, 63_000]) await openMission("Data scientist A+", rate, orgA);
    for (const rate of [64_000, 65_000]) await openMission("Data scientist B+", rate, orgB);
    expect((await jobTitlePages(t.db).page("data-scientist"))?.facts.missionRate).toBeNull();

    // Une troisième entreprise : au plus trois missions par entreprise, donc 3 + 3 + 1 = 7 valeurs.
    await openMission("Data scientist C", 90_000);
    const rate = (await jobTitlePages(t.db).page("data-scientist"))?.facts.missionRate;
    expect(rate).toMatchObject({ n: 7, publishers: 3, maxCents: 90_000, currency: "EUR" });
  });
});
