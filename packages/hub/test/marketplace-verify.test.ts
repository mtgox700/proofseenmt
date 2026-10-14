import { describe, expect, it } from "vitest";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";
import { renderProfileDirectory } from "../src/profile-directory";
import { renderSkillIndex } from "../src/skill-index";
import { renderSkillPage, skillSitemap, type SkillPageView } from "../src/skill-page";

const BASE = "https://proofseen.com";
const PAGE_URL = `${BASE}/fr/profils/fr-abcde`;
const SITEMAP = `${BASE}/sitemap-profiles.xml`;

const page = (extra = ""): string =>
  `<!doctype html><html><head><link rel="canonical" href="${PAGE_URL}"><script type="application/ld+json">{}</script>${extra}</head><body><h1>Freelance FR-ABCDE</h1><p>Développeuse Rust à Lyon &amp; ailleurs</p></body></html>`;

const html = (body: string, robotsHeader: string | null = null): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader });
const text = (body: string): Served => ({ status: 200, body, contentType: "text/plain", robotsHeader: null });

/** Un site correct, que chaque test abîme d'une seule façon. */
const site = (overrides: { page?: (ua: string) => Served; robots?: string; sitemap?: string } = {}): FetchAs => async (url, ua) => {
  if (url === PAGE_URL) return overrides.page?.(ua) ?? html(page());
  if (url === `${BASE}/robots.txt`) return text(overrides.robots ?? marketplaceRobots(BASE));
  if (url === SITEMAP) return text(overrides.sitemap ?? `<urlset><url><loc>${PAGE_URL}</loc></url></urlset>`);
  return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
};

const PAGES = [{ url: PAGE_URL, texts: ["Freelance FR-ABCDE", "Développeuse Rust à Lyon & ailleurs"], sitemap: SITEMAP }];

const failing = async (fetchAs: FetchAs): Promise<string[]> =>
  (await verifyMarketplace({ baseUrl: BASE, pages: PAGES, fetchAs })).checks.filter((c) => c.status === "fail").map((c) => c.name);

describe("vérification des pages publiques de la marketplace", () => {
  it("valide un site correct", async () => {
    const report = await verifyMarketplace({ baseUrl: BASE, pages: PAGES, fetchAs: site() });
    expect(report.ok).toBe(true);
  });

  it("attrape un contenu différent pour un robot d'IA (cloaking)", async () => {
    expect(await failing(site({ page: (ua) => html(ua.includes("OAI-SearchBot") ? page("<meta name=\"x\" content=\"bot\">") : page()) }))).toEqual(["même contenu pour les robots"]);
  });

  it("attrape un noindex, en balise comme en en-tête", async () => {
    expect(await failing(site({ page: () => html(page('<meta name="robots" content="noindex">')) }))).toContain("indexable");
    expect(await failing(site({ page: () => html(page(), "noindex, nofollow") }))).toContain("indexable");
  });

  it("attrape un robot d'IA bloqué et un sitemap non déclaré", async () => {
    const robots = marketplaceRobots(BASE).replace("User-agent: PerplexityBot\nAllow: /", "User-agent: PerplexityBot\nDisallow: /").replace(/Sitemap: .*profiles.xml\n/, "");
    expect(await failing(site({ robots }))).toEqual(["robots.txt"]);
  });

  it("attrape un fait absent, un script exécutable, une page hors sitemap", async () => {
    expect(await failing(site({ page: () => html(page().replace("Lyon", "Paris")) }))).toEqual(["faits dans le HTML"]);
    expect(await failing(site({ page: () => html(page("<script src=\"/app.js\"></script>")) }))).toEqual(["aucun JavaScript"]);
    expect(await failing(site({ sitemap: "<urlset></urlset>" }))).toEqual(["sitemaps"]);
  });

  it("valide l'annuaire, l'index des métiers et une page métier tels que les renderers les produisent", async () => {
    const pagesSitemap = `${BASE}/sitemap-pages.xml`;
    const skillsSitemap = `${BASE}/sitemap-skills.xml`;
    const view: SkillPageView = {
      key: "rust",
      label: "Rust",
      missions: [],
      profiles: [{ slug: "fr-abcde", reference: "FR-ABCDE", displayName: null, headline: "Dev Rust", city: "Lyon" }],
      facts: { profileCount: 2, missionCount: 0, dailyRate: null, cities: ["Lyon"] },
      generatedAt: new Date("2026-10-14T00:00:00Z"),
    };
    const card = { slug: "fr-abcde", reference: "FR-ABCDE", displayName: null, headline: "Dev Rust", city: "Lyon", workMode: "remote" as const, skills: ["Rust"], facts: { registryActive: false, identityVerified: true, vigilanceValid: false, verifiedMissions: 0, payingClients: 0 }, updatedAt: view.generatedAt };
    const served: Record<string, string> = {
      [`${BASE}/fr/freelances`]: renderProfileDirectory([card], { baseUrl: BASE, lang: "fr", filters: { skill: "", city: "", page: 1 }, hasMore: false }),
      [`${BASE}/fr/metiers`]: renderSkillIndex([{ key: "rust", label: "Rust", missions: 0, profiles: 2 }], { baseUrl: BASE, lang: "fr" }),
      [`${BASE}/fr/metiers/rust`]: renderSkillPage(view, { baseUrl: BASE, lang: "fr" }),
    };
    const fetchAs: FetchAs = async (url) => {
      const body = served[url];
      if (body !== undefined) return html(body);
      if (url === `${BASE}/robots.txt`) return text(marketplaceRobots(BASE));
      if (url === pagesSitemap) return text(`<urlset><url><loc>${BASE}/fr/freelances</loc></url><url><loc>${BASE}/fr/metiers</loc></url></urlset>`);
      if (url === skillsSitemap) return text(skillSitemap(BASE, [{ key: "rust" }]));
      return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
    };
    const report = await verifyMarketplace({
      baseUrl: BASE,
      fetchAs,
      pages: [
        { url: `${BASE}/fr/freelances`, texts: ["Freelance FR-ABCDE", "Identité vérifiée par le prestataire de paiement"], sitemap: pagesSitemap },
        { url: `${BASE}/fr/metiers`, texts: ["Rust", "0 mission ouverte · 2 profils publiés"], sitemap: pagesSitemap },
        { url: `${BASE}/fr/metiers/rust`, texts: ["Au 14 octobre 2026, Proofseen compte 2 profils publiés et 0 mission ouverte pour la compétence Rust."], sitemap: skillsSitemap },
      ],
    });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
  });

  it("garde les espaces privés hors d'indexation dans robots.txt", () => {
    const robots = marketplaceRobots(BASE);
    expect(robots).toContain("User-agent: OAI-SearchBot\nAllow: /\nAllow: /api/profiles.json\nDisallow: /api/");
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap-pages.xml`);
    expect(robots).toContain("Disallow: /fr/app");
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap-missions.xml`);
  });
});
