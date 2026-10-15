import { describe, expect, it } from "vitest";
import { ArticleInputSchema } from "@proofseen/db";
import { articleFromForm, sourceOfLine, sourcesOfField, sourcesToField } from "../src/lib/article-form";
import { blogQuery } from "../src/lib/blog-query";
import { memoize } from "../src/lib/memo";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const VALID = {
  articleLang: "fr",
  slug: "",
  title: "Facturer une mission : les mentions obligatoires",
  description: "Ce qu'une facture doit porter.",
  body: "## Les mentions\r\n\r\nLa date et le numéro.",
  category: "guide",
  audience: "freelance",
  authorName: "Équipe Proofseen",
  sources: "",
};

describe("article form", () => {
  it("reads sources one per line, with or without a title", () => {
    expect(sourceOfLine("Mentions | https://entreprendre.service-public.fr/vosdroits/F31808")).toEqual({ title: "Mentions", url: "https://entreprendre.service-public.fr/vosdroits/F31808" });
    expect(sourceOfLine("https://www.urssaf.fr/accueil.html")).toEqual({ title: "www.urssaf.fr", url: "https://www.urssaf.fr/accueil.html" });
    expect(sourceOfLine("pas une adresse")).toEqual({ title: "pas une adresse", url: "pas une adresse" });
    expect(sourcesOfField("\n a | https://a.fr/x \r\n\n b | https://b.fr/y ")).toHaveLength(2);
    expect(sourcesToField([{ title: "a", url: "https://a.fr/x" }])).toBe("a | https://a.fr/x");
  });

  it("draws the address from the title and keeps the Markdown line breaks", () => {
    const input = articleFromForm(form(VALID));
    expect(input.slug).toBe("facturer-une-mission-les-mentions-obligatoires");
    expect(input.body).toBe("## Les mentions\n\nLa date et le numéro.");
    expect(ArticleInputSchema.safeParse(input).success).toBe(true);
  });

  it("lets the schema refuse a figure without a source and a source that is not an address", () => {
    expect(ArticleInputSchema.safeParse(articleFromForm(form({ ...VALID, body: "Un délai de 30 jours." }))).success).toBe(false);
    expect(ArticleInputSchema.safeParse(articleFromForm(form({ ...VALID, body: "Un délai de 30 jours.", sources: "Délais | https://www.economie.gouv.fr/x" }))).success).toBe(true);
    expect(ArticleInputSchema.safeParse(articleFromForm(form({ ...VALID, sources: "javascript:alert(1)" }))).success).toBe(false);
  });
});

describe("blog query", () => {
  it("reads category, audience and page, and falls back on anything malformed", () => {
    expect(blogQuery(new URLSearchParams("categorie=etude&public=entreprise&page=3"))).toEqual({ category: "etude", audience: "entreprise", page: 3 });
    expect(blogQuery(new URLSearchParams("categorie=<script>&public=x&page=-2"))).toEqual({ category: null, audience: null, page: 1 });
    expect(blogQuery(new URLSearchParams(""))).toEqual({ category: null, audience: null, page: 1 });
  });
});

describe("memoize", () => {
  it("computes once per period, shares the computation in flight, and forgets a failure", async () => {
    let now = 0;
    let calls = 0;
    const value = memoize(async () => (calls += 1), 1_000, () => now);
    expect(await Promise.all([value(), value()])).toEqual([1, 1]);
    now = 999;
    expect(await value()).toBe(1);
    now = 1_000;
    expect(await value()).toBe(2);

    let fail = true;
    const flaky = memoize(async () => {
      if (fail) throw new Error("down");
      return "ok";
    }, 1_000, () => 0);
    await expect(flaky()).rejects.toThrow("down");
    fail = false;
    expect(await flaky()).toBe("ok");
  });
});
