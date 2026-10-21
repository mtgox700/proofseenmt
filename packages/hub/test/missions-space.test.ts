import { describe, expect, it } from "vitest";
import { cityUrl, renderCityPage, type CityPageView } from "../src/city-page";
import { companyJsonLd, companySitemap, renderCompanyPage, type CompanyPageModel } from "../src/company-page";
import { renderJobIndex, type JobIndexFilters } from "../src/job-index";
import { jobSitemap, renderJobPage } from "../src/job-page";
import type { PublicMission } from "../src/job-posting";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";

const BASE = "https://proofseen.com";
const WHEN = new Date("2026-10-15T00:00:00Z");

const scriptsOutsideJsonLd = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;
const jsonLd = (html: string): Record<string, unknown> => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as Record<string, unknown>;

const CITY: CityPageView = {
  key: "lyon",
  label: "Lyon",
  missions: [
    { id: "m1", title: "Dev <Rust>", organisationName: "Acme & Co", workMode: "onsite", city: "Lyon", skills: ["Rust"], dailyRateMinCents: 60_000, dailyRateMaxCents: 70_000, currency: "EUR", publishedAt: WHEN },
    { id: "m2", title: "Data engineer", organisationName: "Beta", workMode: "hybrid", city: "Lyon", skills: [], dailyRateMinCents: null, dailyRateMaxCents: null, currency: "EUR", publishedAt: WHEN },
  ],
  facts: { missionCount: 2, skills: ["Rust"], dailyRate: null },
  generatedAt: WHEN,
};

const COMPANY: CompanyPageModel = {
  slug: "acme-studio",
  name: 'Acme "Studio" <b>',
  description: "Studio produit.\n\nDeuxième paragraphe <i>.",
  website: "https://acme.example",
  city: "Lyon",
  memberSince: new Date("2026-09-01T00:00:00Z"),
  registryActiveCheckedAt: new Date("2026-10-01T00:00:00Z"),
  response: { medianDays: 3, decided: 4 },
  missions: [{ id: "m1", title: "Dev Rust", workMode: "remote", city: null, publishedAt: WHEN }],
  generatedAt: WHEN,
};

describe("page d'une ville", () => {
  it("se lit sans JavaScript, échappe, dit son ordre, et porte ses données structurées", () => {
    const html = renderCityPage(CITY, { baseUrl: BASE, lang: "fr" });
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).toContain("Dev &lt;Rust&gt;");
    expect(html).toContain("Acme &amp; Co");
    expect(html).not.toContain("<Rust>");
    expect(html).toContain("Ordre\u202f: date de publication, les plus récentes d'abord.");
    expect(html).toContain("Au 15 octobre 2026, Proofseen compte 2 missions ouvertes à Lyon.");
    expect(html).toContain(`<link rel="canonical" href="${BASE}/fr/missions/ville/lyon">`);
    expect(html).not.toContain('name="robots"');
    const data = jsonLd(html);
    expect(data).toMatchObject({ "@type": "CollectionPage", about: { "@type": "City", name: "Lyon" }, mainEntity: { numberOfItems: 2 } });
  });

  it("n'écrit une fourchette de TJM qu'avec assez de missions, et toujours avec son n", () => {
    const few = renderCityPage({ ...CITY, facts: { ...CITY.facts, dailyRate: { n: 4, minCents: 50_000, maxCents: 80_000, currency: "EUR" } } }, { baseUrl: BASE, lang: "en" });
    expect(few).not.toContain("Day rates shown");
    const many = renderCityPage({ ...CITY, facts: { ...CITY.facts, dailyRate: { n: 5, minCents: 50_000, maxCents: 80_000, currency: "EUR" } } }, { baseUrl: BASE, lang: "en" });
    expect(many).toContain("(n = 5 missions showing their rate)");
  });

  it("entre dans le sitemap des missions, dans les deux langues", () => {
    const xml = jobSitemap(BASE, [], [{ key: "saint-etienne" }]);
    expect(xml).toContain(`<loc>${cityUrl(BASE, "fr", "saint-etienne")}</loc>`);
    expect(xml).toContain(`<loc>${BASE}/en/missions/ville/saint-etienne</loc>`);
  });
});

describe("page publique d'une entreprise", () => {
  it("montre des faits datés, échappe le texte déclaré, et porte une Organization", () => {
    const html = renderCompanyPage(COMPANY, { baseUrl: BASE, lang: "fr" });
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).toContain("Acme &quot;Studio&quot; &lt;b&gt;");
    expect(html).toContain("Entreprise active au répertoire officiel des entreprises (vérifié le 1 octobre 2026).");
    expect(html).toContain("Répond aux candidatures en 3 jours (médiane sur 4 candidatures, six derniers mois).");
    expect(html).toContain('<a href="https://acme.example" rel="nofollow noopener noreferrer">');
    expect(html).toContain(`<link rel="canonical" href="${BASE}/fr/entreprises/acme-studio">`);
    expect(html).toContain('href="/fr/missions/m1"');
    expect(companyJsonLd(COMPANY, { baseUrl: BASE, lang: "fr" })).toMatchObject({
      "@type": "Organization",
      name: COMPANY.name,
      url: `${BASE}/fr/entreprises/acme-studio`,
      sameAs: ["https://acme.example"],
      address: { addressLocality: "Lyon" },
    });
    // Le JSON-LD ne peut pas refermer son bloc de script.
    expect(/<script type="application\/ld\+json">[\s\S]*?<\/script>/.exec(html)?.[0]).not.toContain("<b>");
  });

  it("dit quand le répertoire n'a pas encore été consulté, sans inventer de délai", () => {
    const html = renderCompanyPage({ ...COMPANY, registryActiveCheckedAt: null, response: null, website: null, description: null, missions: [] }, { baseUrl: BASE, lang: "en" });
    // La base ne distingue pas « pas encore contrôlée » de « contrôlée, pas active » : la page n'affirme ni l'un ni l'autre.
    expect(html).toContain("Not confirmed as active in the official French company register.");
    expect(html).not.toContain('<span class="pin" aria-hidden="true">');
    expect(html).not.toContain("Answers applications");
    expect(html).toContain("No open mission at the moment.");
  });

  it("a son sitemap, déclaré dans robots.txt", () => {
    expect(companySitemap(BASE, [{ slug: "acme-studio", updatedAt: WHEN }])).toContain(`<loc>${BASE}/en/entreprises/acme-studio</loc><lastmod>2026-10-15</lastmod>`);
    expect(marketplaceRobots(BASE)).toContain(`Sitemap: ${BASE}/sitemap-companies.xml`);
  });
});

