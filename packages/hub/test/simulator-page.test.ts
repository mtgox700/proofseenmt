import { describe, expect, it } from "vitest";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";
import { parseSimulatorQuery } from "../src/simulator";
import { simulatorFaq } from "../src/simulator-facts";
import { renderSimulatorPage, simulatorUrl } from "../src/simulator-page";
import { SOURCES } from "../src/simulator-rates";

const BASE = "https://proofseen.com";
// Espaces insécables (U+00A0, U+202F) que Intl met dans les montants et les pourcentages en français.
const SPACES = new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, "g");

const page = (lang: "fr" | "en", query = ""): string => renderSimulatorPage({ baseUrl: BASE, lang, query: parseSimulatorQuery(new URLSearchParams(query)) });
const plain = (html: string): string => html.replace(SPACES, " ");

const scriptsOutsideJsonLd = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;
const ldOf = (html: string): { "@graph": { "@type": string; [key: string]: unknown }[] } =>
  JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as { "@graph": { "@type": string }[] };

describe("page du simulateur", () => {
  it("la page nue : un formulaire GET sans JavaScript, un exemple calculé, indexable", () => {
    const html = page("fr");
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).toContain('<form class="sim" method="get" action="/fr/simulateur">');
    expect(html).not.toMatch(/noindex/);
    expect(html).toContain(`<link rel="canonical" href="${BASE}/fr/simulateur">`);
    const text = plain(html);
    expect(text).toContain("Exemple : 450 € par jour, 180 jours, Micro-entreprise, profession libérale non réglementée (BNC, hors Cipav), 2 000 € de frais.");
    expect(text).toContain("48 960 €");
    expect(text).toContain("56 320 €");
  });

  it("cite chaque source, avec la date des taux", () => {
    const html = page("fr");
    expect(html).toContain("Taux en vigueur au 17 octobre 2026, sources :");
    for (const s of Object.values(SOURCES)) expect(html).toContain(`href="${s.url}"`);
    expect(plain(html)).toContain("25,6 %");
    expect(page("en")).toContain("Rates in force on 17 October 2026, sources:");
  });

  it("une simulation demandée : calculée, canonique vers la page nue, non indexée", () => {
    const html = page("fr", "tjm=600&jours=200&statut=sasu-dividendes&frais=10000");
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).toContain(`<link rel="canonical" href="${BASE}/fr/simulateur">`);
    const text = plain(html);
    expect(text).toContain("Votre simulation : 600 € par jour, 200 jours, SASU à l&#39;IS");
    expect(text).toContain("59 511 €");
    expect(html).toContain('<option value="sasu-dividendes" selected>');
  });

  it("un champ faux : signalé, rien n'est calculé, la saisie est échappée", () => {
    const html = page("fr", `tjm=${encodeURIComponent('"><script>alert(1)</script>')}&jours=200&statut=micro-bnc`);
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("rien n&#39;est calculé");
    expect(html).not.toContain("Votre simulation");
  });

  it("décrit une application web et une FAQ tirée des seuls taux et du calcul", () => {
    for (const lang of ["fr", "en"] as const) {
      const html = page(lang);
      const graph = ldOf(html)["@graph"];
      expect(graph.map((n) => n["@type"])).toEqual(["WebApplication", "FAQPage"]);
      expect(graph[0]).toMatchObject({ url: simulatorUrl(BASE, lang), dateModified: "2026-10-17", isAccessibleForFree: true });
      expect(graph[0]?.citation).toEqual(Object.values(SOURCES).map((s) => s.url));
      const faq = simulatorFaq(lang);
      expect(faq.length).toBeGreaterThanOrEqual(6);
      for (const f of faq) expect(html).toContain(f.a.replace(/'/g, "&#39;"));
      expect(JSON.stringify(graph)).not.toMatch(/\b(aggregateRating|rating|score|rank)/i);
    }
    expect(plain(simulatorFaq("fr").map((f) => f.a).join(" "))).toContain("31,4 %");
  });

  it("dit pourquoi l'EURL à l'IS n'est pas simulée, et n'en donne aucun chiffre", () => {
    const html = page("fr");
    expect(html).toContain("EURL à l&#39;IS : non simulée.");
    expect(html).not.toMatch(/value="eurl/);
  });

  it("passe marketplace-verify", async () => {
    const sitemap = `${BASE}/sitemap-pages.xml`;
    const served: Record<string, string> = { [simulatorUrl(BASE, "fr")]: page("fr"), [simulatorUrl(BASE, "en")]: page("en") };
    const html = (body: string): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader: null });
    const fetchAs: FetchAs = async (url) => {
      const body = served[url];
      if (body !== undefined) return html(body);
      if (url === `${BASE}/robots.txt`) return { status: 200, body: marketplaceRobots(BASE), contentType: "text/plain", robotsHeader: null };
      if (url === sitemap) return { status: 200, body: Object.keys(served).map((u) => `<url><loc>${u}</loc></url>`).join(""), contentType: "application/xml", robotsHeader: null };
      return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
    };
    const report = await verifyMarketplace({
      baseUrl: BASE,
      fetchAs,
      pages: [
        { url: simulatorUrl(BASE, "fr"), texts: ["Simulateur de revenu net d'un freelance", "Taux en vigueur au 17 octobre 2026, sources :"], sitemap },
        { url: simulatorUrl(BASE, "en"), texts: ["Freelance net income simulator", "Rates in force on 17 October 2026, sources:"], sitemap },
      ],
    });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
  });
});
