import { describe, expect, it } from "vitest";
import { HOSTS, LEGAL_VERSION, PUBLISHER } from "../src/legal-facts";
import { legalDocument, renderLegalPage } from "../src/legal-page";
import { LEGAL_PAGES, marketFooter, type Lang } from "../src/market-shell";
import { parseSimulatorQuery } from "../src/simulator";
import { renderSimulatorPage } from "../src/simulator-page";
import { renderSkillIndex } from "../src/skill-index";

const BASE = "https://proofseen.com";
const LANGS: readonly Lang[] = ["fr", "en"];

const executableScripts = (html: string): number =>
  [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/type\s*=\s*["']application\/ld\+json["']/i.test(attrs ?? "")).length;

const footerLinks = (html: string, lang: Lang): boolean => LEGAL_PAGES.every((page) => html.includes(`<footer class="foot">`) && html.includes(`href="/${lang}/${page}"`));

describe("pages légales", () => {
  for (const lang of LANGS) {
    for (const page of LEGAL_PAGES) {
      it(`${lang}/${page} : HTML complet, sans JavaScript, daté, avec sommaire et liens vers les deux autres`, () => {
        const html = renderLegalPage({ baseUrl: BASE, lang, page });
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(html).toContain(`<html lang="${lang}">`);
        expect(executableScripts(html)).toBe(0);
        expect(html).toContain(`<link rel="canonical" href="${BASE}/${lang}/${page}">`);
        expect(html).not.toMatch(/noindex/);
        expect(html).toContain(LEGAL_VERSION[lang]);
        expect(html).toMatch(/<h1 class="title">[^<]+<\/h1>/);
        const doc = legalDocument(lang, page);
        for (const section of doc.sections) {
          expect(html).toContain(`href="#${section.id}"`);
          expect(html).toContain(`<section id="${section.id}">`);
        }
        for (const other of LEGAL_PAGES) expect(html).toContain(`href="/${lang}/${other}"`);
        expect(footerLinks(html, lang)).toBe(true);
      });
    }

    it(`${lang} : chaque page nomme l'éditeur (SIREN) et les hébergeurs`, () => {
      for (const page of LEGAL_PAGES) {
        const html = renderLegalPage({ baseUrl: BASE, lang, page });
        expect(html).toContain(PUBLISHER.siren);
        for (const host of HOSTS) expect(html).toContain(host.name);
      }
    });

    it(`${lang} : les conditions ne décrivent ni paiement, ni commission, ni séquestre comme actifs`, () => {
      const html = renderLegalPage({ baseUrl: BASE, lang, page: "conditions" });
      expect(html).toContain(lang === "fr" ? "Le paiement sur la plateforme n'est pas encore ouvert." : "Payment on the platform is not open yet.");
      const main = /<main[\s\S]*<\/main>/.exec(html)?.[0] ?? "";
      expect(main).not.toMatch(/\d+\s?%/);
    });
  }

  it("les mentions légales reprennent les faits de l'éditeur et des hébergeurs, sources citées", () => {
    const html = renderLegalPage({ baseUrl: BASE, lang: "fr", page: "mentions-legales" });
    for (const fact of [PUBLISHER.vat, PUBLISHER.ape, PUBLISHER.dataEmail, PUBLISHER.contactEmail, "M. Mehdi T.", "64600 Anglet", "RCS de Bayonne"]) {
      expect(html).toContain(fact);
    }
    for (const host of HOSTS) expect(html).toContain(`href="${host.source}"`);
    expect(html).not.toContain("Infomaniak");
    expect(html).not.toContain("ec.europa.eu/consumers/odr");
  });

  it("un même rendu pour chaque appel : rien ne dépend du visiteur", () => {
    expect(renderLegalPage({ baseUrl: BASE, lang: "en", page: "confidentialite" })).toBe(renderLegalPage({ baseUrl: BASE, lang: "en", page: "confidentialite" }));
  });
});

describe("pied de page des pages publiques", () => {
  it("porte les trois liens légaux dans chaque langue, sans script", () => {
    for (const lang of LANGS) {
      const footer = marketFooter(lang);
      expect(footerLinks(footer, lang)).toBe(true);
      expect(footer).not.toMatch(/<script/i);
    }
    expect(marketFooter("fr")).toContain("Conditions d&#39;utilisation");
    expect(marketFooter("en")).toContain("Terms of use");
  });

  it("figure sur les pages du hub (cadre commun et pages à squelette propre), qui restent sans JavaScript", () => {
    const pages = [
      renderSkillIndex([{ key: "rust", label: "Rust", missions: 1, profiles: 1 }], { baseUrl: BASE, lang: "fr" }),
      renderSimulatorPage({ baseUrl: BASE, lang: "en", query: parseSimulatorQuery(new URLSearchParams()) }),
    ];
    expect(footerLinks(pages[0] ?? "", "fr")).toBe(true);
    expect(footerLinks(pages[1] ?? "", "en")).toBe(true);
    for (const html of pages) expect(executableScripts(html)).toBe(0);
  });
});
