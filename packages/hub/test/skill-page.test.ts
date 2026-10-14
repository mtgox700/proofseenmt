import { describe, expect, it } from "vitest";
import { MIN_STAT_SAMPLE, renderSkillPage, skillSitemap, type SkillPageView } from "../src/skill-page";

const NOW = new Date("2026-10-14T09:30:00Z");
// Espaces insécables (U+00A0, U+202F) que Intl met dans les montants en français.
const SPACES = new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, "g");

const PAGE: SkillPageView = {
  key: "rust",
  label: "Rust",
  missions: [{ id: "0199a1b2-0000-7000-8000-000000000001", title: "Firmware Rust", organisationName: "Acme", workMode: "hybrid", city: "Lyon" }],
  profiles: [
    { slug: "fr-abcde", reference: "FR-ABCDE", displayName: null, headline: "Dev Rust", city: "Lyon" },
    { slug: "fr-bcdef", reference: "FR-BCDEF", displayName: "Camille Martin", headline: "Lead Rust", city: "Paris" },
  ],
  facts: { profileCount: 2, missionCount: 1, dailyRate: null, cities: ["Lyon", "Paris"] },
  generatedAt: NOW,
};

const RATED: SkillPageView = { ...PAGE, facts: { ...PAGE.facts, profileCount: 7, dailyRate: { n: 5, minCents: 45_000, maxCents: 80_000, currency: "EUR" } } };

const ldOf = (html: string): { "@graph": { "@type": string; mainEntity: unknown }[] } =>
  JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as { "@graph": { "@type": string; mainEntity: unknown }[] };

const scriptsOutsideJsonLd = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;

describe("page métier", () => {
  it("liste les missions et les profils réels, sans JavaScript", () => {
    const html = renderSkillPage(PAGE, { baseUrl: "https://proofseen.com", lang: "fr" });
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).toContain("Rust : missions et freelances");
    expect(html).toContain("1 mission ouverte et 2 profils publiés sur Proofseen.");
    expect(html).toContain('href="/fr/missions/0199a1b2-0000-7000-8000-000000000001"');
    expect(html).toContain("Freelance FR-ABCDE");
    expect(html).toContain("Camille Martin");
  });

  it("écrit ses faits datés : nombres, villes, date de génération", () => {
    const html = renderSkillPage(PAGE, { baseUrl: "https://proofseen.com", lang: "fr" });
    expect(html).toContain("Au 14 octobre 2026, Proofseen compte 2 profils publiés et 1 mission ouverte pour la compétence Rust.");
    expect(html).toContain("Villes représentées : Lyon, Paris.");
    expect(html).toContain('<time datetime="2026-10-14">Page générée le 14 octobre 2026');
  });

  it("ne publie aucune fourchette de TJM sous cinq valeurs, même si on la lui passe", () => {
    const under: SkillPageView = { ...PAGE, facts: { ...PAGE.facts, dailyRate: { n: MIN_STAT_SAMPLE - 1, minCents: 40_000, maxCents: 90_000, currency: "EUR" } } };
    for (const view of [PAGE, under]) {
      const html = renderSkillPage(view, { baseUrl: "https://proofseen.com", lang: "fr" });
      expect(html).not.toMatch(/TJM/);
      expect(JSON.stringify(ldOf(html))).not.toMatch(/TJM|n = /);
    }
  });

  it("donne la fourchette de TJM avec son n dès cinq valeurs", () => {
    const fr = renderSkillPage(RATED, { baseUrl: "https://proofseen.com", lang: "fr" }).replace(SPACES, " ");
    expect(fr).toContain("Les TJM affichés par ces profils vont de 450 € à 800 € par jour (n = 5 profils qui affichent leur TJM).");
    const en = renderSkillPage(RATED, { baseUrl: "https://proofseen.com", lang: "en" });
    expect(en).toContain("(n = 5 profiles showing their rate)");
  });

  it("décrit une collection d'adresses et une FAQ construite sur les seuls faits, sans aucune note", () => {
    const html = renderSkillPage(RATED, { baseUrl: "https://proofseen.com", lang: "en" });
    const graph = ldOf(html)["@graph"];
    expect(graph.map((n) => n["@type"])).toEqual(["CollectionPage", "FAQPage"]);
    expect(graph[0]).toMatchObject({ mainEntity: { numberOfItems: 3 }, dateModified: "2026-10-14" });
    const faq = graph[1]?.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(faq.map((q) => q.name)).toEqual([
      "How many Rust freelancers are published on Proofseen?",
      "How many Rust missions are open on Proofseen?",
      "What day rate do Rust freelancers show on Proofseen?",
      "In which cities are the Rust freelancers and missions?",
    ]);
    expect(faq[0]?.acceptedAnswer.text).toBe("7 published profiles on 14 October 2026.");
    expect(JSON.stringify(graph)).not.toMatch(/rating|score|rank/i);
    // Chaque réponse de la FAQ figure aussi en clair dans la page.
    for (const q of faq) expect(html).toContain(q.acceptedAnswer.text.replace(/'/g, "&#39;"));
  });

  it("borne la liste des villes", () => {
    const cities = Array.from({ length: 15 }, (_, i) => `Ville ${String(i + 1).padStart(2, "0")}`);
    const html = renderSkillPage({ ...PAGE, facts: { ...PAGE.facts, cities } }, { baseUrl: "https://proofseen.com", lang: "fr" });
    expect(html).toContain("Ville 12 et 3 autres.");
    expect(html).not.toContain("Ville 13");
  });

  it("porte le menu public et le lien vers l'autre langue", () => {
    const html = renderSkillPage(PAGE, { baseUrl: "https://proofseen.com", lang: "fr" });
    expect(html).toContain('<a href="/fr/freelances">Freelances</a>');
    expect(html).toContain('<a href="/fr/metiers">Métiers</a>');
    expect(html).toContain('href="https://proofseen.com/en/metiers/rust" hreflang="en"');
  });

  it("entre dans le sitemap dans les deux langues", () => {
    expect(skillSitemap("https://proofseen.com", [{ key: "c++" }])).toContain("<loc>https://proofseen.com/en/metiers/c%2B%2B</loc>");
  });
});
