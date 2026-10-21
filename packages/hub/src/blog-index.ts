import { escapeHtml as e } from "./html";
import { isoDay, longDate, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import {
  articleUrl,
  AUDIENCE_LABELS,
  BLOG_AUDIENCES,
  BLOG_CATEGORIES,
  blogFeedUrl,
  blogIndexUrl,
  CATEGORY_LABELS,
  type BlogAudience,
  type BlogCardView,
  type BlogCategory,
} from "./blog-model";

/*
 * Index du blog : les articles publiés d'une langue, du plus récent au plus ancien, filtrables par catégorie et par
 * public, paginés. Des liens simples pour filtrer : aucune page ne demande de JavaScript. Seule la liste nue est
 * canonique ; une page filtrée ou paginée renvoie vers elle.
 */

export interface BlogFilters {
  readonly category: BlogCategory | null;
  readonly audience: BlogAudience | null;
  readonly page: number;
}

const LABELS = {
  fr: {
    title: "Blog et guides",
    lead: "Des guides pratiques pour les freelances et les entreprises, datés et sourcés : chaque chiffre renvoie à sa source officielle.",
    category: "Catégorie",
    audience: "Public",
    all: "Tout",
    allAudiences: "Tous les publics",
    articles: "Articles",
    empty: "Aucun article publié pour ce choix pour l'instant.",
    previous: "Page précédente",
    next: "Page suivante",
    published: (d: string) => `Publié le ${d}`,
    barometers: "Baromètres",
    rates: "Baromètre des TJM : médianes et quartiles, avec l'effectif de chaque groupe.",
    skills: "Compétences demandées par les missions des 90 derniers jours.",
    feed: "Flux RSS",
  },
  en: {
    title: "Blog and guides",
    lead: "Practical guides for freelancers and companies, dated and sourced: every figure points to its official source.",
    category: "Category",
    audience: "Audience",
    all: "All",
    allAudiences: "All audiences",
    articles: "Articles",
    empty: "No article published for this choice yet.",
    previous: "Previous page",
    next: "Next page",
    published: (d: string) => `Published on ${d}`,
    barometers: "Barometers",
    rates: "Day-rate barometer: medians and quartiles, with the size of every group.",
    skills: "Skills requested by the missions of the last 90 days.",
    feed: "RSS feed",
  },
} as const;

const query = (f: BlogFilters, page: number): string => {
  const params = new URLSearchParams();
  if (f.category !== null) params.set("categorie", f.category);
  if (f.audience !== null) params.set("public", f.audience);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

const chip = (href: string, label: string, current: boolean): string => `<li><a href="${e(href)}"${current ? ' aria-current="true"' : ""}>${e(label)}</a></li>`;

export const blogCard = (a: BlogCardView, lang: Lang): string =>
  `<li class="card"><p class="when">${e(CATEGORY_LABELS[lang][a.category])} · ${e(AUDIENCE_LABELS[lang][a.audience])}</p>` +
  `<h3><a href="/${lang}/blog/${e(encodeURIComponent(a.slug))}">${e(a.title)}</a></h3>` +
  `<p>${e(a.description)}</p>` +
  `<p class="when"><time datetime="${isoDay(a.publishedAt)}">${LABELS[lang].published(longDate(a.publishedAt, lang))}</time> · ${e(a.authorName)}</p></li>`;

export const renderBlogIndex = (items: readonly BlogCardView[], o: { readonly baseUrl: string; readonly lang: Lang; readonly filters: BlogFilters; readonly hasMore: boolean }): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const base = o.baseUrl.replace(/\/$/, "");
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const path = `/${o.lang}/blog`;
  const categories = [chip(`${path}${query({ ...f, category: null }, 1)}`, l.all, f.category === null), ...BLOG_CATEGORIES.map((c) => chip(`${path}${query({ ...f, category: c }, 1)}`, CATEGORY_LABELS[o.lang][c], f.category === c))].join("");
  const audiences = [chip(`${path}${query({ ...f, audience: null }, 1)}`, l.allAudiences, f.audience === null), ...BLOG_AUDIENCES.map((a) => chip(`${path}${query({ ...f, audience: a }, 1)}`, AUDIENCE_LABELS[o.lang][a], f.audience === a))].join("");
  const pager = [
    f.page > 1 ? `<a class="crumb" rel="prev" href="${e(`${path}${query(f, f.page - 1)}`)}">← ${l.previous}</a>` : "<span></span>",
    o.hasMore ? `<a class="crumb" rel="next" href="${e(`${path}${query(f, f.page + 1)}`)}">${l.next} →</a>` : "<span></span>",
  ].join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${l.title} · Proofseen`,
    url: blogIndexUrl(base, o.lang),
    inLanguage: o.lang,
    publisher: { "@type": "Organization", name: "Proofseen", url: base },
    blogPost: items.map((a) => ({ "@type": "BlogPosting", headline: a.title, url: articleUrl(base, o.lang, a.slug), datePublished: a.publishedAt.toISOString(), dateModified: a.updatedAt.toISOString() })),
  };
  return renderFrame({
    lang: o.lang,
    title: l.title,
    description: l.lead,
    canonical: blogIndexUrl(base, o.lang),
    alternates: { fr: blogIndexUrl(base, "fr"), en: blogIndexUrl(base, "en") },
    noindex: query(f, f.page) !== "",
    jsonLd,
    otherHref: `/${other}/blog`,
    menu: "blog",
    extraHead: [`<link rel="alternate" type="application/rss+xml" title="${e(`${l.title} · Proofseen`)}" href="${e(blogFeedUrl(base, o.lang))}">`],
    main: [
      `<h1 class="title">${l.title}</h1>`,
      `<p class="headline">${l.lead}</p>`,
      `<nav aria-label="${l.category}"><p class="meta">${l.category}</p><ul class="chips">${categories}</ul></nav>`,
      `<nav aria-label="${l.audience}"><p class="meta">${l.audience}</p><ul class="chips">${audiences}</ul></nav>`,
      `<h2>${l.articles}</h2>`,
      items.length === 0 ? `<p class="muted">${l.empty}</p>` : `<ul class="missions">${items.map((a) => blogCard(a, o.lang)).join("")}</ul>`,
      `<nav class="pager">${pager}</nav>`,
      `<h2>${l.barometers}</h2>`,
      `<ul class="links"><li><a href="/${o.lang}/barometre/tjm">${l.rates}</a></li><li><a href="/${o.lang}/barometre/competences">${l.skills}</a></li><li><a href="${path}/rss.xml">${l.feed}</a></li></ul>`,
    ],
  });
};

/**
 * Sitemap du contenu éditorial : l'index du blog et les baromètres dans les deux langues, puis chaque article publié à
 * son adresse dans sa langue, avec sa date de mise à jour.
 */
export const blogSitemap = (baseUrl: string, items: readonly Pick<BlogCardView, "lang" | "slug" | "updatedAt">[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...(["fr", "en"] as const).flatMap((lang) =>
      [blogIndexUrl(baseUrl, lang), `${baseUrl.replace(/\/$/, "")}/${lang}/barometre/tjm`, `${baseUrl.replace(/\/$/, "")}/${lang}/barometre/competences`].map((url) => `<url><loc>${e(url)}</loc></url>`),
    ),
    ...items.map((a) => `<url><loc>${e(articleUrl(baseUrl, a.lang, a.slug))}</loc><lastmod>${isoDay(a.updatedAt)}</lastmod></url>`),
    "</urlset>",
    "",
  ].join("\n");
