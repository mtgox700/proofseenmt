import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { missionFiltersFromBrief, profileFiltersFromBrief } from "../src/brief-filters";
import { SEARCH_SORTS } from "../src/missions";
import { PROFILE_SORTS } from "../src/profiles";

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
    // C14 : la date de disponibilité s'ajoute, un fait déclaré par le freelance et daté, affiché comme critère choisi.
    // C22 : le nombre de faits vérifiés s'ajoute, un compte de faits nommés (missions vérifiées, adresses prouvées, SIRET
    // actif, attestation URSSAF), chacun pour un, affiché sur chaque carte et choisi par l'entreprise : ni poids, ni modèle.
    expect([...PROFILE_SORTS].sort()).toEqual(["availability", "rate_asc", "rate_desc", "recent", "verified_facts"]);
    expect([...SEARCH_SORTS].sort()).toEqual(["rate_asc", "rate_desc", "recent"]);
  });

  it("aucune colonne de score, de rang ou de note agrégée sur une personne", () => {
    const people = ["User", "FreelanceProfile", "BillingIdentity", "Membership"].flatMap(fieldsOf);
    expect(people.length).toBeGreaterThan(10);
    expect(people.filter((f) => /score|rank|rating|grade|tier/i.test(f))).toEqual([]);
  });

  it("un brief traduit par un modèle ne donne jamais d'ordre : ni tri, ni score, ni liste de personnes", () => {
    const hostile = { skills: ["Go"], sort: "rate_desc", order: ["FR-ABCDE"], score: 1, ranking: [1, 2], people: ["Jean"] };
    for (const filters of [profileFiltersFromBrief(hostile), missionFiltersFromBrief(hostile)]) {
      expect(filters).not.toBeNull();
      expect(Object.keys(filters ?? {}).filter((k) => /sort|order|score|rank|people/i.test(k))).toEqual([]);
    }
  });

  it("un avis porte sur une mission payée, sa note reste celle d'un avis : aucune moyenne stockée", () => {
    expect(fieldsOf("Review")).toContain("rating");
    expect(schema).not.toMatch(/average|avgRating|ratingCount/i);
  });
});
