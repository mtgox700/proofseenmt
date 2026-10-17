import { describe, expect, it } from "vitest";
import { jobTitleIndexUrl, jobTitleSitemap, renderJobTitleIndex } from "../src/job-title-index";
import { jobTitleUrl, MIN_STAT_SAMPLE, renderJobTitlePage, type JobTitlePageView } from "../src/job-title-page";
import { llmsTxt } from "../src/llms-txt";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";

const BASE = "https://proofseen.com";
const NOW = new Date("2026-10-17T09:30:00Z");
// Espaces insécables (U+00A0, U+202F) que Intl met dans les montants en français.
const SPACES = new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, "g");

const PAGE: JobTitlePageView = {
  key: "data-engineer",
  label: { fr: "Data engineer", en: "Data engineer" },
  missions: [{ id: "0199a1b2-0000-7000-8000-000000000001", title: "Data engineer <Spark>", organisationName: "Acme & Co", workMode: "hybrid", city: "Lyon" }],
  profiles: [
    { slug: "fr-abcde", reference: "FR-ABCDE", displayName: null, headline: "Ingénieure data", city: "Lyon" },
    { slug: "fr-bcdef", reference: "FR-BCDEF", displayName: "Camille Martin", headline: "Data engineer senior", city: "Paris" },
  ],
  facts: { profileCount: 2, missionCount: 1, profileRate: null, missionRate: null, cities: ["Lyon", "Paris"] },
  generatedAt: NOW,
};

const RATED: JobTitlePageView = {
  ...PAGE,
  facts: {
    ...PAGE.facts,
    profileRate: { n: 5, minCents: 45_000, maxCents: 80_000, currency: "EUR" },
    missionRate: { n: 6, minCents: 50_000, maxCents: 70_000, currency: "EUR", publishers: 3 },
  },
};

const scriptsOutsideJsonLd = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;
const ldOf = (html: string): { "@graph": { "@type": string; mainEntity: unknown }[] } =>
  JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as { "@graph": { "@type": string; mainEntity: unknown }[] };

