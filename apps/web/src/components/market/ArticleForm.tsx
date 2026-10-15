"use client";

import { useActionState } from "react";
import { saveArticle, type ArticleFormState } from "@/app/[lang]/app/articles/actions";
import type { Lang } from "@/i18n";
import { articlesEn } from "@/i18n/market/articles-en";
import { articlesFr } from "@/i18n/market/articles-fr";

interface ArticleFormProps {
  readonly lang: Lang;
  /** Absent for a new article. */
  readonly id?: string;
  readonly initial: Readonly<Record<string, string>>;
}

const INITIAL: ArticleFormState = { kind: "idle" };

/**
 * The article form. A plain form posting to a server action: it works without JavaScript (the server answers with the
 * page and the returned state). A refused save comes back with what was typed, so a long text is never lost.
 */
export function ArticleForm({ lang, id, initial }: ArticleFormProps) {
  const a = lang === "en" ? articlesEn : articlesFr;
  const [state, action, pending] = useActionState(saveArticle, INITIAL);
  const values = state.kind === "error" ? state.values : initial;
  const value = (name: string): string => values[name] ?? "";
  const labels: Readonly<Record<string, string>> = { ...a.fields, lang: a.fields.articleLang };
  const message =
    state.kind !== "error"
      ? null
      : state.code === "too_many"
        ? a.errors.tooMany
        : state.code === "slug_taken"
          ? a.errors.slugTaken
          : state.code === "absent"
            ? a.errors.absent
            : state.fields.includes("sources") && state.fields.length === 1
              ? a.errors.sources
              : a.errors.invalid(state.fields.map((f) => labels[f] ?? f).join(", "));
  const select = (name: "articleLang" | "category" | "audience", options: Readonly<Record<string, string>>) => (
    <div className="field">
      <label htmlFor={`article-${name}`}>{a.fields[name]}</label>
      <select id={`article-${name}`} name={name} defaultValue={value(name)} required>
        {Object.entries(options).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
  // React resets an action form once the action settles: the fields return to their `defaultValue`, which is then what
  // the server sent back (what was typed), never an empty form.
  return (
    <form action={action} className="panel">
      <input type="hidden" name="lang" value={lang} />
      {id === undefined ? null : <input type="hidden" name="id" value={id} />}
      {message === null ? null : (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <div className="field">
        <label htmlFor="article-title">{a.fields.title}</label>
        <input id="article-title" name="title" type="text" required maxLength={160} defaultValue={value("title")} />
      </div>
      <div className="field">
        <label htmlFor="article-slug">{a.fields.slug}</label>
        <input id="article-slug" name="slug" type="text" maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={value("slug")} aria-describedby="article-slug-hint" />
        <p id="article-slug-hint" className="field-hint">
          {a.fields.slugHint}
        </p>
      </div>
      <div className="field">
        <label htmlFor="article-description">{a.fields.description}</label>
        <textarea id="article-description" name="description" required maxLength={300} rows={3} defaultValue={value("description")} aria-describedby="article-description-hint" />
        <p id="article-description-hint" className="field-hint">
          {a.fields.descriptionHint}
        </p>
      </div>
      {select("articleLang", a.langs)}
      {select("category", a.categories)}
      {select("audience", a.audiences)}
      <div className="field">
        <label htmlFor="article-author">{a.fields.authorName}</label>
        <input id="article-author" name="authorName" type="text" required maxLength={80} defaultValue={value("authorName")} aria-describedby="article-author-hint" />
        <p id="article-author-hint" className="field-hint">
          {a.fields.authorHint}
        </p>
      </div>
      <div className="field">
        <label htmlFor="article-body">{a.fields.body}</label>
        <textarea id="article-body" name="body" required maxLength={100000} rows={24} defaultValue={value("body")} aria-describedby="article-body-hint" />
        <p id="article-body-hint" className="field-hint">
          {a.fields.bodyHint}
        </p>
      </div>
      <div className="field">
        <label htmlFor="article-sources">{a.fields.sources}</label>
        <textarea id="article-sources" name="sources" rows={6} defaultValue={value("sources")} aria-describedby="article-sources-hint" />
        <p id="article-sources-hint" className="field-hint">
          {a.fields.sourcesHint}
        </p>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {id === undefined ? a.save : a.saveChanges}
      </button>
    </form>
  );
}
