import { escapeHtml as e } from "./html";
import { isoDay, longDate, type Lang } from "./market-shell";
import { renderMarkdown } from "./markdown";
import { renderFrame } from "./page-frame";
import { LEDGER_STYLES } from "./ledger";
import { articleUrl, AUDIENCE_LABELS, blogFeedUrl, blogIndexUrl, CATEGORY_LABELS, type BlogArticleView, type BlogCardView } from "./blog-model";

/*
 * Page d'un article publié : le texte (Markdown rendu sûr), ses dates de publication et de mise à jour, son auteur, ses
 * sources, des articles liés. Données structurées BlogPosting, avec les sources en `citation` : un moteur qui cite
 * l'article sait d'où viennent ses chiffres.
 *
 * Lot f de la refonte : une page de lecture. Une colonne à la mesure de 66 caractères, les titres en PS Display, la
 * trace (catégorie, auteur, dates, nombre de sources) en mono en tête, et les sources numérotées, avec leur domaine,
 * annoncées dès l'en-tête.
 */

const LABELS = {
  fr: {
    back: "← Blog",
    by: (name: string) => `Par ${name}`,
    published: (d: string) => `publié le ${d}`,
    updated: (d: string) => `mis à jour le ${d}`,
    sourceCount: (n: number) => (n === 0 ? "aucune source citée" : n === 1 ? "1 source" : `${n} sources`),
    toc: "Sommaire",
    sources: "Sources",
    sourcesLead: "Les chiffres et les règles de cet article viennent de ces pages officielles.",
    noSources: "Cet article ne cite aucun chiffre.",
    related: "À lire aussi",
    feed: "Suivre le blog par RSS",
  },
  en: {
    back: "← Blog",
    by: (name: string) => `By ${name}`,
    published: (d: string) => `published on ${d}`,
    updated: (d: string) => `updated on ${d}`,
    sourceCount: (n: number) => (n === 0 ? "no source quoted" : n === 1 ? "1 source" : `${n} sources`),
    toc: "Contents",
    sources: "Sources",
    sourcesLead: "The figures and rules in this article come from these official pages.",
    noSources: "This article quotes no figure.",
    related: "Read next",
    feed: "Follow the blog by RSS",
  },
} as const;

/** La lecture : mesure de 66 caractères, interlignage ouvert, titres en PS Display au lieu des libellés mono du hub. */
const ARTICLE_STYLES =
  "main>.crumb{display:inline-flex;align-items:center;min-height:2.75rem}" +
  ".head .title{margin-top:var(--ps-space-3)}.head .byline{margin-top:var(--ps-space-4)}.head .byline a{color:inherit}" +
  ".prose{max-width:var(--ps-measure);margin-top:var(--ps-space-7);line-height:1.7}" +
  ".prose h2{display:block;margin:var(--ps-space-8) 0 var(--ps-space-3);font:var(--ps-weight-display) var(--ps-step-2)/var(--ps-lead-2) var(--ps-font-display);letter-spacing:var(--ps-track-2);text-transform:none;color:var(--ps-text);scroll-margin-top:5rem}" +
  ".prose h2::before{content:none}" +
  ".prose h3{margin:var(--ps-space-6) 0 var(--ps-space-2);scroll-margin-top:5rem}" +
  ".prose p,.prose ul,.prose ol,.prose blockquote,.prose pre{margin:0 0 var(--ps-space-4)}" +
  ".prose li::marker{color:var(--ps-muted)}" +
  ".prose pre code{border:0;padding:0;background:none}" +
  ".prose strong{font-weight:var(--ps-weight-strong)}" +
  ".prose blockquote{margin-inline:0;padding:var(--ps-space-1) 0 var(--ps-space-1) var(--ps-space-5);border-left:2px solid var(--ps-text);color:var(--ps-text);font:var(--ps-weight-display) var(--ps-step-1)/1.4 var(--ps-font-display)}" +
  ".toc{max-width:var(--ps-measure);margin-top:var(--ps-space-6);padding:var(--ps-space-4) var(--ps-space-5);border:1px solid var(--ps-line);border-left:2px solid var(--ps-line-strong);border-radius:var(--ps-radius);background:var(--ps-surface)}" +
  ".toc ol{margin:var(--ps-space-2) 0 0;padding-left:var(--ps-space-5)}.toc li::marker{font-family:var(--ps-font-mono);color:var(--ps-muted)}" +
  ".toc a{display:inline-flex;align-items:center;min-height:2.75rem}" +
  ".sources{max-width:var(--ps-measure);padding-left:var(--ps-space-6)}.sources li{margin:var(--ps-space-3) 0}.sources li::marker{font-family:var(--ps-font-mono);color:var(--ps-muted)}" +
  ".sources small{display:block;font:var(--ps-weight-mono) var(--ps-step--2)/1.4 var(--ps-font-mono)}" +
  ".related .entry h3{font-size:var(--ps-step-1);line-height:var(--ps-lead-1)}" +
  ".feed a{display:inline-flex;align-items:center;min-height:2.75rem}" +
  "@media (min-width:48rem){.related .entries{grid-template-columns:repeat(2,minmax(0,1fr))}}";

const MIN_TOC_HEADINGS = 3;

/** L'auteur : l'équipe signe comme organisation, une personne comme personne. */
const authorOf = (name: string): { readonly "@type": string; readonly name: string } => ({ "@type": /proofseen/i.test(name) ? "Organization" : "Person", name });

