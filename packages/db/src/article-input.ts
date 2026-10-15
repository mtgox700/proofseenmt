import { z } from "zod";

/*
 * Ce qu'un article doit être pour entrer en base, vérifié avant toute écriture (la migration le revérifie en CHECK).
 *
 * Deux règles de fond, au-delà des longueurs :
 * - pas de HTML brut : l'article s'écrit en Markdown, et le rendu échappe de toute façon ce qui ressemblerait à une
 *   balise ; le refuser à l'écriture évite qu'un texte soit publié autrement qu'il a été relu ;
 * - aucun chiffre sans source : dès que le titre, le chapeau ou le corps contient un chiffre, au moins une source est
 *   exigée. Le chiffre peut être une date ou un article de loi : une source ne coûte rien, un chiffre inventé coûte la
 *   confiance de tout le blog.
 */

export const ARTICLE_LANGS = ["fr", "en"] as const;
export const ARTICLE_CATEGORIES = ["guide", "actualite", "etude"] as const;
export const ARTICLE_AUDIENCES = ["freelance", "entreprise", "tous"] as const;
export const MAX_ARTICLE_SOURCES = 30;
export const MAX_ARTICLE_BODY = 100_000;

export type ArticleLang = (typeof ARTICLE_LANGS)[number];

/** Une balise HTML, un commentaire ou une déclaration : tout ce que le Markdown n'a pas à contenir. */
const RAW_HTML = /<\/?[a-z][^>]*>|<!--|<![a-z]/i;
const DIGIT = /\d/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 120;

const noHtml = (value: string): boolean => !RAW_HTML.test(value);

export const ArticleSourceSchema = z.object({
  title: z.string().trim().min(1).max(200).refine(noHtml),
  // Une source se consulte : une adresse https complète, rien d'autre (ni javascript:, ni http en clair).
  url: z.url({ protocol: /^https$/, hostname: z.regexes.domain }).max(2000),
});

export type ArticleSource = z.infer<typeof ArticleSourceSchema>;

/** Une adresse d'article tirée d'un titre : minuscules, sans accents, des tirets entre les mots. */
export const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");

export const ArticleInputSchema = z
  .object({
    lang: z.enum(ARTICLE_LANGS),
    slug: z.string().trim().max(MAX_SLUG).regex(SLUG),
    title: z.string().trim().min(1).max(160).refine(noHtml, { message: "html" }),
    description: z.string().trim().min(1).max(300).refine(noHtml, { message: "html" }),
    body: z.string().trim().min(1).max(MAX_ARTICLE_BODY).refine(noHtml, { message: "html" }),
    category: z.enum(ARTICLE_CATEGORIES),
    audience: z.enum(ARTICLE_AUDIENCES),
    authorName: z.string().trim().min(1).max(80).refine(noHtml, { message: "html" }),
    sources: z.array(ArticleSourceSchema).max(MAX_ARTICLE_SOURCES),
  })
  .superRefine((article, ctx) => {
    if (article.sources.length === 0 && DIGIT.test(`${article.title}\n${article.description}\n${article.body}`)) {
      ctx.addIssue({ code: "custom", path: ["sources"], message: "chiffre-sans-source" });
    }
  });

export type ArticleInput = z.infer<typeof ArticleInputSchema>;

/** Les champs refusés, par leur nom : l'éditeur dit lesquels corriger. */
export type ArticleField = keyof ArticleInput;

export const invalidFields = (error: z.ZodError): readonly ArticleField[] => {
  const keys = new Set<ArticleField>();
  for (const issue of error.issues) {
    const head = issue.path[0];
    if (typeof head === "string" && head in ArticleInputSchema.shape) keys.add(head as ArticleField);
  }
  return [...keys];
};

/** Les sources lues en base (une colonne JSON) : seules celles qui ont encore la bonne forme sortent. */
export const sourcesOf = (raw: unknown): readonly ArticleSource[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = ArticleSourceSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
};