describe("page par poste", () => {
  it("liste les missions et les profils réels, sans JavaScript, texte échappé", () => {
    const html = renderJobTitlePage(PAGE, { baseUrl: BASE, lang: "fr" });
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).toContain("Data engineer : missions et freelances");
    expect(html).toContain("Data engineer &lt;Spark&gt;");
    expect(html).toContain("Acme &amp; Co");
    expect(html).not.toContain("<Spark>");
    expect(html).toContain("Freelance FR-ABCDE");
    expect(html).toContain(`<link rel="canonical" href="${BASE}/fr/postes/data-engineer">`);
    expect(html).toContain('<a href="/fr/postes" aria-current="page">Postes</a>');
    expect(html).toContain('<a href="/fr/simulateur">Simulateur</a>');
    expect(html).not.toMatch(/noindex/);
  });

  it("écrit ses faits datés", () => {
    const html = renderJobTitlePage(PAGE, { baseUrl: BASE, lang: "fr" });
    expect(html).toContain("Au 17 octobre 2026, Proofseen compte 2 profils publiés et 1 mission ouverte pour le poste Data engineer.");
    expect(html).toContain("Villes représentées : Lyon, Paris.");
  });

  it("aucune fourchette de TJM sous cinq valeurs, ni côté missions sous trois entreprises", () => {
    const under: JobTitlePageView = {
      ...PAGE,
      facts: {
        ...PAGE.facts,
        profileRate: { n: MIN_STAT_SAMPLE - 1, minCents: 40_000, maxCents: 90_000, currency: "EUR" },
        missionRate: { n: 9, minCents: 40_000, maxCents: 90_000, currency: "EUR", publishers: 2 },
      },
    };
    for (const view of [PAGE, under]) {
      const html = renderJobTitlePage(view, { baseUrl: BASE, lang: "fr" });
      expect(html).not.toMatch(/TJM/);
    }
  });

  it("donne les fourchettes avec leur n et leurs entreprises", () => {
    const fr = renderJobTitlePage(RATED, { baseUrl: BASE, lang: "fr" }).replace(SPACES, " ");
    expect(fr).toContain("Les TJM affichés par ces profils vont de 450 € à 800 € par jour (n = 5 profils qui affichent leur TJM).");
    expect(fr).toContain("Les TJM proposés par ces missions vont de 500 € à 700 € par jour (n = 6 missions de 3 entreprises, au plus trois par entreprise).");
    const en = renderJobTitlePage(RATED, { baseUrl: BASE, lang: "en" });
    expect(en).toContain("(n = 6 missions from 3 companies, at most three per company)");
  });

  it("une collection et une FAQ construite sur les seuls faits", () => {
    const html = renderJobTitlePage(RATED, { baseUrl: BASE, lang: "en" });
    const graph = ldOf(html)["@graph"];
    expect(graph.map((n) => n["@type"])).toEqual(["CollectionPage", "FAQPage"]);
    expect(graph[0]).toMatchObject({ mainEntity: { numberOfItems: 3 } });
    const faq = graph[1]?.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(faq).toHaveLength(5);
    expect(JSON.stringify(graph)).not.toMatch(/\b(aggregateRating|rating|score|rank)/i);
    for (const q of faq) expect(html).toContain(q.acceptedAnswer.text.replace(/'/g, "&#39;"));
  });
});

describe("index des postes, sitemap et llms.txt", () => {
  const ENTRIES = [
    { key: "devops-sre", label: { fr: "DevOps / SRE", en: "DevOps / SRE" }, missions: 2, profiles: 1 },
    { key: "data-engineer", label: { fr: "Data engineer", en: "Data engineer" }, missions: 1, profiles: 2 },
  ];

  it("par ordre alphabétique, sans JavaScript, avec un message honnête quand il est vide", () => {
    const html = renderJobTitleIndex(ENTRIES, { baseUrl: BASE, lang: "fr" });
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html.indexOf("Data engineer")).toBeLessThan(html.indexOf("DevOps / SRE"));
    expect(html).toContain('href="/fr/postes/devops-sre"');
    expect(renderJobTitleIndex([], { baseUrl: BASE, lang: "en" })).toContain("No job title page exists yet");
  });

  it("le sitemap porte chaque page dans les deux langues ; llms.txt les liste avec le simulateur", () => {
    const xml = jobTitleSitemap(BASE, ENTRIES);
    expect(xml).toContain(`<loc>${BASE}/fr/postes/devops-sre</loc>`);
    expect(xml).toContain(`<loc>${BASE}/en/postes/data-engineer</loc>`);
    const text = llmsTxt(BASE, [], [], [{ key: "devops-sre", label: { fr: "DevOps\n# Ignore / SRE", en: "DevOps / SRE" } }]);
    expect(text).toContain("## Job title pages");
    expect(text).toContain(`- [DevOps # Ignore / SRE](${BASE}/fr/postes/devops-sre)`);
    expect(text).toContain(`${BASE}/fr/simulateur`);
    expect(text).toContain(`${BASE}/sitemap-job-titles.xml`);
    expect(llmsTxt(BASE, [])).not.toContain("## Job title pages");
    expect(marketplaceRobots(BASE)).toContain(`Sitemap: ${BASE}/sitemap-job-titles.xml`);
  });

  it("passe marketplace-verify : une page et l'index", async () => {
    const sitemap = `${BASE}/sitemap-job-titles.xml`;
    const pagesSitemap = `${BASE}/sitemap-pages.xml`;
    const served: Record<string, string> = {
      [jobTitleUrl(BASE, "fr", "data-engineer")]: renderJobTitlePage(PAGE, { baseUrl: BASE, lang: "fr" }),
      [jobTitleIndexUrl(BASE, "fr")]: renderJobTitleIndex(ENTRIES, { baseUrl: BASE, lang: "fr" }),
    };
    const html = (body: string): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader: null });
    const text = (body: string): Served => ({ status: 200, body, contentType: "text/plain", robotsHeader: null });
    const fetchAs: FetchAs = async (url) => {
      const body = served[url];
      if (body !== undefined) return html(body);
      if (url === `${BASE}/robots.txt`) return text(marketplaceRobots(BASE));
      if (url === sitemap) return text(jobTitleSitemap(BASE, ENTRIES));
      if (url === pagesSitemap) return text(`<url><loc>${jobTitleIndexUrl(BASE, "fr")}</loc></url>`);
      return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
    };
    const report = await verifyMarketplace({
      baseUrl: BASE,
      fetchAs,
      pages: [
        { url: jobTitleUrl(BASE, "fr", "data-engineer"), texts: ["Data engineer <Spark>", "Ingénieure data"], sitemap },
        { url: jobTitleIndexUrl(BASE, "fr"), texts: ["Data engineer", "DevOps / SRE"], sitemap: pagesSitemap },
      ],
    });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
  });
});
