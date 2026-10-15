import { escapeHtml as e } from "./html";
import type { Lang } from "./market-shell";
import { articleUrl, blogFeedUrl, blogIndexUrl, CATEGORY_LABELS, type BlogCardView } from "./blog-model";

/*
 * Flux RSS 2.0 d'une langue du blog : les articles publiés, du plus récent au plus ancien. Chaque article y figure par
 * son titre, son chapeau et son adresse permanente — le texte complet se lit sur la page, avec ses sources.
 */

const CHANNEL = {
  fr: { title: "Proofseen — Blog et guides", description: "Guides pratiques datés et sourcés pour les freelances tech et les entreprises." },
  en: { title: "Proofseen — Blog and guides", description: "Dated, sourced practical guides for tech freelancers and companies." },
} as const;

export const blogFeed = (baseUrl: string, lang: Lang, items: readonly BlogCardView[], now: Date): string => {
  const base = baseUrl.replace(/\/$/, "");
  const c = CHANNEL[lang];
  const lastBuild = items.reduce((latest, a) => (a.updatedAt > latest ? a.updatedAt : latest), items[0]?.updatedAt ?? now);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${e(c.title)}</title>`,
    `<link>${e(blogIndexUrl(base, lang))}</link>`,
    `<description>${e(c.description)}</description>`,
    `<language>${lang}</language>`,
    `<lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
    `<atom:link href="${e(blogFeedUrl(base, lang))}" rel="self" type="application/rss+xml"/>`,
    ...items.map((a) => {
      const url = articleUrl(base, a.lang, a.slug);
      return (
        `<item><title>${e(a.title)}</title><link>${e(url)}</link><guid isPermaLink="true">${e(url)}</guid>` +
        `<pubDate>${a.publishedAt.toUTCString()}</pubDate><category>${e(CATEGORY_LABELS[a.lang][a.category])}</category>` +
        `<description>${e(a.description)}</description></item>`
      );
    }),
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
};
