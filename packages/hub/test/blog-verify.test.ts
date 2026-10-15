import { describe, expect, it } from "vitest";
import type { RateBarometerView } from "../src/barometer-data";
import { renderRateBarometer } from "../src/barometer-rates";
import { renderSkillBarometer } from "../src/barometer-skills";
import { renderArticlePage } from "../src/blog-article";
import { blogSitemap, renderBlogIndex } from "../src/blog-index";
import type { BlogArticleView } from "../src/blog-model";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";

/*
 * Le blog et les baromètres passent la même vérification que les profils et les missions : HTTP 200 en text/html, faits
 * présents sans JavaScript, aucun script hors JSON-LD, indexables, canoniques, identiques pour les robots, déclarés
 * dans un sitemap lui-même déclaré dans robots.txt.
 */

const BASE = "https://proofseen.com";
const SITEMAP = `${BASE}/sitemap-blog.xml`;

const ARTICLE: BlogArticleView = {
  slug: "facturer-une-mission",
  lang: "fr",
  title: "Facturer une mission freelance : les mentions obligatoires",
  description: "Ce qu'une facture doit porter.",
  category: "guide",
  audience: "freelance",
  authorName: "Équipe Proofseen",
  publishedAt: new Date("2026-10-15T08:00:00Z"),
  updatedAt: new Date("2026-10-15T08:00:00Z"),
  body: "## Les mentions\n\nLa date d'émission & le numéro de facture.",
  sources: [{ title: "Mentions obligatoires d'une facture", url: "https://entreprendre.service-public.fr/vosdroits/F31808" }],
};

const RATES: RateBarometerView = {
  computedAt: new Date("2026-10-15T12:00:00Z"),
  currency: "EUR",
  minSample: 10,
  missionsSince: new Date("2026-07-17T12:00:00Z"),
  profiles: { total: 2, overall: null, bySkill: [], byCity: [] },
  missions: { total: 0, overall: null, bySkill: [], byCity: [] },
};

const html = (body: string): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader: null });
const text = (body: string): Served => ({ status: 200, body, contentType: "text/plain", robotsHeader: null });

describe("vérification du blog et des baromètres", () => {
  it("valide l'index, un article et les deux baromètres tels que les renderers les produisent", async () => {
    const served: Record<string, string> = {
      [`${BASE}/fr/blog`]: renderBlogIndex([ARTICLE], { baseUrl: BASE, lang: "fr", filters: { category: null, audience: null, page: 1 }, hasMore: false }),
      [`${BASE}/fr/blog/facturer-une-mission`]: renderArticlePage(ARTICLE, [], { baseUrl: BASE }),
      [`${BASE}/fr/barometre/tjm`]: renderRateBarometer(RATES, { baseUrl: BASE, lang: "fr" }),
      [`${BASE}/en/barometre/competences`]: renderSkillBarometer({ computedAt: RATES.computedAt, since: RATES.missionsSince, minCount: 5, totalMissions: 0, skills: [] }, { baseUrl: BASE, lang: "en" }),
    };
    const fetchAs: FetchAs = async (url) => {
      const body = served[url];
      if (body !== undefined) return html(body);
      if (url === `${BASE}/robots.txt`) return text(marketplaceRobots(BASE));
      if (url === SITEMAP) return text(blogSitemap(BASE, [ARTICLE]));
      return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
    };
    const report = await verifyMarketplace({
      baseUrl: BASE,
      fetchAs,
      pages: [
        { url: `${BASE}/fr/blog`, texts: ["Facturer une mission freelance : les mentions obligatoires"], sitemap: SITEMAP },
        { url: `${BASE}/fr/blog/facturer-une-mission`, texts: ["La date d'émission & le numéro de facture.", "Mentions obligatoires d'une facture"], sitemap: SITEMAP },
        { url: `${BASE}/fr/barometre/tjm`, texts: ["Pas encore assez de données : il faut au moins 10 profils ou missions par groupe."], sitemap: SITEMAP },
        { url: `${BASE}/en/barometre/competences`, texts: ["Not enough data yet: a skill needs at least 5 missions to appear."], sitemap: SITEMAP },
      ],
    });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(marketplaceRobots(BASE)).toContain(`Sitemap: ${SITEMAP}`);
  });
});
