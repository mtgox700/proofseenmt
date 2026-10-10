import { describe, expect, it } from "vitest";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";

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

  it("garde les espaces privés hors d'indexation dans robots.txt", () => {
    const robots = marketplaceRobots(BASE);
    expect(robots).toContain("User-agent: OAI-SearchBot\nAllow: /\nAllow: /api/profiles.json\nDisallow: /api/");
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap-pages.xml`);
    expect(robots).toContain("Disallow: /fr/app");
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap-missions.xml`);
  });
});
