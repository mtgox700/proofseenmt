import { describe, expect, it } from "vitest";
import { notFoundPage, statusLang, unavailablePage } from "../src/status-pages";

/*
 * Revue Kensa, B2 : les routes du hub servaient une 404 brute de 147 octets (fond blanc, sans viewport, en français
 * même sous /en). La 404 du hub est maintenant une page de la marque, dans la langue de l'adresse, sans script.
 */

const BASE = "https://proofseen.com";
const text = (html: string): string => html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, "").replace(/&#39;/g, "'");

describe("the 404 of the hub", () => {
  const fr = notFoundPage("fr", { baseUrl: BASE });
  const en = notFoundPage("en", { baseUrl: BASE });

  it("is a branded document in the language of the address, with a viewport", () => {
    expect(fr).toContain('<html lang="fr">');
    expect(en).toContain('<html lang="en">');
    for (const html of [fr, en]) {
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
      expect(html).toContain('<header class="top">');
      expect(html).toContain('<footer class="foot">');
      expect(html).toContain("--ps-bg:");
      expect(html.length).toBeGreaterThan(5_000);
    }
  });

  it("says what the React 404 says, in each language, with the same ways out", () => {
    expect(text(fr)).toContain("Cette page n'existe pas.");
    expect(text(fr)).toContain("Reprendre ailleurs");
    expect(text(fr)).toContain("Aucune marque frappée ici.");
    expect(text(en)).toContain("This page does not exist.");
    expect(text(en)).toContain("Carry on from here");
    expect(text(en)).not.toContain("Cette page");
    for (const path of ["/en", "/en/missions", "/en/freelances", "/en/entreprises"]) expect(en).toContain(`<a href="${path}">`);
    expect(fr).toContain('<form class="nf-search" role="search" method="get" action="/fr/missions">');
  });

  it("asks not to be indexed and names no canonical address", () => {
    for (const html of [fr, en]) {
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).not.toContain('rel="canonical"');
      expect(html).not.toContain("og:url");
      expect(html).toContain(`<meta property="og:image" content="${BASE}/brand/og-`);
    }
  });

  it("ships no script at all, hides nothing, and carries no green", () => {
    for (const html of [fr, en]) {
      expect(html).not.toMatch(/<script\b/i);
      expect(html).not.toMatch(/\son[a-z]+=/i);
      expect(html).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])/i);
      const css = /<style>([\s\S]*)<\/style>/.exec(html)?.[1] ?? "";
      const own = css.slice(css.indexOf(".nf-code"));
      expect(own).not.toContain("--ps-proof");
      expect(html).not.toContain(String.fromCodePoint(0x2014));
    }
  });

  it("sets French punctuation with a narrow no-break space", () => {
    // The visible text only: an attribute (the share card's alt text) is left as it is.
    expect(text(notFoundPage("fr"))).not.toMatch(/ [:;?!]/);
    expect(text(unavailablePage("fr", "/fr/profils/x"))).not.toMatch(/ [:;?!]/);
  });
});

describe("the unavailable page of the hub", () => {
  it("offers to try the same address again, and never another host", () => {
    expect(unavailablePage("en", "/en/missions/abc")).toContain('<a class="btn btn-primary" href="/en/missions/abc">Try again</a>');
    expect(unavailablePage("fr", "//evil.example/x")).toContain('<a class="btn btn-primary" href="/fr">Réessayer</a>');
    expect(text(unavailablePage("fr", "/fr/x"))).toContain("Cette page n'a pas pu s'afficher.");
    expect(unavailablePage("fr", "/fr/x")).not.toMatch(/<script\b/i);
  });

  it("reads the language of an address segment, French by default", () => {
    expect(statusLang("en")).toBe("en");
    expect(statusLang("fr")).toBe("fr");
    expect(statusLang("de")).toBe("fr");
  });
});
