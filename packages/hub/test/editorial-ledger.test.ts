import { describe, expect, it } from "vitest";
import { BAROMETER_STYLES } from "../src/barometer-chart";
import { rateCsv, rateJson, skillCsv, type RateBarometerView, type SkillBarometerView } from "../src/barometer-data";
import { renderRateBarometer } from "../src/barometer-rates";
import { renderSkillBarometer } from "../src/barometer-skills";
import { renderArticlePage } from "../src/blog-article";
import { renderBlogIndex } from "../src/blog-index";
import type { BlogArticleView } from "../src/blog-model";

/*
 * Lot f de la refonte : blog et baromètres. Ce que ces tests protègent : chaque chiffre d'un baromètre porte son
 * effectif n et sa date, rien n'est publié sous le seuil (ni en page, ni en données), les figures sont en SVG serveur
 * sans le vert du poinçon (une mesure n'est pas un fait vérifié), les états vides disent quoi faire, et aucune page ne
 * porte de script hors JSON-LD ni de texte caché.
 */

const BASE = "https://proofseen.com";
const NOW = new Date("2026-10-21T09:00:00Z");
const stat = (key: string, label: string, n: number) => ({ key, label, n, p25Cents: 48_000, medianCents: 58_000, p75Cents: 68_000 });

const RATES: RateBarometerView = {
  computedAt: NOW,
  currency: "EUR",
  minSample: 10,
  missionsSince: new Date("2026-07-23T09:00:00Z"),
  profiles: { total: 41, overall: stat("all", "all", 41), bySkill: [stat("typescript", "TypeScript", 18), stat("cobol", "Cobol", 4)], byCity: [stat("paris", "Paris", 22)] },
  missions: { total: 9, overall: stat("all", "all", 9), bySkill: [], byCity: [] },
};
const EMPTY_RATES: RateBarometerView = { ...RATES, profiles: { total: 1, overall: null, bySkill: [], byCity: [] }, missions: { total: 0, overall: null, bySkill: [], byCity: [] } };
const SKILLS: SkillBarometerView = { computedAt: NOW, since: RATES.missionsSince, minCount: 5, totalMissions: 31, skills: [{ key: "typescript", label: "TypeScript", missions: 14 }, { key: "go", label: "Go", missions: 5 }, { key: "zig", label: "Zig", missions: 2 }] };

const ARTICLE: BlogArticleView = {
  slug: "fixer-son-tjm",
  lang: "fr",
  title: "Comment fixer son TJM",
  description: "Le calcul pas à pas.",
  category: "guide",
  audience: "freelance",
  authorName: "Équipe Proofseen",
  publishedAt: new Date("2026-10-15T08:00:00Z"),
  updatedAt: new Date("2026-10-18T08:00:00Z"),
  body: "## Les charges\n\nTexte.\n\n## Les jours\n\nTexte.\n\n## Le calcul\n\nTexte.",
  sources: [
    { title: "Urssaf", url: "https://www.urssaf.fr/accueil/independant.html" },
    { title: "Service public", url: "https://www.service-public.fr/particuliers/vosdroits/F2405" },
  ],
};

const rates = renderRateBarometer(RATES, { baseUrl: BASE, lang: "fr" });
const skills = renderSkillBarometer(SKILLS, { baseUrl: BASE, lang: "fr" });
const PAGES: Readonly<Record<string, string>> = {
  rates,
  "rates, empty, EN": renderRateBarometer(EMPTY_RATES, { baseUrl: BASE, lang: "en" }),
  skills,
  "skills, empty": renderSkillBarometer({ ...SKILLS, totalMissions: 2, skills: [] }, { baseUrl: BASE, lang: "fr" }),
  blog: renderBlogIndex([ARTICLE], { baseUrl: BASE, lang: "fr", filters: { category: null, audience: null, page: 1 }, hasMore: false }),
  "blog, nothing published": renderBlogIndex([], { baseUrl: BASE, lang: "fr", filters: { category: null, audience: null, page: 1 }, hasMore: false }),
  "blog, filtered, EN": renderBlogIndex([], { baseUrl: BASE, lang: "en", filters: { category: "etude", audience: null, page: 1 }, hasMore: false }),
  article: renderArticlePage(ARTICLE, [ARTICLE], { baseUrl: BASE }),
};

const tbodyRows = (html: string): string[] => [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].flatMap((m) => (m[1] ?? "").split("</tr>").filter((r) => r.includes("<tr>")));

