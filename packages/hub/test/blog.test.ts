import { describe, expect, it } from "vitest";
import { renderArticlePage } from "../src/blog-article";
import { blogFeed } from "../src/blog-feed";
import { blogSitemap, renderBlogIndex } from "../src/blog-index";
import type { BlogArticleView, BlogCardView } from "../src/blog-model";
import { llmsTxt } from "../src/llms-txt";

const BASE = "https://proofseen.com";

const card = (over: Partial<BlogCardView> = {}): BlogCardView => ({
  slug: "fixer-son-tjm",
  lang: "fr",
  title: "Comment fixer son TJM",
  description: "Les charges à couvrir & les jours réellement facturés.",
  category: "guide",
  audience: "freelance",
  authorName: "Équipe Proofseen",
  publishedAt: new Date("2026-10-15T08:00:00Z"),
  updatedAt: new Date("2026-10-15T09:00:00Z"),
  ...over,
});

const article = (over: Partial<BlogArticleView> = {}): BlogArticleView => ({
  ...card(),
  body: "## Les charges\n\nTexte.\n\n## Les jours\n\nTexte.\n\n## Le calcul\n\nTexte <script>alert(1)</script>.",
  sources: [{ title: "Urssaf — cotisations", url: "https://www.urssaf.fr/accueil/independant.html" }],
  ...over,
});

const scripts = (html: string): string[] => [...html.matchAll(/<script\b([^>]*)>/gi)].map(([, attrs]) => attrs ?? "");
const jsonLdOf = (html: string): Record<string, unknown> => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as Record<string, unknown>;

describe("page d'un article", () => {
  it("rend le texte sans JavaScript, avec BlogPosting, dates, auteur, éditeur et sources", () => {
    const html = renderArticlePage(article(), [], { baseUrl: BASE });
    expect(scripts(html).every((attrs) => /application\/ld\+json/.test(attrs))).toBe(true);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain('<link rel="canonical" href="https://proofseen.com/fr/blog/fixer-son-tjm">');
    expect(html).not.toContain("noindex");
    const ld = jsonLdOf(html);
    expect(ld).toMatchObject({
      "@type": "BlogPosting",
      headline: "Comment fixer son TJM",
      datePublished: "2026-10-15T08:00:00.000Z",
      dateModified: "2026-10-15T09:00:00.000Z",
      author: { "@type": "Organization", name: "Équipe Proofseen" },
      publisher: { "@type": "Organization", name: "Proofseen" },
      citation: [{ "@type": "CreativeWork", url: "https://www.urssaf.fr/accueil/independant.html" }],
    });
    expect(html).toContain('<a href="https://www.urssaf.fr/accueil/independant.html" rel="noopener">Urssaf — cotisations</a>');
    expect(html).toContain("Sommaire");
    expect(html).toContain('href="#les-charges"');
    expect(html).toContain("Les charges à couvrir &amp; les jours réellement facturés.");
  });

  it("signe une personne comme personne, échappe le titre, et liste les articles liés", () => {
    const html = renderArticlePage(article({ title: 'Le "TJM" <b>net</b>', authorName: "Ayoub H.", lang: "en", updatedAt: new Date("2026-10-15T08:00:00Z") }), [card({ slug: "autre", title: "Autre article" })], { baseUrl: BASE });
    expect(jsonLdOf(html)).toMatchObject({ author: { "@type": "Person", name: "Ayoub H." }, inLanguage: "en" });
    expect(html).toContain("<h1 class=\"title\">Le &quot;TJM&quot; &lt;b&gt;net&lt;/b&gt;</h1>");
    expect(html).not.toContain("updated on");
    expect(html).toContain('href="/fr/blog/autre"');
  });

  it("dit qu'un article sans source ne cite aucun chiffre, et ne rend jamais une source non https en lien", () => {
    expect(renderArticlePage(article({ sources: [] }), [], { baseUrl: BASE })).toContain("Cet article ne cite aucun chiffre.");
    const html = renderArticlePage(article({ sources: [{ title: "Piège", url: "javascript:alert(1)" }] }), [], { baseUrl: BASE });
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<li>Piège</li>");
  });
});

