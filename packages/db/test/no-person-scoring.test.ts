import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * La recherche filtre, elle ne classe pas les personnes (AI Act). Le moyen le plus sûr de tenir cette règle est que le
 * schéma n'offre aucune place où ranger un score : ce test échoue dès qu'une telle colonne apparaît.
 *
 * Seule exception : la note d'un avis, attachée à un contrat et jamais agrégée dans le profil.
 */
const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, "../prisma/schema.prisma"), "utf8");

const SCORING = /score|rank|rating|average|avg|stars|percentile|popularity|weight/i;
const ALLOWED = new Set(["Review.rating"]);

function fields(schema: string): string[] {
  const found: string[] = [];
  for (const [, model, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    for (const [, field] of (body ?? "").matchAll(/^\s+(\w+)\s+\S/gm)) {
      found.push(`${model}.${field}`);
    }
  }
  return found;
}

describe("aucun score de personne dans le schéma", () => {
  it("lit bien les champs des modèles", () => {
    expect(fields(SCHEMA)).toContain("FreelanceProfile.dailyRateCents");
    expect(fields(SCHEMA)).toContain("Review.rating");
  });

  it("n'a aucune colonne de score, de rang ou de moyenne hors la note d'un avis", () => {
    const offending = fields(SCHEMA).filter((f) => SCORING.test(f.split(".")[1] ?? "") && !ALLOWED.has(f));
    expect(offending).toEqual([]);
  });

  it("attrape une colonne de score si quelqu'un en ajoute une", () => {
    const tampered = SCHEMA.replace("model Wave {", "model Wave {\n  trustScore Int");
    expect(fields(tampered).filter((f) => SCORING.test(f.split(".")[1] ?? ""))).toContain("Wave.trustScore");
  });
});
