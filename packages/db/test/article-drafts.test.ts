import { describe, expect, it } from "vitest";
import { ARTICLE_DRAFTS } from "../prisma/seeds/articles-drafts";
import { ArticleInputSchema } from "../src/article-input";

/*
 * Les guides livrés en brouillon passent les règles d'écriture du bureau de rédaction : pas de HTML, des sources https
 * officielles dès qu'un chiffre apparaît. Ils ne promettent aucun résultat.
 */

const OFFICIAL = /^https:\/\/(?:entreprendre\.)?service-public\.(?:gouv\.)?fr\/|^https:\/\/www\.(?:urssaf|economie\.gouv|impots\.gouv)\.fr\//;

describe("guides livrés en brouillon", () => {
  it("sont trois, en français, et passent le schéma d'écriture", () => {
    expect(ARTICLE_DRAFTS).toHaveLength(3);
    for (const draft of ARTICLE_DRAFTS) {
      const parsed = ArticleInputSchema.safeParse(draft);
      expect(parsed.success, `${draft.slug} : ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`).toBe(true);
      expect(draft.lang).toBe("fr");
    }
  });

  it("ne citent que des sources officielles, et aucune promesse", () => {
    for (const draft of ARTICLE_DRAFTS) {
      expect(draft.sources.length).toBeGreaterThan(0);
      expect(draft.sources.every((s) => OFFICIAL.test(s.url)), draft.slug).toBe(true);
      expect(`${draft.title} ${draft.description} ${draft.body}`).not.toMatch(/garanti|meilleur|n°\s?1|leader|Proofseen vous/i);
    }
  });

  it("ont des adresses distinctes", () => {
    expect(new Set(ARTICLE_DRAFTS.map((d) => d.slug)).size).toBe(ARTICLE_DRAFTS.length);
  });
});
