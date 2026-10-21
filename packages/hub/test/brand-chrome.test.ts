import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FONT_FILES, PALETTE, THEME_COLOR } from "@proofseen/brand";
import { describe, expect, it } from "vitest";
import { renderBlogIndex } from "../src/blog-index";
import { NO_COMPANY_FILTERS, renderCompanyDirectory } from "../src/company-directory";
import { pageHead } from "../src/head";
import { STANDALONE_STYLES, STYLES } from "../src/html";
import { renderJobIndex } from "../src/job-index";
import { renderJobPage } from "../src/job-page";
import type { PublicMission } from "../src/job-posting";
import { renderLegalPage } from "../src/legal-page";
import { marketHeader } from "../src/market-shell";
import { NO_DIRECTORY_FILTERS, renderProfileDirectory } from "../src/profile-directory";
import { renderProfilePage, type PublicProfile } from "../src/profile-page";
import { parseSimulatorQuery } from "../src/simulator";
import { renderSimulatorPage } from "../src/simulator-page";
import { renderSkillIndex } from "../src/skill-index";
import { notFoundPage } from "../src/status-pages";

/*
 * The brand of the public pages (lot a of the redesign): one head, one header, one footer for every document of the
 * hub. Each page preloads the display font, declares a browser colour per theme, announces its share card, offers a
 * skip link, and still ships no script but its JSON-LD.
 */

const BASE = "https://proofseen.com";

const PROFILE: PublicProfile = {
  reference: "FR-ABCDE",
  slug: "fr-abcde",
  visibility: "pseudonymous",
  displayName: null,
  headline: "Développeuse Rust",
  summary: "Systèmes embarqués.",
  city: "Lyon",
  workMode: "remote",
  availability: "available",
  availableFrom: null,
  dailyRateCents: 65_000,
  currency: "EUR",
  skills: ["Rust"],
  provenUrls: [],
  provenUrlCount: 0,
  missions: [],
  reviews: [],
  facts: { registryActiveCheckedAt: null, identityVerified: false, payingClients: 0, vigilanceValidUntil: null },
  updatedAt: new Date("2026-10-06T00:00:00Z"),
};

const MISSION: PublicMission = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  organisationName: "Acme",
  title: "Développeur Rust",
  description: "Embarqué.",
  skills: ["Rust"],
  durationMonths: 4,
  dailyRateMinCents: 60_000,
  dailyRateMaxCents: 60_000,
  currency: "EUR",
  city: "Lyon",
  workMode: "onsite",
  publishedAt: new Date("2026-10-19T09:00:00Z"),
};

const PAGES: Readonly<Record<string, string>> = {
  profile: renderProfilePage(PROFILE, { baseUrl: BASE, lang: "fr", contactHref: "/fr/creer-un-compte" }),
  "profile EN": renderProfilePage(PROFILE, { baseUrl: BASE, lang: "en", contactHref: "/en/creer-un-compte" }),
  mission: renderJobPage(MISSION, { baseUrl: BASE, lang: "fr", applyHref: "/fr/creer-un-compte" }),
  "mission index": renderJobIndex([MISSION], { baseUrl: BASE, lang: "fr", filters: { mode: [], skill: "", city: "", sort: "recent", page: 1 }, hasMore: false }),
  "freelancer directory": renderProfileDirectory([], { baseUrl: BASE, lang: "fr", filters: NO_DIRECTORY_FILTERS, hasMore: false, jobTitles: [] }),
  "company directory": renderCompanyDirectory([], {
    baseUrl: BASE,
    lang: "en",
    filters: NO_COMPANY_FILTERS,
    facets: { total: 0, cities: [], kinds: [], hiring: 0, registryActive: 0 },
    hasMore: false,
  }),
  "skill index": renderSkillIndex([{ key: "rust", label: "Rust", missions: 1, profiles: 1 }], { baseUrl: BASE, lang: "fr" }),
  blog: renderBlogIndex([], { baseUrl: BASE, lang: "fr", filters: { category: null, audience: null, page: 1 }, hasMore: false }),
  legal: renderLegalPage({ baseUrl: BASE, lang: "fr", page: "mentions-legales" }),
  simulator: renderSimulatorPage({ baseUrl: BASE, lang: "en", query: parseSimulatorQuery(new URLSearchParams()) }),
  "404": notFoundPage("en", { baseUrl: BASE }),
};

const head = (html: string): string => /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";

