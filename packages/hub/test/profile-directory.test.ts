import { describe, expect, it } from "vitest";
import { renderProfileDirectory, type DirectoryCardView, type DirectoryFilters } from "../src/profile-directory";

const NO_FACTS = { registryActive: false, identityVerified: false, vigilanceValid: false, verifiedMissions: 0, payingClients: 0 };

const CARDS: readonly DirectoryCardView[] = [
  {
    slug: "fr-abcde",
    reference: "FR-ABCDE",
    displayName: null,
    headline: "Développeuse Rust embarqué",
    city: "Lyon",
    workMode: "hybrid",
    skills: ["Rust", "C"],
    facts: { registryActive: true, identityVerified: true, vigilanceValid: true, verifiedMissions: 2, payingClients: 1 },
    updatedAt: new Date("2026-10-12T08:00:00Z"),
  },
  { slug: "fr-bcdef", reference: "FR-BCDEF", displayName: "Camille Martin", headline: "Lead <Go>", city: "Paris", workMode: "remote", skills: [], facts: NO_FACTS, updatedAt: new Date("2026-10-01T08:00:00Z") },
];

const BARE: DirectoryFilters = { skill: "", city: "", page: 1 };
const render = (filters: DirectoryFilters = BARE, hasMore = false, lang: "fr" | "en" = "fr"): string =>
  renderProfileDirectory(CARDS, { baseUrl: "https://proofseen.com", lang, filters, hasMore });

const scriptsOutsideJsonLd = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;

describe("annuaire public des freelances", () => {
  it("rend les profils en HTML brut, sans JavaScript, avec leurs seuls faits publics", () => {
    const html = render();
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).toContain('<a href="/fr/profils/fr-abcde">Freelance FR-ABCDE</a>');
    expect(html).toContain("Camille Martin");
    expect(html).toContain("Développeuse Rust embarqué");
    expect(html).toContain("Lead &lt;Go&gt;");
    expect(html).toContain("Lyon · Hybride");
    expect(html).toContain("<li>Entreprise active au répertoire officiel</li>");
    expect(html).toContain("<li>2 missions vérifiées sur pièce</li>");
    expect(html).toContain("<li>Payé sur Proofseen par 1 entreprise</li>");
    expect(html).toContain("Profil mis à jour le 12 octobre 2026");
  });

  it("dit son ordre, neutre, et ne porte ni note, ni score, ni rang", () => {
    const html = render();
    expect(html).toContain("Ordre : du profil le plus récemment mis à jour au plus ancien. Aucun score, aucun classement de personnes.");
    expect(html).not.toMatch(/rating|score"|"rank|aggregateRating/i);
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as { mainEntity: { itemListOrder: string; numberOfItems: number } };
    expect(ld.mainEntity).toMatchObject({ itemListOrder: "https://schema.org/ItemListUnordered", numberOfItems: 2 });
  });

  it("se désigne elle-même, s'indexe nue, et se retire de l'index une fois filtrée", () => {
    const bare = render();
    expect(bare).toContain('<link rel="canonical" href="https://proofseen.com/fr/freelances">');
    expect(bare).toContain('<link rel="alternate" hreflang="en" href="https://proofseen.com/en/freelances">');
    expect(bare).not.toContain("noindex");
    const filtered = render({ skill: "Rust", city: "Lyon", page: 1 });
    expect(filtered).toContain('<meta name="robots" content="noindex, follow">');
    expect(filtered).toContain('name="competence" value="Rust"');
    expect(filtered).toContain('name="ville" value="Lyon"');
  });

  it("pagine par liens GET qui gardent les filtres", () => {
    const html = render({ skill: "Rust", city: "", page: 2 }, true);
    expect(html).toContain('href="/fr/freelances?competence=Rust&amp;page=3"');
    expect(html).toContain('href="/fr/freelances?competence=Rust"');
  });

  it("distingue un annuaire vide d'une recherche sans résultat", () => {
    const empty = (filters: DirectoryFilters): string => renderProfileDirectory([], { baseUrl: "https://proofseen.com", lang: "en", filters, hasMore: false });
    expect(empty(BARE)).toContain("No profile is published yet.");
    expect(empty({ skill: "Rust", city: "", page: 1 })).toContain("No published profile matches these filters.");
  });

  it("existe en anglais avec le menu public", () => {
    const html = render(BARE, false, "en");
    expect(html).toContain("Freelancers published on Proofseen");
    expect(html).toContain('<a href="/en/freelances" aria-current="page">Freelancers</a>');
    expect(html).toContain('<a href="/en/missions">Missions</a>');
    expect(html).toContain('<a href="/en/connexion">Sign in</a>');
  });
});
