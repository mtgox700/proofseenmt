import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { ArticleAudience, ArticleCategory, ArticleStatus } from "./generated/enums";
import { ArticleInputSchema, invalidFields, sourcesOf, type ArticleField, type ArticleInput, type ArticleLang, type ArticleSource } from "./article-input";

/*
 * Le bureau de rédaction : brouillons, relecture, publication et retrait. Réservé à l'opérateur — un rôle que la base
 * ne connaît pas (il vient de la liste OPERATOR_EMAILS du serveur) : le bureau refuse donc de s'ouvrir pour tout autre
 * rôle, et l'appelant ne le construit qu'après avoir lu le rôle dans la session.
 *
 * Publier revalide l'article entier : un brouillon enregistré avant une règle (ou modifié en base) ne sort jamais sans
 * la respecter, en particulier « aucun chiffre sans source ».
 */

export interface ArticleEditor {
  readonly role: "operator";
}

export interface DeskSummary {
  readonly id: string;
  readonly slug: string;
  readonly lang: ArticleLang;
  readonly title: string;
  readonly category: ArticleCategory;
  readonly audience: ArticleAudience;
  readonly status: ArticleStatus;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
}

export interface DeskArticle extends DeskSummary {
  readonly description: string;
  readonly body: string;
  readonly authorName: string;
  readonly sources: readonly ArticleSource[];
}

export type SaveArticleResult =
  | { readonly kind: "saved"; readonly id: string }
  | { readonly kind: "invalid"; readonly fields: readonly ArticleField[] }
  | { readonly kind: "slug_taken" }
  | { readonly kind: "absent" };

export type PublishArticleResult = { readonly kind: "done" } | { readonly kind: "invalid"; readonly fields: readonly ArticleField[] } | { readonly kind: "absent" };

export interface ArticleDesk {
  list(): Promise<readonly DeskSummary[]>;
  get(id: string): Promise<DeskArticle | null>;
  create(raw: unknown): Promise<SaveArticleResult>;
  update(id: string, raw: unknown): Promise<SaveArticleResult>;
  publish(id: string, now?: Date): Promise<PublishArticleResult>;
  unpublish(id: string): Promise<PublishArticleResult>;
}

const MAX_DESK_ROWS = 500;
const Uuid = z.uuid();

const langOf = (lang: string): ArticleLang => (lang === "en" ? "en" : "fr");

const SELECT = {
  id: true,
  slug: true,
  lang: true,
  title: true,
  description: true,
  body: true,
  category: true,
  audience: true,
  authorName: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  sources: true,
} as const;

const dataOf = (input: ArticleInput) => ({ ...input, sources: input.sources.map((s) => ({ title: s.title, url: s.url })) });

export const articleDesk = (db: Db, editor: ArticleEditor): ArticleDesk => {
  if (editor.role !== "operator") throw new Error("bureau de rédaction réservé à l'opérateur");

  const save = async (write: (input: ArticleInput) => Promise<string | null>, raw: unknown): Promise<SaveArticleResult> => {
    const parsed = ArticleInputSchema.safeParse(raw);
    if (!parsed.success) return { kind: "invalid", fields: invalidFields(parsed.error) };
    try {
      const id = await write(parsed.data);
      return id === null ? { kind: "absent" } : { kind: "saved", id };
    } catch (error) {
      if (isUniqueViolation(error)) return { kind: "slug_taken" };
      throw error;
    }
  };

  const get = async (id: string): Promise<DeskArticle | null> => {
    if (!Uuid.safeParse(id).success) return null;
    const row = await db.article.findUnique({ where: { id }, select: SELECT });
    return row === null ? null : { ...row, lang: langOf(row.lang), sources: sourcesOf(row.sources) };
  };

  return {
    async list() {
      const rows = await db.article.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: MAX_DESK_ROWS,
        select: { id: true, slug: true, lang: true, title: true, category: true, audience: true, status: true, publishedAt: true, updatedAt: true },
      });
      return rows.map((row) => ({ ...row, lang: langOf(row.lang) }));
    },

    get,

    create(raw) {
      return save(async (input) => (await db.article.create({ data: dataOf(input), select: { id: true } })).id, raw);
    },

    update(id, raw) {
      if (!Uuid.safeParse(id).success) return Promise.resolve({ kind: "absent" });
      return save(async (input) => ((await db.article.updateMany({ where: { id }, data: dataOf(input) })).count === 1 ? id : null), raw);
    },

    async publish(id, now = new Date()) {
      const article = await get(id);
      if (article === null) return { kind: "absent" };
      const parsed = ArticleInputSchema.safeParse({
        lang: article.lang,
        slug: article.slug,
        title: article.title,
        description: article.description,
        body: article.body,
        category: article.category,
        audience: article.audience,
        authorName: article.authorName,
        sources: article.sources,
      });
      if (!parsed.success) return { kind: "invalid", fields: invalidFields(parsed.error) };
      // La première date de publication reste : retirer puis republier un article ne le rajeunit pas.
      await db.article.update({ where: { id }, data: { status: "published", publishedAt: article.publishedAt ?? now } });
      return { kind: "done" };
    },

    async unpublish(id) {
      if (!Uuid.safeParse(id).success) return { kind: "absent" };
      const { count } = await db.article.updateMany({ where: { id }, data: { status: "draft" } });
      return count === 1 ? { kind: "done" } : { kind: "absent" };
    },
  };
};
