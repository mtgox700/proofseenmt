import { describe, expect, it } from "vitest";
import { containsContact, containsDirectContact } from "../src/contact-detection";

// Écrits par code : un éditeur ou un outil peut normaliser ces caractères en silence.
const arabicIndic = (digits: string): string => [...digits].map((d) => String.fromCharCode(0x660 + Number(d))).join("");
const keycaps = (digits: string): string => [...digits].map((d) => d + String.fromCharCode(0xfe0f, 0x20e3)).join(" ");

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
    "ig: jean.dev",
    "snap: jean",
    "threema: ABCD1234",
    "jean @ outlook dot fr",
    "écris-moi sur t e l e g r a m",
    "06*12*34*56*78",
    arabicIndic("0612345678"),
    keycaps("0612345678"),
  ])("repère « %s »", (text) => {
    expect(containsContact(text)).toBe(true);
  });

  it.each([
    "le script deploy.sh tourne en CI",
    "Python 3.12, Go 1.22 et Node 22, livraison en 2026",
    "Lille, 2 jours sur site, TJM 650 €",
    "IO et réseau : 3 ans d'expérience",
    "un signal fort côté produit",
    "Traitement du signal : filtrage",
    "Développeur ASP.NET, VB.NET et ML.NET",
    "temps réel avec Socket.IO",
    "Java 8, 11, 17, 21 ; Spring 5, 6 ; 2018 2019",
    "Sprint 10 | 11 | 12 | 13 | 14",
    "Vue 3 / Nuxt 3, 6 mois, démarrage le 12/11/2026",
  ])("laisse passer « %s »", (text) => {
    expect(containsContact(text)).toBe(false);
  });

  it("un nom de domaine est une raison sociale possible, une adresse e-mail non", () => {
    expect(containsDirectContact("Booking.com")).toBe(false);
    expect(containsDirectContact("ACME rh@acme.fr")).toBe(true);
    expect(containsDirectContact("Jean 06 12 34 56 78")).toBe(true);
  });

  it.each([arabicIndic("1234567890").repeat(1000), "O".repeat(10_000), "1_".repeat(5000), "@a dot ".repeat(1500), "l1".repeat(5000)])("reste rapide sur un texte piégé", (text) => {
    const timings = Array.from({ length: 5 }, () => {
      const started = performance.now();
      containsContact(text);
      return performance.now() - started;
    });
    expect(Math.min(...timings)).toBeLessThan(150);
  });
});
