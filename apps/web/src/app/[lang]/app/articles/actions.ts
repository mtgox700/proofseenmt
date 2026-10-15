"use server";

import { redirect } from "next/navigation";
import { articleDesk, type ArticleDesk, type ArticleField } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import type { Lang } from "@/i18n";
import { articleFromForm, sourcesToField } from "@/lib/article-form";
import { actionMarket, langOf, uuidOf } from "@/lib/market";

/*
 * Server actions of the operator's article desk. The role comes from the session (the OPERATOR_EMAILS allowlist),
 * never from the form; anyone else is sent back to the app home before the desk is even opened. Saving re-validates
 * everything in the repository, including "no figure without a source"; publishing re-validates again.
 */

const RULE = { windowMs: 60_000, max: 30 };

/** What the form shows after a refused save: the error, the fields to fix, and what was typed, so nothing is lost. */
export type ArticleFormState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "error";
      readonly code: "invalid" | "slug_taken" | "absent" | "too_many";
      readonly fields: readonly ArticleField[];
      readonly values: Readonly<Record<string, string>>;
    };

const articlesPath = (lang: Lang, query = ""): string => `/${lang}/app/articles${query === "" ? "" : `?${query}`}`;
const articlePath = (lang: Lang, id: string, query = ""): string => `/${lang}/app/articles/${id}${query === "" ? "" : `?${query}`}`;

const operatorDesk = async (formData: FormData): Promise<{ readonly lang: Lang; readonly desk: ArticleDesk; readonly limited: boolean }> => {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "operator") redirect(`/${lang}/app`);
  const limited = await throttled("article-desk", market.actor.userId, RULE, new Date());
  return { lang, desk: articleDesk(market.db, { role: "operator" }), limited };
};

const typed = (formData: FormData): Record<string, string> => {
  const input = articleFromForm(formData);
  return {
    articleLang: input.lang,
    slug: input.slug,
    title: input.title,
    description: input.description,
    body: input.body,
    category: input.category,
    audience: input.audience,
    authorName: input.authorName,
    sources: sourcesToField(input.sources),
  };
};

export async function saveArticle(_previous: ArticleFormState, formData: FormData): Promise<ArticleFormState> {
  const { lang, desk, limited } = await operatorDesk(formData);
  if (limited) return { kind: "error", code: "too_many", fields: [], values: typed(formData) };
  const id = uuidOf(formData.get("id"));
  const input = articleFromForm(formData);
  const result = id === null ? await desk.create(input) : await desk.update(id, input);
  if (result.kind === "saved") redirect(articlePath(lang, result.id, "enregistre=1"));
  return { kind: "error", code: result.kind, fields: result.kind === "invalid" ? result.fields : [], values: typed(formData) };
}

export async function publishArticle(formData: FormData): Promise<void> {
  const { lang, desk, limited } = await operatorDesk(formData);
  const id = uuidOf(formData.get("id"));
  if (id === null) redirect(articlesPath(lang));
  if (limited) redirect(articlePath(lang, id, "erreur=trop"));
  const result = await desk.publish(id, new Date());
  if (result.kind === "absent") redirect(articlesPath(lang));
  redirect(articlePath(lang, id, result.kind === "done" ? "publie=1" : `erreur=invalide&champs=${result.fields.join(",")}`));
}

export async function unpublishArticle(formData: FormData): Promise<void> {
  const { lang, desk, limited } = await operatorDesk(formData);
  const id = uuidOf(formData.get("id"));
  if (id === null) redirect(articlesPath(lang));
  if (limited) redirect(articlePath(lang, id, "erreur=trop"));
  const result = await desk.unpublish(id);
  redirect(result.kind === "done" ? articlePath(lang, id, "retire=1") : articlesPath(lang));
}
