import { escapeHtml as e } from "./html";
import { isoDay, longDate, type Lang } from "./market-shell";
import { renderMarkdown } from "./markdown";
import { renderFrame } from "./page-frame";
import { articleUrl, AUDIENCE_LABELS, blogFeedUrl, blogIndexUrl, CATEGORY_LABELS, type BlogArticleView, type BlogCardView } from "./blog-model";

/*
 * Page d'un article publié : le texte (Markdown rendu sûr), ses dates de publication et de mise à jour, son auteur, ses
 * sources, des articles liés. Données structurées BlogPosting, avec les sources en `citation` : un moteur qui cite
 * l'article sait d'où viennent ses chiffres.
 */

const LABELS = {
  fr: {
    back: "← Blog",
    by: (name: string) => `Par ${name}`,
    published: (d: string) => `publié le ${d}`,
    updated: (d: string) => `mis à jour le ${d}`,
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
    toc: "Contents",
    sources: "Sources",
    sourcesLead: "The figures and rules in this article come from these official pages.",
    noSources: "This article quotes no figure.",
    related: "Read next",
    feed: "Follow the blog by RSS",
  },
} as const;

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
  if (a.sources.length === 0) return `<section aria-labelledby="article-sources"><h2 id="article-sources">${l.sources}</h2><p class="muted">${l.noSources}</p></section>`;
  const items = a.sources.map(sourceItem).join("");
  return `<section aria-labelledby="article-sources"><h2 id="article-sources">${l.sources}</h2><p class="muted">${l.sourcesLead}</p><ol class="sources">${items}</ol></section>`;
};

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
      `<p class="meta">${e(CATEGORY_LABELS[a.lang][a.category])} · ${e(AUDIENCE_LABELS[a.lang][a.audience])}</p>`,
      `<h1 class="title">${e(a.title)}</h1>`,
      `<p class="headline">${e(a.description)}</p>`,
      `<p class="byline">${e(l.by(a.authorName))} · ${dates}</p>`,
      toc.length < MIN_TOC_HEADINGS ? "" : `<nav class="toc" aria-label="${l.toc}"><strong>${l.toc}</strong><ol>${toc.map((h) => `<li><a href="#${h.id}">${e(h.text)}</a></li>`).join("")}</ol></nav>`,
      `<div class="prose">${html}</div>`,
      sourcesSection(a, a.lang),
      `</article>`,
      related.length === 0
        ? ""
        : `<section aria-labelledby="article-related"><h2 id="article-related">${l.related}</h2><ul class="more">${related
            .map((r) => `<li><a href="/${r.lang}/blog/${e(encodeURIComponent(r.slug))}">${e(r.title)}<small>${e(CATEGORY_LABELS[r.lang][r.category])} · ${longDate(r.publishedAt, r.lang)}</small></a></li>`)
            .join("")}</ul></section>`,
      `<p class="meta"><a href="/${a.lang}/blog/rss.xml">${l.feed}</a></p>`,
    ],
  });
};
