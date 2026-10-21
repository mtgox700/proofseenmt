import { describe, expect, it } from "vitest";
import { renderCityPage } from "../src/city-page";
import { NO_COMPANY_FILTERS, renderCompanyDirectory } from "../src/company-directory";
import { renderCompanyPage, type CompanyPageModel } from "../src/company-page";
import { renderJobIndex, type JobIndexFilters } from "../src/job-index";
import { renderJobPage } from "../src/job-page";
import type { PublicMission } from "../src/job-posting";
import { LEDGER_STYLES } from "../src/ledger";

/*
 * Lot e de la refonte : missions et entreprises parlent la grammaire du registre. Ce que ces tests protègent :
 * le vert ne se pose que sur un fait vérifié par un tiers (l'activité au répertoire officiel, datée), chaque page a un
 * état vide honnête avec une action, et aucune page ne porte de script hors JSON-LD ni de texte caché.
 */

const BASE = "https://proofseen.com";
const AT = new Date("2026-10-19T09:00:00Z");
const CHECKED = new Date("2026-10-07T00:00:00Z");

const MISSION: PublicMission = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  organisationName: "Acme",
  organisationSlug: "acme",
  organisationRegistryActiveCheckedAt: CHECKED,
  organisationResponse: { medianDays: 3, decided: 12 },
  title: "Développeur Rust",
  description: "Embarqué.",
  skills: ["Rust"],
  durationMonths: 4,
  dailyRateMinCents: 60_000,
  dailyRateMaxCents: 70_000,
  currency: "EUR",
  city: "Lyon",
  workMode: "onsite",
  publishedAt: AT,
};
const UNCHECKED: PublicMission = { ...MISSION, id: "0199a1b2-0000-7000-8000-000000000002", organisationRegistryActiveCheckedAt: null, organisationResponse: null };
const PLAIN: JobIndexFilters = { mode: [], skill: "", city: "", sort: "recent", page: 1 };

const COMPANY: CompanyPageModel = {
  slug: "acme",
  name: "Acme",
  description: "Studio.",
  website: null,
  city: "Lyon",
  memberSince: new Date("2026-09-01T00:00:00Z"),
  registryActiveCheckedAt: CHECKED,
  response: { medianDays: 2, decided: 7 },
  missions: [{ id: MISSION.id, title: MISSION.title, workMode: "onsite", city: "Lyon", publishedAt: AT }],
  generatedAt: AT,
};
const FACETS = { total: 1, cities: [], kinds: [], hiring: 1, registryActive: 1 };
const NO_FACETS = { total: 0, cities: [], kinds: [], hiring: 0, registryActive: 0 };
const CARD = { slug: "acme", name: "Acme", city: "Lyon", kind: "pme" as const, registryActiveCheckedAt: CHECKED, memberSince: COMPANY.memberSince, openMissions: 1, response: { medianDays: 2, decided: 7 } };

const PAGES: Readonly<Record<string, string>> = {
  mission: renderJobPage(MISSION, { baseUrl: BASE, lang: "fr", applyHref: "/fr/app/missions/x/postuler" }),
  "mission, unchecked company, EN": renderJobPage(UNCHECKED, { baseUrl: BASE, lang: "en", applyHref: "/en/app/missions/x/postuler" }),
  index: renderJobIndex([MISSION, UNCHECKED], { baseUrl: BASE, lang: "fr", filters: PLAIN, hasMore: false }),
  "index, nothing open": renderJobIndex([], { baseUrl: BASE, lang: "fr", filters: PLAIN, hasMore: false }),
  "index, filtered, EN": renderJobIndex([], { baseUrl: BASE, lang: "en", filters: { ...PLAIN, mode: ["remote"] }, hasMore: false }),
  city: renderCityPage(
    { key: "lyon", label: "Lyon", missions: [MISSION], facts: { missionCount: 1, skills: ["Rust"], dailyRate: { n: 6, minCents: 50_000, maxCents: 70_000, currency: "EUR" } }, generatedAt: AT },
    { baseUrl: BASE, lang: "fr" },
  ),
  company: renderCompanyPage(COMPANY, { baseUrl: BASE, lang: "fr" }),
  "company, unchecked, no mission, EN": renderCompanyPage({ ...COMPANY, registryActiveCheckedAt: null, response: null, missions: [] }, { baseUrl: BASE, lang: "en" }),
  directory: renderCompanyDirectory([CARD, { ...CARD, slug: "beta", name: "Beta", registryActiveCheckedAt: null }], { baseUrl: BASE, lang: "fr", filters: NO_COMPANY_FILTERS, facets: FACETS, hasMore: false }),
  "directory, nobody": renderCompanyDirectory([], { baseUrl: BASE, lang: "fr", filters: NO_COMPANY_FILTERS, facets: NO_FACETS, hasMore: false }),
};

