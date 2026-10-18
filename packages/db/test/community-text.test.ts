import { describe, expect, it } from "vitest";
import { POST_BODY_MAX, textProblem } from "../src/community-input";
import { containsContact } from "../src/contact-detection";

/*
 * Contournements du filtre de coordonnées trouvés par la relecture sécurité C22 (M1), rejoués : le texte d'une
 * publication est rendu en Markdown, qui décode les références de caractères et efface ses propres marques ; des
 * caractères invisibles coupent un numéro sans que le lecteur le voie.
 */

// Écrits par code : un éditeur ou un outil peut normaliser ces caractères en silence.
const between = (digits: string, mark: number): string => digits.match(/.{2}/g)?.join(String.fromCharCode(mark)) ?? digits;

describe("texte de la communauté : coordonnées déguisées pour le Markdown", () => {
  it.each([
    "ayoub&#64;societe.tn",
    "ayoub&commat;societe.fr",
    "&#48;&#54;&#49;&#50;&#51;&#52;&#53;&#54;&#55;&#56;",
    "&#x30;612345678",
  ])("refuse une référence de caractère : %s", (text) => {
    expect(textProblem(text, POST_BODY_MAX)).toBe("html");
  });

  it.each(["06\\-12\\-34\\-56\\-78", "`06` `12` `34` `56` `78`", "06~~12~~34~~56~~78", "06\\.12\\.34\\.56\\.78"])(
    "refuse un numéro coupé par des marques Markdown : %s",
    (text) => {
      expect(textProblem(text, POST_BODY_MAX)).toBe("contact");
    },
  );

  it("refuse une adresse dont le domaine est tunisien ou marocain", () => {
    expect(textProblem("écrivez à contact.societe.tn", POST_BODY_MAX)).toBe("contact");
    expect(textProblem("voir agence.ma", POST_BODY_MAX)).toBe("contact");
  });

  it("laisse passer un texte ordinaire de freelance tech", () => {
    for (const text of ["**Migration Postgres** terminée : 40 % de requêtes en moins.", "Refonte `deploy.sh` et _tests_ ~~lents~~", "Sprint 10 | 11 | 12", "AT&T et R&D"]) {
      expect(textProblem(text, POST_BODY_MAX)).toBeNull();
    }
  });
});

describe("coordonnées coupées par des caractères invisibles", () => {
  it.each([
    ["marque gauche-droite", 0x200e],
    ["trait d'union conditionnel", 0x00ad],
    ["multiplication invisible", 0x2062],
    ["graphème combinant", 0x034f],
    ["sélecteur de variante", 0xfe01],
    ["remplissage hangul", 0x3164],
  ])("lit le numéro malgré un %s", (_name, mark) => {
    expect(containsContact(between("0612345678", mark))).toBe(true);
  });
});
