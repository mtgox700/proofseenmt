import { describe, expect, it } from "vitest";
import { containsContact } from "../src/contact-detection";

/*
 * Contournements trouvés par la red team du sprint C6 (2026-10-06), rejoués. Les faux positifs listés à côté sont des
 * phrases ordinaires d'une mission tech : les signaler pousserait les gens à se méfier de l'outil, pas des fraudeurs.
 */

describe("repérage des coordonnées : contournements de la red team C6", () => {
  it.each([
    "jean@outlook dot fr",
    "06_12_34_56_78",
    "06    12 34 56 78",
    "O6 I2 34 56 78",
    "o6.l2.34.56.78",
    "cutt.ly/x",
    "linktr.ee/x",
    "is.gd/abc",
    "on passe sur whats app ?",
    "signal : jean.42",
    "06|12|34|56|78",
  ])("repère « %s »", (text) => {
    expect(containsContact(text)).toBe(true);
  });

  it.each([
    "le script deploy.sh tourne en CI",
    "Python 3.12, Go 1.22 et Node 22, livraison en 2026",
    "Lille, 2 jours sur site, TJM 650 €",
    "IO et réseau : 3 ans d'expérience",
    "un signal fort côté produit",
    "Vue 3 / Nuxt 3, 6 mois, démarrage le 12/11/2026",
  ])("laisse passer « %s »", (text) => {
    expect(containsContact(text)).toBe(false);
  });

  it.each(["O".repeat(10_000), "1_".repeat(5000), "@a dot ".repeat(1500), "l1".repeat(5000)])("reste rapide sur un texte piégé", (text) => {
    const timings = Array.from({ length: 5 }, () => {
      const started = performance.now();
      containsContact(text);
      return performance.now() - started;
    });
    expect(Math.min(...timings)).toBeLessThan(150);
  });
});
