import { escapeHtml as e } from "./html";
import { isoDay, longDate, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import { blankState, LEDGER_STYLES } from "./ledger";
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
 *
 * Lot f de la refonte : des fiches à la grammaire du registre (catégorie et public en trace, titre en PS Display, dates
 * et auteur en pied), et les deux baromètres présentés comme des jeux de données, avec leurs fichiers.
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
    order: "Ordre : date de publication, les plus récents d'abord.",
    empty: "Aucun article publié pour ce choix pour l'instant.",
    emptyWhy: "D'autres articles existent peut-être dans une autre catégorie ou pour un autre public.",
    none: "Aucun article publié pour l'instant.",
    noneWhy: "Les guides apparaissent ici, datés, avec la liste de leurs sources officielles.",
    allArticles: "Voir tous les articles",
    previous: "Page précédente",
    next: "Page suivante",
    published: (d: string) => `Publié le ${d}`,
    updated: (d: string) => `mis à jour le ${d}`,
    barometers: "Baromètres",
    barometersNote: "Calculés sur les données de Proofseen, chaque chiffre avec son effectif n et sa date, téléchargeables sous licence CC BY 4.0.",
    dataset: "Jeu de données · CC BY 4.0",
    ratesTitle: "Baromètre des TJM",
    rates: "Baromètre des TJM : médianes et quartiles, avec l'effectif de chaque groupe.",
    skillsTitle: "Compétences demandées",
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
    order: "Order: publication date, most recent first.",
    empty: "No article published for this choice yet.",
    emptyWhy: "Other articles may exist in another category or for another audience.",
    none: "No article published yet.",
    noneWhy: "Guides show here, dated, with the list of their official sources.",
    allArticles: "See all articles",
    previous: "Previous page",
    next: "Next page",
    published: (d: string) => `Published on ${d}`,
    updated: (d: string) => `updated on ${d}`,
    barometers: "Barometers",
    barometersNote: "Computed on Proofseen's data, every figure with its size n and its date, downloadable under the CC BY 4.0 licence.",
    dataset: "Dataset · CC BY 4.0",
    ratesTitle: "Day-rate barometer",
    rates: "Day-rate barometer: medians and quartiles, with the size of every group.",
    skillsTitle: "Skills in demand",
    skills: "Skills requested by the missions of the last 90 days.",
    feed: "RSS feed",
  },
} as const;

/** Les filtres en liens (44 px), les fiches sur deux colonnes à partir de 48 rem. */
const BLOG_STYLES =
  ".filt{margin-top:var(--ps-space-5)}.filt .ref{margin-bottom:var(--ps-space-1)}" +
  ".chips{margin-top:0}.chips a{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 var(--ps-space-4)}" +
  "@media (hover:hover) and (pointer:fine){.chips a:hover{color:var(--ps-text);border-color:var(--ps-line-strong)}}" +
  ".entry .desc{color:var(--ps-muted)}" +
  ".data-files{display:flex;flex-wrap:wrap;gap:0 var(--ps-space-4)}.data-files a{display:inline-flex;align-items:center;justify-content:center;min-width:2.75rem;min-height:2.75rem}" +
  ".feed{margin-top:var(--ps-space-6)}.feed a{display:inline-flex;align-items:center;min-height:2.75rem}" +
  "@media (min-width:48rem){.entries.posts,.entries.datasets{grid-template-columns:repeat(2,minmax(0,1fr))}}";

const query = (f: BlogFilters, page: number): string => {
  const params = new URLSearchParams();
  if (f.category !== null) params.set("categorie", f.category);
  if (f.audience !== null) params.set("public", f.audience);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

const chip = (href: string, label: string, current: boolean): string => `<li><a href="${e(href)}"${current ? ' aria-current="true"' : ""}>${e(label)}</a></li>`;

/** La fiche d'un article : catégorie et public en trace, titre, chapeau, puis dates et auteur. */
export const blogCard = (a: BlogCardView, lang: Lang): string => {
  const l = LABELS[lang];
  const updated = isoDay(a.updatedAt) === isoDay(a.publishedAt) ? "" : ` · <time datetime="${isoDay(a.updatedAt)}">${e(l.updated(longDate(a.updatedAt, lang)))}</time>`;
  return (
    `<li class="entry post"><p class="ref">${e(CATEGORY_LABELS[lang][a.category])} · ${e(AUDIENCE_LABELS[lang][a.audience])}</p>` +
    `<h3><a href="/${lang}/blog/${e(encodeURIComponent(a.slug))}">${e(a.title)}</a></h3>` +
    `<p class="desc">${e(a.description)}</p>` +
    `<p class="trace foot-line"><time datetime="${isoDay(a.publishedAt)}">${l.published(longDate(a.publishedAt, lang))}</time>${updated} · ${e(a.authorName)}</p></li>`
  );
};

/** Un baromètre présenté comme un jeu de données : sa page, et ses deux fichiers au-dessus du lien de la fiche. */
const datasetCard = (lang: Lang, title: string, text: string, path: string, file: string): string =>
  `<li class="entry dataset"><p class="ref">${LABELS[lang].dataset}</p><h3><a href="/${lang}/barometre/${path}">${e(title)}</a></h3><p class="desc">${e(text)}</p>` +
  `<p class="data-files trace foot-line over"><a href="/barometre/${file}.csv">CSV</a><a href="/barometre/${file}.json">JSON</a></p></li>`;

export const renderBlogIndex = (items: readonly BlogCardView[], o: { readonly baseUrl: string; readonly lang: Lang; readonly filters: BlogFilters; readonly hasMore: boolean }): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const base = o.baseUrl.replace(/\/$/, "");
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const path = `/${o.lang}/blog`;
  const filtered = f.category !== null || f.audience !== null;
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
  const list =
    items.length === 0
      ? filtered
        ? blankState(l.empty, l.emptyWhy, [{ text: l.allArticles, href: path }])
        : blankState(l.none, l.noneWhy, [])
      : `<p class="trace">${l.order}</p><ul class="entries posts">${items.map((a) => blogCard(a, o.lang)).join("")}</ul>`;
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
    styles: `${LEDGER_STYLES}${BLOG_STYLES}`,
    extraHead: [`<link rel="alternate" type="application/rss+xml" title="${e(`${l.title} · Proofseen`)}" href="${e(blogFeedUrl(base, o.lang))}">`],
    main: [
      `<h1 class="title">${l.title}</h1>`,
      `<p class="headline">${l.lead}</p>`,
      `<nav class="filt" aria-label="${l.category}"><p class="ref">${l.category}</p><ul class="chips">${categories}</ul></nav>`,
      `<nav class="filt" aria-label="${l.audience}"><p class="ref">${l.audience}</p><ul class="chips">${audiences}</ul></nav>`,
      `<h2 class="part">${l.articles}</h2>`,
      list,
      `<nav class="pager">${pager}</nav>`,
      `<h2 class="part" id="barometres">${l.barometers}</h2>`,
      `<p class="part-note">${l.barometersNote}</p>`,
      `<ul class="entries datasets">${datasetCard(o.lang, l.ratesTitle, l.rates, "tjm", "tjm")}${datasetCard(o.lang, l.skillsTitle, l.skills, "competences", "competences")}</ul>`,
      `<p class="feed trace"><a href="${path}/rss.xml">${l.feed}</a></p>`,
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