/** Ce qui suit chaque carré plein (vert) : le texte qu'il marque. */
const greenMarks = (html: string): string[] => [...html.matchAll(/<span class="pin" aria-hidden="true"><\/span>(?:<span>)?([^<]{0,60})/g)].map((m) => m[1] ?? "");

const VERIFIED = /^(Entreprise active au répertoire officiel|Business active in the official|entreprise active au répertoire officiel, date du contrôle|company active in the official register, date of the check|vérifié par un tiers, daté)/;

describe("lot e : le vert ne marque que le vérifié", () => {
  it("la feuille de style ne donne la couleur du poinçon qu'au carré plein", () => {
    expect(LEDGER_STYLES.match(/var\(--ps-proof\)/g)).toHaveLength(1);
    expect(LEDGER_STYLES).toContain(".pin{flex:none;display:inline-block;width:8px;height:8px;background:var(--ps-proof)}");
  });

  it.each(Object.entries(PAGES))("%s : chaque carré vert précède un fait contrôlé au répertoire officiel, ou la légende qui le dit", (_name, html) => {
    for (const text of greenMarks(html)) expect(text).toMatch(VERIFIED);
  });

  it("une entreprise non contrôlée n'a aucun vert, et sa ligne le dit", () => {
    for (const name of ["mission, unchecked company, EN", "company, unchecked, no mission, EN"]) {
      expect(greenMarks(PAGES[name] ?? "")).toEqual([]);
      expect(PAGES[name]).toContain("Not confirmed as active in the official French company register");
    }
  });

  it("le délai de réponse et l'inscription, mesurés sur Proofseen, portent un carré neutre", () => {
    expect(PAGES.company).toContain('<span class="pin open" aria-hidden="true"></span><span>Répond aux candidatures en 2 jours');
    expect(PAGES.company).toContain('<span class="pin open" aria-hidden="true"></span><span>Inscrite sur Proofseen depuis le 1 septembre 2026.');
    expect(PAGES.mission).toContain('<span class="pin open" aria-hidden="true"></span><span>Répond aux candidatures en 3 jours');
  });
});

describe("lot e : états vides honnêtes, avec une action", () => {
  it("chaque liste vide le dit dans un cadre, et propose un lien", () => {
    for (const name of ["index, nothing open", "index, filtered, EN", "company, unchecked, no mission, EN", "directory, nobody"]) {
      const html = PAGES[name] ?? "";
      expect(html, name).toContain('<div class="blank">');
      expect(html, name).toMatch(/<ul class="acts"><li><a href="\/(fr|en)\//);
    }
    expect(PAGES["company, unchecked, no mission, EN"]).toContain("No open mission at the moment.");
    expect(PAGES["index, filtered, EN"]).toContain("No mission matches these filters.");
  });
});

describe("lot e : hiérarchie d'une mission", () => {
  it("trace datée en tête, intitulé, entreprise, contexte, et « Postuler » dans le rail et en fin de page", () => {
    const html = PAGES.mission ?? "";
    const order = ['<p class="ref"><time datetime="2026-10-19">Mission ouverte · publiée le 19 octobre 2026</time></p>', '<h1 class="title">', "Proposée par", '<dl class="ctx">', '<aside class="rail"'];
    const at = order.map((s) => html.indexOf(s));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html.match(/<a class="cta" href="\/fr\/app\/missions\/x\/postuler">Postuler sur Proofseen<\/a>/g)).toHaveLength(2);
  });
});

describe("lot e : aucune page ne porte de script hors JSON-LD ni de texte caché", () => {
  it.each(Object.entries(PAGES))("%s", (_name, html) => {
    for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/gi)) expect(attrs).toContain('type="application/ld+json"');
    expect(html).not.toMatch(/\son[a-z]+=/i);
    const css = html.replace(/[.>\w]*::-webkit-details-marker\{display:none\}/g, "");
    expect(css).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
    expect(html).not.toContain(String.fromCodePoint(0x2014));
    // Un survol n'existe que là où il existe (ou s'annule en mouvement réduit).
    for (const line of html.split(/(?=@media)/).filter((l) => /:hover/.test(l))) expect(line).toMatch(/^@media \((hover:hover\) and \(pointer:fine\)|prefers-reduced-motion)/);
  });
});