describe("index du blog", () => {
  it("liste les articles, filtre par liens simples, et n'indexe que la liste nue", () => {
    const html = renderBlogIndex([card()], { baseUrl: BASE, lang: "fr", filters: { category: null, audience: null, page: 1 }, hasMore: true });
    expect(scripts(html).every((attrs) => /application\/ld\+json/.test(attrs))).toBe(true);
    expect(html).toContain('<link rel="canonical" href="https://proofseen.com/fr/blog">');
    expect(html).not.toContain("noindex");
    expect(html).toContain('href="/fr/blog?categorie=guide"');
    expect(html).toContain('href="/fr/blog?public=entreprise"');
    expect(html).toContain('rel="next" href="/fr/blog?page=2"');
    expect(html).toContain('type="application/rss+xml"');
    expect(html).toContain('href="/fr/barometre/tjm"');
    expect(html).toContain('aria-current="page">Blog</a>');
    expect(jsonLdOf(html)).toMatchObject({ "@type": "Blog", blogPost: [{ headline: "Comment fixer son TJM" }] });

    const filtered = renderBlogIndex([], { baseUrl: BASE, lang: "en", filters: { category: "etude", audience: "entreprise", page: 2 }, hasMore: false });
    expect(filtered).toContain('<meta name="robots" content="noindex, follow">');
    expect(filtered).toContain("No article published for this choice yet.");
    expect(filtered).toContain('rel="prev" href="/en/blog?categorie=etude&amp;public=entreprise"');
  });

  it("met l'index, les baromètres et les articles dans le sitemap, avec leur date", () => {
    const xml = blogSitemap(BASE, [card()]);
    expect(xml).toContain("<loc>https://proofseen.com/fr/blog</loc>");
    expect(xml).toContain("<loc>https://proofseen.com/en/barometre/tjm</loc>");
    expect(xml).toContain("<loc>https://proofseen.com/fr/barometre/competences</loc>");
    expect(xml).toContain("<url><loc>https://proofseen.com/fr/blog/fixer-son-tjm</loc><lastmod>2026-10-15</lastmod></url>");
  });
});

describe("flux RSS", () => {
  it("est un RSS 2.0 bien formé, avec un lien vers lui-même et des éléments échappés", () => {
    const xml = blogFeed(BASE, "fr", [card({ title: "A & B <c>" }), card({ slug: "deux", publishedAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-20T00:00:00Z") })], new Date("2026-10-21T00:00:00Z"));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(true);
    expect(xml).toContain('<atom:link href="https://proofseen.com/fr/blog/rss.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).toContain("<title>A &amp; B &lt;c&gt;</title>");
    expect(xml).toContain('<guid isPermaLink="true">https://proofseen.com/fr/blog/fixer-son-tjm</guid>');
    expect(xml).toContain("<pubDate>Thu, 15 Oct 2026 08:00:00 GMT</pubDate>");
    expect(xml).toContain("<lastBuildDate>Tue, 20 Oct 2026 00:00:00 GMT</lastBuildDate>");
    expect((xml.match(/<item>/g) ?? []).length).toBe(2);
    expect((xml.match(/<item>/g) ?? []).length).toBe((xml.match(/<\/item>/g) ?? []).length);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#39;)/);
  });

  it("reste valide sans aucun article", () => {
    const xml = blogFeed(BASE, "en", [], new Date("2026-10-21T00:00:00Z"));
    expect(xml).toContain("<lastBuildDate>Wed, 21 Oct 2026 00:00:00 GMT</lastBuildDate>");
    expect(xml).not.toContain("<item>");
    expect(xml.trimEnd().endsWith("</rss>")).toBe(true);
  });
});

describe("llms.txt et le blog", () => {
  it("liste le blog, les baromètres et les articles publiés", () => {
    const text = llmsTxt(BASE, [], [{ lang: "fr", slug: "fixer-son-tjm", title: "Comment [fixer] son TJM", description: "Les charges." }]);
    expect(text).toContain("- [Blog and guides](https://proofseen.com/fr/blog)");
    expect(text).toContain("- [Day-rate barometer](https://proofseen.com/fr/barometre/tjm)");
    expect(text).toContain("## Articles");
    expect(text).toContain("- [Comment fixer son TJM](https://proofseen.com/fr/blog/fixer-son-tjm): Les charges.");
    expect(text).toContain("https://proofseen.com/sitemap-blog.xml");
    expect(llmsTxt(BASE, [])).not.toContain("## Articles");
  });
});
