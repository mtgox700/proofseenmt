import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROFILE_SORTS } from "../src/profiles";
import { SEARCH_SORTS } from "../src/missions";

/*
 * AI Act : la recherche de freelances filtre sur des faits et trie sur un critère que la personne choisit ; elle ne
 * calcule ni score, ni rang, ni note globale d'une personne. Ces tests échouent dès qu'une fonction ajoutée en
 * introduit un, pour que la décision soit prise consciemment et documentée, jamais par accident.
 */

const schema = readFileSync(join(__dirname, "..", "prisma", "schema.prisma"), "utf8");

const fieldsOf = (model: string): string[] => {
  const body = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(schema)?.[1] ?? "";
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z]\w*\s/.test(line))
    .map((line) => line.split(/\s+/)[0] ?? "");
};

describe("AI Act : aucun classement automatique de personnes", () => {
  it("les tris proposés sont des faits choisis par l'utilisateur, jamais un score", () => {
    expect([...PROFILE_SORTS].sort()).toEqual(["rate_asc", "rate_desc", "recent"]);
    expect([...SEARCH_SORTS].sort()).toEqual(["rate_asc", "rate_desc", "recent"]);
  });

  it("aucune colonne de score, de rang ou de note agrégée sur une personne", () => {
    const people = ["User", "FreelanceProfile", "BillingIdentity", "Membership"].flatMap(fieldsOf);
    expect(people.length).toBeGreaterThan(10);
    expect(people.filter((f) => /score|rank|rating|grade|tier/i.test(f))).toEqual([]);
  });

  it("un avis porte sur une mission payée, sa note reste celle d'un avis : aucune moyenne stockée", () => {
    expect(fieldsOf("Review")).toContain("rating");
    expect(schema).not.toMatch(/average|avgRating|ratingCount/i);
  });
});