describe("the head of every public page", () => {
  it.each(Object.entries(PAGES))("%s: preloads the display font, one theme-color per theme, the share card", (_name, html) => {
    const h = head(html);
    expect(h).toContain(`<link rel="preload" href="${FONT_FILES.display}" as="font" type="font/woff2" crossorigin>`);
    expect(h).not.toContain(`rel="preload" href="${FONT_FILES.mono}"`);
    expect(h).toContain(`<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR.dark}">`);
    expect(h).toContain(`<meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR.light}">`);
    expect(h).toContain('<meta name="color-scheme" content="dark light">');
    expect(h).toMatch(/<meta property="og:image" content="https:\/\/proofseen\.com\/brand\/og-(fr|en)\.png">/);
    expect(h).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(h).toContain('<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">');
    expect(h).toContain('<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">');
    expect(h).not.toContain(String.fromCodePoint(0x2014));
  });

  it.each(Object.entries(PAGES))("%s: no script but JSON-LD, nothing hidden, a skip link to the main content", (_name, html) => {
    for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/gi)) expect(attrs).toContain('type="application/ld+json"');
    expect(html).not.toMatch(/\son[a-z]+=/i);
    // The disclosure triangle of the filter drawer is the one thing hidden (Safari draws it on its own): it is no text.
    const css = html.replace(/[.>\w]*::-webkit-details-marker\{display:none\}/g, "");
    expect(css).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
    expect(html).toContain('<a class="skip" href="#contenu">');
    expect(html).toMatch(/<main id="contenu"/);
    expect(html).toContain('<img src="/brand/ps-lockup-dark.svg" width="125" height="24" alt="Proofseen">');
    expect(html).toContain('<footer class="foot">');
  });

  it("announces the share card of the page language, with the page address", () => {
    expect(head(PAGES["profile EN"]!)).toContain('<meta property="og:image" content="https://proofseen.com/brand/og-en.png">');
    expect(head(PAGES.profile!)).toContain('<meta property="og:url" content="https://proofseen.com/fr/profils/fr-abcde">');
    expect(head(PAGES.profile!)).toContain('<meta property="og:type" content="profile">');
    expect(head(PAGES.profile!)).toContain('<meta property="og:locale" content="fr_FR">');
  });

  it("keeps the JSON-LD intact next to the new head", () => {
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(PAGES.profile!)?.[1] ?? "{}";
    expect(JSON.parse(ld)).toMatchObject({ "@context": "https://schema.org", "@type": "ProfilePage" });
  });

  it("escapes what it is given", () => {
    const lines = pageHead({ lang: "fr", title: '"><script>x</script>', description: "a & b", canonical: `${BASE}/fr/x` }).join("");
    expect(lines).not.toContain("<script>x");
    expect(lines).toContain("a &amp; b");
  });
});

describe("one document builder, one head", () => {
  const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const builders = readdirSync(src).filter((f) => f.endsWith(".ts") && readFileSync(join(src, f), "utf8").includes('"<!doctype html>"'));

  it("every marketplace page goes through pageHead; only the standalone static site does not", () => {
    expect(builders.length).toBe(13);
    for (const file of builders.filter((f) => f !== "pages.ts")) expect(readFileSync(join(src, file), "utf8"), file).toContain("...pageHead({");
  });

  it("types no colour in a page builder: the palette lives in @proofseen/brand", () => {
    for (const file of readdirSync(src).filter((f) => f.endsWith(".ts"))) {
      expect(readFileSync(join(src, file), "utf8"), file).not.toMatch(/#[0-9a-f]{6}\b/i);
    }
  });
});

describe("the shared chrome", () => {
  it("gives every menu link a 44 px target and hover only where hover exists", () => {
    expect(STYLES).toContain(".nav a{display:inline-flex;align-items:center;min-height:2.75rem");
    for (const line of STYLES.split("\n").filter((l) => l.includes(":hover"))) expect(line).toMatch(/^@media \(hover:hover\) and \(pointer:fine\)/);
  });

  it("keeps the same links in the menu, with the current page marked", () => {
    const header = marketHeader("fr", "/en/missions", "missions");
    for (const path of ["missions", "freelances", "entreprises", "metiers", "postes", "simulateur", "blog", "connexion", "creer-un-compte"]) {
      expect(header).toContain(`href="/fr/${path}"`);
    }
    expect(header).toContain('<a href="/fr/missions" aria-current="page">Missions</a>');
    expect(header).toContain('<a class="lang" href="/en/missions" hreflang="en" lang="en">English</a>');
  });

  it("follows the system theme without a theme switch, and the static site loads no web font", () => {
    expect(STYLES).toContain(`@media (prefers-color-scheme:light){:root{color-scheme:light;--ps-bg:${PALETTE.light.bg};`);
    expect(STYLES).not.toContain("data-theme");
    expect(STANDALONE_STYLES).not.toContain("url(");
  });
});