describe("lot f : chaque chiffre d'un baromètre porte son n et sa date", () => {
  it("chaque tableau date son calcul dans sa légende, et chaque ligne a sa colonne n", () => {
    for (const html of [rates, skills]) {
      const captions = [...html.matchAll(/<caption>([\s\S]*?)<\/caption>/g)].map((m) => m[1] ?? "");
      expect(captions.length).toBeGreaterThan(0);
      for (const c of captions) expect(c).toContain('<time datetime="2026-10-21T09:00:00.000Z">Calculé le 21 octobre 2026');
      for (const row of tbodyRows(html)) expect(row).toMatch(/<th scope="row">[^<]+<\/th><td class="num">\d+<\/td>/);
    }
    expect(rates).toContain('<th scope="col" class="num">n</th>');
    expect(skills).toContain('<th scope="col" class="num">Missions (n)</th>');
  });

  it("la médiane mise en avant porte son n et sa date, et la phrase qui la dit en entier", () => {
    expect(rates).toContain("n = 41 · calculé le 21 octobre 2026");
    expect(rates).toMatch(/médiane 580\s€ par jour, la moitié des valeurs entre 480\s€ et 680\s€ \(n = 41\)/);
  });

  it("n'écrit aucun chiffre sous le seuil, ni en page ni dans les données", () => {
    // Cobol (n = 4) et la série des missions (n = 9) sont sous le seuil de 10 ; Zig (2 missions) sous celui de 5.
    expect(rates).not.toContain("Cobol");
    expect(rates).not.toContain("(n = 9)");
    expect(rates).toContain("Moins de 10 valeurs : aucune statistique publiée pour cette série.");
    expect(rateCsv(RATES)).not.toContain("cobol");
    expect(rateCsv(RATES)).not.toContain("missions,all");
    expect((JSON.parse(rateJson(RATES, BASE)) as { rows: unknown[] }).rows).toHaveLength(3);
    expect(skills).not.toContain("Zig");
    expect(skillCsv(SKILLS)).not.toContain("zig");
  });

  it("sous le seuil, dit combien de valeurs existent face au seuil, daté, et propose les données", () => {
    const empty = PAGES["rates, empty, EN"] ?? "";
    expect(empty).toContain('<div class="blank">');
    expect(empty).toContain("On 21 October 2026, 1 published profile shows a day rate and 0 mission offers one.");
    expect(empty).toContain("Published profiles showing a day rate: 1 value, publication threshold 10");
    expect(empty).toContain('<svg class="gauge"');
    expect(empty).toContain('<a href="/barometre/tjm.csv">Download as CSV</a>');
    expect(empty).not.toContain("<table");
  });
});

describe("lot f : figures en SVG serveur, sans le vert du poinçon", () => {
  it("les figures sont des formes sans texte, cachées des lecteurs d'écran, en encres neutres", () => {
    const figures = [...rates.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(figures.length).toBe(3);
    for (const svg of figures) {
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).not.toMatch(/<text|<script|fill="#|stroke="#/);
    }
    expect(BAROMETER_STYLES).not.toContain("--ps-proof");
  });

  it.each(Object.entries(PAGES))("%s : aucun carré vert (rien ici n'est vérifié par un tiers)", (_name, html) => {
    expect(html).not.toContain('<span class="pin" aria-hidden="true">');
  });
});

describe("lot f : adresses et navigation", () => {
  it("les deux baromètres se relient l'un l'autre, la page courante marquée, et le menu reste sur Blog", () => {
    expect(rates).toContain('<nav class="bnav" aria-label="Baromètres"><a href="/fr/barometre/tjm" aria-current="page">TJM</a><a href="/fr/barometre/competences">Compétences demandées</a></nav>');
    expect(skills).toContain('<a href="/fr/barometre/competences" aria-current="page">Compétences demandées</a>');
    expect(rates).toContain('aria-current="page">Blog</a>');
  });

  it("le blog présente les deux baromètres comme des jeux de données, avec leurs fichiers", () => {
    const blog = PAGES.blog ?? "";
    for (const file of ["tjm.csv", "tjm.json", "competences.csv", "competences.json"]) expect(blog).toContain(`href="/barometre/${file}"`);
    expect(blog).toContain('<a href="/fr/barometre/tjm">Baromètre des TJM</a>');
  });
});

describe("lot f : lecture d'un article", () => {
  it("annonce ses sources dès l'en-tête, avec ses dates, et les liste numérotées avec leur domaine", () => {
    const html = PAGES.article ?? "";
    expect(html).toContain('<a href="#article-sources">2 sources</a>');
    expect(html).toContain("publié le 15 octobre 2026");
    expect(html).toContain("mis à jour le 18 octobre 2026");
    expect(html).toContain('<ol class="sources">');
    expect(html).toContain('<small class="muted">www.urssaf.fr</small>');
    // Les intertitres sont en PS Display, à la mesure de 66 caractères.
    expect(html).toContain(".prose{max-width:var(--ps-measure)");
    expect(html).toContain(".prose h2{display:block;margin:var(--ps-space-8) 0 var(--ps-space-3);font:var(--ps-weight-display) var(--ps-step-2)/var(--ps-lead-2) var(--ps-font-display)");
  });
});

describe("lot f : états vides honnêtes", () => {
  it("le blog distingue « rien de publié » de « rien pour ce choix », et propose de retirer le filtre", () => {
    expect(PAGES["blog, nothing published"]).toContain("Aucun article publié pour l&#39;instant.");
    expect(PAGES["blog, filtered, EN"]).toContain("No article published for this choice yet.");
    expect(PAGES["blog, filtered, EN"]).toContain('<a href="/en/blog">See all articles</a>');
    expect(PAGES["skills, empty"]).toContain('<div class="blank">');
  });
});

describe("lot f : aucune page ne porte de script hors JSON-LD ni de texte caché", () => {
  it.each(Object.entries(PAGES))("%s", (_name, html) => {
    for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/gi)) expect(attrs).toContain('type="application/ld+json"');
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
    expect(html).not.toContain(String.fromCodePoint(0x2014));
    for (const line of html.split(/(?=@media)/).filter((l) => /:hover/.test(l))) expect(line).toMatch(/^@media \((hover:hover\) and \(pointer:fine\)|prefers-reduced-motion)/);
  });
});
