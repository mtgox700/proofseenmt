import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { ArticleAudience, ArticleCategory, ArticleStatus } from "./generated/enums";
import { ARTICLE_AUDIENCES, ARTICLE_CATEGORIES, sourcesOf, type ArticleLang, type ArticleSource } from "./article-input";

/*
 * Lecture publique du blog : seuls les articles publiés sortent, et le filtre « publié » est dans chaque requête — une
 * adresse de brouillon devinée répond « absent », exactement comme une adresse qui n'existe pas.
 *
 * L'écriture (brouillons, publication) est dans `article-desk.ts`, réservée à l'opérateur.
 */

export const BLOG_PAGE_SIZE = 12;
export const MAX_BLOG_PAGE = 500;
export const RELATED_ARTICLES = 3;
export const FEED_ITEMS = 50;
const MAX_SITEMAP_ARTICLES = 5000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ArticleSummary {
  readonly slug: string;
  readonly lang: ArticleLang;
  readonly title: string;
  readonly description: string;
  readonly category: ArticleCategory;
  readonly audience: ArticleAudience;
  readonly authorName: string;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

export interface PublishedArticle extends ArticleSummary {
  readonly body: string;
  readonly sources: readonly ArticleSource[];
}

export interface BlogSearch {
  readonly lang: ArticleLang;
  readonly category: ArticleCategory | null;
  readonly audience: ArticleAudience | null;
  readonly page: number;
}

export interface BlogPage {
  readonly items: readonly ArticleSummary[];
  readonly hasMore: boolean;
}

export interface Articles {
  page(search: BlogSearch): Promise<BlogPage>;
  bySlug(lang: ArticleLang, slug: string): Promise<PublishedArticle | null>;
  /** Les autres articles publiés de la même langue, ceux de la même catégorie d'abord. */
  related(article: Pick<ArticleSummary, "lang" | "slug" | "category">): Promise<readonly ArticleSummary[]>;
  /** Les plus récents d'une langue, pour le flux RSS. */
  feed(lang: ArticleLang): Promise<readonly PublishedArticle[]>;
  /** Tous les articles publiés, des deux langues : pour le sitemap et llms.txt. */
  listPublished(): Promise<readonly ArticleSummary[]>;
}

export const isArticleCategory = (value: unknown): value is ArticleCategory => typeof value === "string" && (ARTICLE_CATEGORIES as readonly string[]).includes(value);
export const isArticleAudience = (value: unknown): value is ArticleAudience => typeof value === "string" && (ARTICLE_AUDIENCES as readonly string[]).includes(value);

const SUMMARY = {
  slug: true,
  lang: true,
  title: true,
  description: true,
  category: true,
  audience: true,
  authorName: true,
  publishedAt: true,
  updatedAt: true,
} as const satisfies Prisma.ArticleSelect;

type SummaryRow = Prisma.ArticleGetPayload<{ select: typeof SUMMARY }>;

const summaryOf = (row: SummaryRow): ArticleSummary | null =>
  row.publishedAt === null || (row.lang !== "fr" && row.lang !== "en")
    ? null
    : { slug: row.slug, lang: row.lang, title: row.title, description: row.description, category: row.category, audience: row.audience, authorName: row.authorName, publishedAt: row.publishedAt, updatedAt: row.updatedAt };

const summaries = (rows: readonly SummaryRow[]): readonly ArticleSummary[] => rows.flatMap((row) => summaryOf(row) ?? []);

const fullOf = (row: SummaryRow & { readonly body: string; readonly sources: Prisma.JsonValue }): PublishedArticle | null => {
  const summary = summaryOf(row);
  return summary === null ? null : { ...summary, body: row.body, sources: sourcesOf(row.sources) };
};

const PUBLISHED = "published" satisfies ArticleStatus;
const RECENT: Prisma.ArticleOrderByWithRelationInput[] = [{ publishedAt: "desc" }, { id: "desc" }];

export const articles = (db: Db): Articles => ({
  async page(search) {
    const page = Math.min(Math.max(1, Math.trunc(search.page)), MAX_BLOG_PAGE);
    const rows = await db.article.findMany({
      where: {
        status: PUBLISHED,
        lang: search.lang,
        ...(search.category === null ? {} : { category: search.category }),
        ...(search.audience === null ? {} : { audience: search.audience }),
      },
      orderBy: RECENT,
      skip: (page - 1) * BLOG_PAGE_SIZE,
      take: BLOG_PAGE_SIZE + 1,
      select: SUMMARY,
    });
    return { items: summaries(rows.slice(0, BLOG_PAGE_SIZE)), hasMore: rows.length > BLOG_PAGE_SIZE };
  },

  async bySlug(lang, slug) {
    if (!SLUG.test(slug)) return null;
    const row = await db.article.findFirst({ where: { lang, slug, status: PUBLISHED }, select: { ...SUMMARY, body: true, sources: true } });
    return row === null ? null : fullOf(row);
  },

  async related(article) {
    const base = { status: PUBLISHED, lang: article.lang, slug: { not: article.slug } } satisfies Prisma.ArticleWhereInput;
    const same = await db.article.findMany({ where: { ...base, category: article.category }, orderBy: RECENT, take: RELATED_ARTICLES, select: SUMMARY });
    if (same.length >= RELATED_ARTICLES) return summaries(same);
    const others = await db.article.findMany({ where: { ...base, category: { not: article.category } }, orderBy: RECENT, take: RELATED_ARTICLES - same.length, select: SUMMARY });
    return summaries([...same, ...others]);
  },

  async feed(lang) {
    const rows = await db.article.findMany({ where: { status: PUBLISHED, lang }, orderBy: RECENT, take: FEED_ITEMS, select: { ...SUMMARY, body: true, sources: true } });
    return rows.flatMap((row) => fullOf(row) ?? []);
  },

  async listPublished() {
    return summaries(await db.article.findMany({ where: { status: PUBLISHED }, orderBy: [{ lang: "asc" }, ...RECENT], take: MAX_SITEMAP_ARTICLES, select: SUMMARY }));
  },
});
