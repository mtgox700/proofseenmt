import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEAL_KEYFRAMES, SEAL_LINE, SEAL_REACT, SEAL_SQUARE } from "@proofseen/brand";
import { describe, expect, it } from "vitest";
import { PROFILE_STYLES } from "../src/profile-styles";

/*
 * Lot 1 de l'espace connecté : le poinçon (cartouche, ligne de preuve, trace, carré, frappe et encre) est écrit une
 * fois dans @proofseen/brand (`seal.ts`) et partagé avec React. Le hub doit émettre exactement la feuille d'avant le
 * déplacement : `fixtures/profile-styles.css` est `PROFILE_STYLES` tel que `main` le rendait au commit aa44926, mis à
 * jour par la marque v2 (halo vert du cartouche et des carrés, rayons des cartes, fond du déclaré). Un
 * changement voulu du registre met cette pièce à jour dans le même commit, et la relecture le voit.
 */

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "profile-styles.css"), "utf8");

describe("la page de preuve émet la même feuille, poinçon partagé compris", () => {
  it("rend octet pour octet la feuille d'avant le partage", () => {
    expect(PROFILE_STYLES).toBe(fixture);
  });

  it("prend chaque règle du poinçon dans le paquet de marque, une seule fois", () => {
    for (const rule of [...SEAL_LINE, ...SEAL_SQUARE, ...SEAL_KEYFRAMES]) expect(PROFILE_STYLES.split(rule).length - 1, rule).toBe(1);
  });

  it("n'emporte pas les règles propres à React (accusé isolé, frappe posée par l'îlot)", () => {
    for (const rule of SEAL_REACT) expect(PROFILE_STYLES).not.toContain(rule);
    expect(PROFILE_STYLES).not.toContain("data-strike");
  });
});