describe("liste publique des missions : recherche et filtres", () => {
  const MISSION: PublicMission = { id: "m1", organisationName: "Acme", organisationSlug: "acme", title: "Dev", description: "x", skills: [], durationMonths: null, dailyRateMinCents: null, dailyRateMaxCents: null, currency: "EUR", city: null, workMode: "remote", publishedAt: WHEN };
  const PLAIN: JobIndexFilters = { mode: [], skill: "", city: "", sort: "recent", page: 1 };

  it("garde mots-clés, TJM, durée et date dans le formulaire et la pagination, sans indexer la page filtrée", () => {
    const html = renderJobIndex([MISSION], { baseUrl: BASE, lang: "fr", hasMore: true, filters: { ...PLAIN, q: "rust <embarqué>", rateMin: 500, rateMax: 800, maxDuration: 6, since: 7 } });
    expect(html).toContain('name="q" value="rust &lt;embarqué&gt;"');
    expect(html).toContain('name="tjmMin" min="0" max="100000" step="1" value="500"');
    expect(html).toContain('<option value="7" selected>7 jours</option>');
    expect(html).toContain("href=\"/fr/missions?q=rust+%3Cembarqu%C3%A9%3E&amp;tjmMin=500&amp;tjmMax=800&amp;dureeMax=6&amp;depuis=7&amp;page=2\"");
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).toContain("Ordre\u202f: date de publication, les plus récentes d'abord.");
  });

  it("relie les pages par ville depuis la liste nue seulement", () => {
    const cities = [{ key: "lyon", label: "Lyon", missions: 3 }];
    expect(renderJobIndex([MISSION], { baseUrl: BASE, lang: "fr", hasMore: false, filters: PLAIN, cities })).toContain(`<a href="${BASE}/fr/missions/ville/lyon">Lyon (3)</a>`);
    expect(renderJobIndex([MISSION], { baseUrl: BASE, lang: "fr", hasMore: false, filters: { ...PLAIN, city: "Lyon" }, cities })).not.toContain("/missions/ville/lyon");
  });

  it("relie la page de l'entreprise depuis la mission, quand elle en a une", () => {
    expect(renderJobPage(MISSION, { baseUrl: BASE, lang: "fr", applyHref: "/fr/app/missions/m1/postuler" })).toContain('<a href="/fr/entreprises/acme">Acme</a>');
    expect(renderJobPage({ ...MISSION, organisationSlug: null }, { baseUrl: BASE, lang: "fr", applyHref: "/x" })).not.toContain("/entreprises/");
  });
});

describe("marketplace-verify sur les nouvelles pages publiques", () => {
  it("valide une page de ville et une page d'entreprise telles que les renderers les produisent", async () => {
    const missionsSitemap = `${BASE}/sitemap-missions.xml`;
    const companiesSitemap = `${BASE}/sitemap-companies.xml`;
    const served: Record<string, string> = {
      [`${BASE}/fr/missions/ville/lyon`]: renderCityPage(CITY, { baseUrl: BASE, lang: "fr" }),
      [`${BASE}/fr/entreprises/acme-studio`]: renderCompanyPage(COMPANY, { baseUrl: BASE, lang: "fr" }),
    };
    const html = (body: string): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader: null });
    const text = (body: string): Served => ({ status: 200, body, contentType: "application/xml", robotsHeader: null });
    const fetchAs: FetchAs = async (url) => {
      const body = served[url];
      if (body !== undefined) return html(body);
      if (url === `${BASE}/robots.txt`) return text(marketplaceRobots(BASE));
      if (url === missionsSitemap) return text(jobSitemap(BASE, [], [{ key: "lyon" }]));
      if (url === companiesSitemap) return text(companySitemap(BASE, [{ slug: "acme-studio", updatedAt: WHEN }]));
      return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
    };
    const report = await verifyMarketplace({
      baseUrl: BASE,
      fetchAs,
      pages: [
        { url: `${BASE}/fr/missions/ville/lyon`, texts: ["Lyon", "Dev <Rust>", "Data engineer"], sitemap: missionsSitemap },
        { url: `${BASE}/fr/entreprises/acme-studio`, texts: [COMPANY.name, "Dev Rust", "Inscrite sur Proofseen depuis le 1 septembre 2026."], sitemap: companiesSitemap },
      ],
    });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
  });
});
