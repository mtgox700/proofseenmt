import { describe, expect, it } from "vitest";
import { renderCompanyPage } from "../src/company-page";
import { llmsTxt } from "../src/llms-txt";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";
import { postJsonLd, postSitemap, postUrl, renderPostBody, renderPostPage, type PublicPostModel } from "../src/post-page";

/*
 * Page publique d'une publication (C22) : texte échappé, aucun script hors JSON-LD, identité d'un profil pseudonyme
 * jamais révélée, impressions et vues jamais publiées, et la page passe `marketplace-verify` telle que le renderer la
 * produit (même contenu pour les robots, indexable, canonique, dans son sitemap déclaré au robots.txt).
 */

const BASE = "https://proofseen.com";
const AT = new Date("2026-10-18T09:00:00Z");

const model = (over: Partial<PublicPostModel> = {}): PublicPostModel => ({
  id: "0199f0a0-0000-7000-8000-000000000001",
  author: { kind: "profile", name: "FR-ABCDE", profileSlug: "fr-abcde", companySlug: null },
  body: "**Migration Postgres** terminée : 40 % de requêtes en moins.\n\n- index partiels\n- lots",
  linkUrl: "https://exemple.dev/billet",
  imageFileId: null,
  createdAt: AT,
  editedAt: null,
  shared: null,
  counts: { reactions: { like: 3, insightful: 1, celebrate: 0, support: 0 }, comments: 1, shares: 2 },
  comments: [{ id: "c1", author: { kind: "organisation", name: "Acme", profileSlug: null, companySlug: "acme" }, body: "Bravo <b>!</b>", state: "live", createdAt: AT, replies: [] }],
  ...over,
});

const executableScripts = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;

describe("page publique d'une publication", () => {
  it("échappe tout, ne contient aucun script exécutable, ne publie ni impressions ni vues", () => {
    const html = renderPostPage(model({ body: "<script>alert(1)</script> et <img src=x onerror=alert(1)>" }), { baseUrl: BASE, lang: "fr" });
    expect(executableScripts(html)).toBe(0);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("Bravo &lt;b&gt;!&lt;/b&gt;");
    expect(html).not.toMatch(/impression|vues/i);
    expect(html).toContain("4 réactions · 1 commentaire · 2 partages");
    expect(html).toContain('rel="nofollow ugc noopener noreferrer"');
  });

  it("un profil pseudonyme parle sous sa référence, en Person ; l'entreprise en Organization", () => {
    const ld = postJsonLd(model(), { baseUrl: BASE, lang: "fr" });
    expect(ld).toMatchObject({ "@type": "SocialMediaPosting", author: { "@type": "Person", name: "FR-ABCDE", url: `${BASE}/fr/profils/fr-abcde` }, commentCount: 1 });
    expect(JSON.stringify(ld)).toContain("Organization");
  });

  it("rend le Markdown simple sans titre ni HTML brut", () => {
    expect(renderPostBody("# Titre\n\n<div>brut</div>")).toBe("<p><strong>Titre</strong></p>\n&lt;div&gt;brut&lt;/div&gt;");
  });

  it("montre les commentaires supprimés et les comptes effacés sans texte", () => {
    const html = renderPostPage(
      model({ comments: [{ id: "c2", author: null, body: "", state: "erased", createdAt: AT, replies: [{ id: "c3", author: { kind: "profile", name: "FR-ZZZZZ", profileSlug: null, companySlug: null }, body: "Réponse", state: "live", createdAt: AT, replies: [] }] }] }),
      { baseUrl: BASE, lang: "en" },
    );
    expect(html).toContain("Account deleted.");
    expect(html).toContain("Réponse");
  });

  it("annonce la page dans son sitemap et sur les pages d'entreprise", () => {
    expect(postSitemap(BASE, [{ id: "abc", updatedAt: AT }])).toContain(`<loc>${BASE}/en/publications/abc</loc><lastmod>2026-10-18</lastmod>`);
    const company = renderCompanyPage(
      { slug: "acme", name: "Acme", description: null, website: null, city: null, memberSince: AT, registryActiveCheckedAt: null, response: null, missions: [], posts: [{ id: "abc", excerpt: "Nous recrutons", createdAt: AT }], generatedAt: AT },
      { baseUrl: BASE, lang: "fr" },
    );
    expect(company).toContain("Publications récentes");
    expect(company).toContain('href="/fr/publications/abc"');
    const llms = llmsTxt(BASE, [], [], [], [{ id: "abc", authorName: "Acme\n# injecté", excerpt: "Nous recrutons" }]);
    expect(llms).toContain("## Recent community posts");
    expect(llms).toContain(`- [Acme # injecté](${BASE}/fr/publications/abc): Nous recrutons`);
    expect(llms).toContain(`${BASE}/sitemap-posts.xml`);
  });

  it("passe marketplace-verify tel que le renderer le produit", async () => {
    const p = model();
    const url = postUrl(BASE, "fr", p.id);
    const sitemap = `${BASE}/sitemap-posts.xml`;
    const html = (body: string): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader: null });
    const text = (body: string): Served => ({ status: 200, body, contentType: "text/plain", robotsHeader: null });
    const fetchAs: FetchAs = async (target) => {
      if (target === url) return html(renderPostPage(p, { baseUrl: BASE, lang: "fr" }));
      if (target === `${BASE}/robots.txt`) return text(marketplaceRobots(BASE));
      if (target === sitemap) return text(postSitemap(BASE, [{ id: p.id, updatedAt: AT }]));
      return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
    };
    const report = await verifyMarketplace({ baseUrl: BASE, pages: [{ url, texts: ["Publication de FR-ABCDE", "Migration Postgres", "Bravo <b>!</b>"], sitemap }], fetchAs });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
