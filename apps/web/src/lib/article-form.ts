import { slugify, type ArticleSource } from "@proofseen/db";

/*
 * The operator's article form, as posted, turned into the desk's input. Sources are typed one per line as
 * "Title | https://address" (or a bare address, titled by its domain); an empty address field is drawn from the title.
 * The repository schema then decides what is valid, including "no figure without a source": this file only translates.
 */

const MAX_SOURCE_LINES = 30;

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** One line → one source. A line the schema cannot accept is kept as typed, so the desk reports it instead of dropping it. */
export const sourceOfLine = (line: string): ArticleSource => {
  const separator = line.lastIndexOf("|");
  if (separator === -1) {
    const url = line.trim();
    let title = url;
    try {
      title = new URL(url).hostname;
    } catch {
      // Not an address: the schema refuses it and the editor says which field to fix.
    }
    return { title, url };
  }
  return { title: line.slice(0, separator).trim(), url: line.slice(separator + 1).trim() };
};

export const sourcesOfField = (raw: string): ArticleSource[] =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, MAX_SOURCE_LINES + 1)
    .map(sourceOfLine);

/** The other way round, to fill the textarea when an article is edited. */
export const sourcesToField = (sources: readonly ArticleSource[]): string => sources.map((s) => `${s.title} | ${s.url}`).join("\n");

export interface ArticleFormInput {
  readonly lang: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly category: string;
  readonly audience: string;
  readonly authorName: string;
  readonly sources: readonly ArticleSource[];
}

export const articleFromForm = (form: FormData): ArticleFormInput => {
  const title = field(form, "title");
  const slug = field(form, "slug");
  return {
    lang: field(form, "articleLang"),
    slug: slug === "" ? slugify(title) : slug,
    title,
    description: field(form, "description"),
    // The body keeps its inner line breaks (Markdown needs them); only the outer blank space goes.
    body: field(form, "body").replace(/\r\n/g, "\n"),
    category: field(form, "category"),
    audience: field(form, "audience"),
    authorName: field(form, "authorName"),
    sources: sourcesOfField(field(form, "sources")),
  };
};
