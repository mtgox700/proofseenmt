import type { Lang } from "./market-shell";

/*
 * Ce que le blog affiche d'un article, et les libellés de ses catégories et de ses publics. Les vocabulaires sont ceux
 * de la base (`ArticleCategory`, `ArticleAudience`), repris ici pour que ce paquet reste sans dépendance vers elle.
 */

export const BLOG_CATEGORIES = ["guide", "actualite", "etude"] as const;
export const BLOG_AUDIENCES = ["freelance", "entreprise", "tous"] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type BlogAudience = (typeof BLOG_AUDIENCES)[number];

export interface BlogCardView {
  readonly slug: string;
  readonly lang: Lang;
  readonly title: string;
  readonly description: string;
  readonly category: BlogCategory;
  readonly audience: BlogAudience;
  readonly authorName: string;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

export interface BlogArticleView extends BlogCardView {
  /** Markdown. */
  readonly body: string;
  readonly sources: readonly { readonly title: string; readonly url: string }[];
}

export const CATEGORY_LABELS: Readonly<Record<Lang, Readonly<Record<BlogCategory, string>>>> = {
  fr: { guide: "Guide", actualite: "Actualité", etude: "Étude" },
  en: { guide: "Guide", actualite: "News", etude: "Study" },
};

export const AUDIENCE_LABELS: Readonly<Record<Lang, Readonly<Record<BlogAudience, string>>>> = {
  fr: { freelance: "Pour les freelances", entreprise: "Pour les entreprises", tous: "Pour tous" },
  en: { freelance: "For freelancers", entreprise: "For companies", tous: "For everyone" },
};

export const blogIndexUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/blog`;
export const articleUrl = (baseUrl: string, lang: Lang, slug: string): string => `${blogIndexUrl(baseUrl, lang)}/${encodeURIComponent(slug)}`;
export const blogFeedUrl = (baseUrl: string, lang: Lang): string => `${blogIndexUrl(baseUrl, lang)}/rss.xml`;