export const articleJsonLd = (a: BlogArticleView, baseUrl: string): Record<string, unknown> => {
  const base = baseUrl.replace(/\/$/, "");
  const url = articleUrl(base, a.lang, a.slug);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: a.lang,
    datePublished: a.publishedAt.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    articleSection: CATEGORY_LABELS[a.lang][a.category],
    audience: { "@type": "Audience", audienceType: AUDIENCE_LABELS[a.lang][a.audience] },
    author: authorOf(a.authorName),
    publisher: { "@type": "Organization", name: "Proofseen", url: base },
    isPartOf: { "@type": "Blog", url: blogIndexUrl(base, a.lang) },
    citation: a.sources.filter((s) => httpsHost(s.url) !== null).map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
  };
};

/** Le domaine d'une source https, ou `null` : une adresse d'une autre forme n'est jamais rendue en lien. */
const httpsHost = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.hostname : null;
  } catch {
    return null;
  }
};

const sourceItem = (s: BlogArticleView["sources"][number]): string => {
  const host = httpsHost(s.url);
  return host === null ? `<li>${e(s.title)}</li>` : `<li><a href="${e(s.url)}" rel="noopener">${e(s.title)}</a> <small class="muted">${e(host)}</small></li>`;
};

const sourcesSection = (a: BlogArticleView, lang: Lang): string => {
  const l = LABELS[lang];
  if (a.sources.length === 0) return `<section aria-labelledby="article-sources"><h2 class="part" id="article-sources">${l.sources}</h2><p class="muted">${l.noSources}</p></section>`;
  const items = a.sources.map(sourceItem).join("");
  return `<section aria-labelledby="article-sources"><h2 class="part" id="article-sources">${l.sources}</h2><p class="part-note">${l.sourcesLead}</p><ol class="sources">${items}</ol></section>`;
};

const relatedSection = (related: readonly BlogCardView[], lang: Lang): string =>
  related.length === 0
    ? ""
    : `<section class="related" aria-labelledby="article-related"><h2 class="part" id="article-related">${LABELS[lang].related}</h2><ul class="entries">${related
        .map(
          (r) =>
            `<li class="entry"><p class="ref">${e(CATEGORY_LABELS[r.lang][r.category])} · <time datetime="${isoDay(r.publishedAt)}">${e(longDate(r.publishedAt, r.lang))}</time></p>` +
            `<h3><a href="/${r.lang}/blog/${e(encodeURIComponent(r.slug))}">${e(r.title)}</a></h3></li>`,
        )
        .join("")}</ul></section>`;

export const renderArticlePage = (a: BlogArticleView, related: readonly BlogCardView[], o: { readonly baseUrl: string }): string => {
  const l = LABELS[a.lang];
  const base = o.baseUrl.replace(/\/$/, "");
  const other: Lang = a.lang === "fr" ? "en" : "fr";
  const { html, headings } = renderMarkdown(a.body);
  const toc = headings.filter((h) => h.level === 2);
  const dates =
    `<time datetime="${isoDay(a.publishedAt)}">${l.published(longDate(a.publishedAt, a.lang))}</time>` +
    (isoDay(a.updatedAt) === isoDay(a.publishedAt) ? "" : ` · <time datetime="${isoDay(a.updatedAt)}">${l.updated(longDate(a.updatedAt, a.lang))}</time>`);
  return renderFrame({
    lang: a.lang,
    title: a.title,
    description: a.description,
    canonical: articleUrl(base, a.lang, a.slug),
    jsonLd: articleJsonLd(a, base),
    otherHref: `/${other}/blog`,
    menu: "blog",
    styles: `${LEDGER_STYLES}${ARTICLE_STYLES}`,
    extraHead: [
      `<meta property="og:type" content="article">`,
      `<meta property="og:title" content="${e(a.title)}">`,
      `<meta property="og:description" content="${e(a.description)}">`,
      `<meta property="article:published_time" content="${a.publishedAt.toISOString()}">`,
      `<meta property="article:modified_time" content="${a.updatedAt.toISOString()}">`,
      `<link rel="alternate" type="application/rss+xml" href="${e(blogFeedUrl(base, a.lang))}">`,
    ],
    main: [
      `<a class="crumb" href="/${a.lang}/blog">${l.back}</a>`,
      `<article>`,
      `<header class="head"><p class="ref">${e(CATEGORY_LABELS[a.lang][a.category])} · ${e(AUDIENCE_LABELS[a.lang][a.audience])}</p>`,
      `<h1 class="title">${e(a.title)}</h1>`,
      `<p class="headline">${e(a.description)}</p>`,
      `<p class="byline trace">${e(l.by(a.authorName))} · ${dates} · <a href="#article-sources">${l.sourceCount(a.sources.length)}</a></p></header>`,
      toc.length < MIN_TOC_HEADINGS ? "" : `<nav class="toc" aria-label="${l.toc}"><p class="ref">${l.toc}</p><ol>${toc.map((h) => `<li><a href="#${h.id}">${e(h.text)}</a></li>`).join("")}</ol></nav>`,
      `<div class="prose">${html}</div>`,
      sourcesSection(a, a.lang),
      `</article>`,
      relatedSection(related, a.lang),
      `<p class="feed trace"><a href="/${a.lang}/blog/rss.xml">${l.feed}</a></p>`,
    ],
  });
};
