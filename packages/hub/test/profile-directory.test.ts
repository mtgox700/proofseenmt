import { describe, expect, it } from "vitest";
import { avatarTone, AVATAR_TONES, monogram } from "../src/directory-cards";
import { NO_DIRECTORY_FILTERS, renderProfileDirectory, type DirectoryCardView, type DirectoryFilters } from "../src/profile-directory";

const NO_FACTS = { registryActive: false, identityVerified: false, vigilanceValid: false, verifiedMissions: 0, payingClients: 0 };

const CARDS: readonly DirectoryCardView[] = [
  {
    slug: "fr-abcde",
    reference: "FR-ABCDE",
    displayName: null,
    photoFileId: null,
    headline: "Développeuse Rust embarqué",
    city: "Lyon",
    workMode: "hybrid",
    dailyRateCents: 65_000,
    currency: "EUR",
    availability: "available",
    availableFrom: null,
    availabilityAt: new Date("2026-10-10T08:00:00Z"),
    skills: ["Rust", "C", "Linux", "Yocto", "Zephyr", "CAN", "RTOS", "Git"],
    languages: [
      { code: "en", level: "c1" },
      { code: "fr", level: "native" },
    ],
    facts: { registryActive: true, identityVerified: true, vigilanceValid: true, verifiedMissions: 2, provenUrls: 1, payingClients: 1 },
    updatedAt: new Date("2026-10-12T08:00:00Z"),
  },
  {
    slug: "fr-bcdef",
    reference: "FR-BCDEF",
    displayName: "Camille Martin",
    photoFileId: "0b5a6f8e-2c1d-4e3f-9a7b-1c2d3e4f5a6b",
    headline: "Lead <Go>",
    city: "Paris",
    workMode: "remote",
    availability: "available_from",
    availableFrom: new Date("2026-12-01T00:00:00Z"),
    skills: [],
    facts: NO_FACTS,
    updatedAt: new Date("2026-10-01T08:00:00Z"),
  },
];

const render = (filters: DirectoryFilters = NO_DIRECTORY_FILTERS, hasMore = false, lang: "fr" | "en" = "fr"): string =>
  renderProfileDirectory(CARDS, { baseUrl: "https://proofseen.com", lang, filters, hasMore, jobTitles: [{ key: "data-engineer", label: "Data engineer" }] });

const scriptsOutsideJsonLd = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;

describe("annuaire public des freelances", () => {
  it("rend les profils en cartes HTML, sans JavaScript, avec leurs seuls faits publics", () => {
    const html = render();
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).toContain('<a href="/fr/profils/fr-abcde">Freelance FR-ABCDE</a>');
    expect(html).toContain("Camille Martin");
    expect(html).toContain("Développeuse Rust embarqué");
    expect(html).toContain("Lead &lt;Go&gt;");
    expect(html).toContain("Lyon · Hybride");
    expect(html).toContain("650");
    expect(html).toContain("<li>Entreprise active au répertoire officiel</li>");
    expect(html).toContain("<li>2 missions vérifiées sur pièce</li>");
    expect(html).toContain("<li>1 adresse web dont la possession est prouvée</li>");
    expect(html).toContain("<li>Payé sur Proofseen par 1 entreprise</li>");
    // La ligne de trace, en tête de carte : la référence et la date, comme l'en-tête du profil.
    expect(html).toContain('<p class="fc-trace">Profil FR-ABCDE · mis à jour le 12 octobre 2026</p>');
    expect(html).toContain("confirmée le 10 octobre 2026");
    expect(html).toContain("À partir du 1 décembre 2026");
    expect(html).toContain("anglais (C1) · français (langue maternelle)");
    // Huit compétences : six montrées, les autres comptées.
    expect(html).toContain('<li class="plus">+2</li>');
  });

  it("montre la photo d'un profil nominatif avec ses dimensions, et un monogramme sans nom pour un pseudonyme", () => {
    const html = render();
    expect(html).toContain('<img class="fc-avatar" src="/fichiers/0b5a6f8e-2c1d-4e3f-9a7b-1c2d3e4f5a6b" width="56" height="56" alt="Photo de Camille Martin" loading="lazy" decoding="async">');
    expect(html).toContain('<span class="fc-avatar" aria-hidden="true">AB</span>');
    // Une photo sur un profil pseudonyme ne sort jamais, même si la vue en portait une par erreur.
    const leaked = renderProfileDirectory([{ ...CARDS[0], photoFileId: "aaaaaaaa-2c1d-4e3f-9a7b-1c2d3e4f5a6b" } as DirectoryCardView], { baseUrl: "https://proofseen.com", lang: "fr", filters: NO_DIRECTORY_FILTERS, hasMore: false });
    expect(leaked).not.toContain("aaaaaaaa-");
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
    expect(bare).toContain('<details class="drawer"><summary>');
    const filtered = render({ ...NO_DIRECTORY_FILTERS, skills: ["Rust"], city: "Lyon", workModes: ["remote"], jobTitle: "data-engineer", availableNow: true, verifiedMissionsOnly: true });
    expect(filtered).toContain('<meta name="robots" content="noindex, follow">');
    expect(filtered).toContain('name="competence" value="Rust"');
    expect(filtered).toContain('name="ville" value="Lyon"');
    expect(filtered).toContain('name="mode" value="remote" checked');
    expect(filtered).toContain('<option value="data-engineer" selected>Data engineer</option>');
    expect(filtered).toContain('name="disponible" value="1" checked');
    expect(filtered).toContain('name="missions" value="1" checked');
    expect(filtered).toContain('<details class="drawer">');
    expect(filtered).toContain("6 actifs");
  });

  it("pagine par liens GET qui gardent les filtres", () => {
    const html = render({ ...NO_DIRECTORY_FILTERS, skills: ["Rust"], page: 2 }, true);
    expect(html).toContain('href="/fr/freelances?competence=Rust&amp;page=3"');
    expect(html).toContain('href="/fr/freelances?competence=Rust"');
  });

  it("échappe tout ce qui vient d'un profil", () => {
    const hostile: DirectoryCardView = { ...CARDS[1], displayName: '"><script>alert(1)</script>', slug: "fr-xyzab", skills: ["<img src=x onerror=1>"] } as DirectoryCardView;
    const html = renderProfileDirectory([hostile], { baseUrl: "https://proofseen.com", lang: "fr", filters: { ...NO_DIRECTORY_FILTERS, city: '"><b>' }, hasMore: false });
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain('value="&quot;&gt;&lt;b&gt;"');
  });

  it("distingue un annuaire vide d'une recherche sans résultat", () => {
    const empty = (filters: DirectoryFilters): string => renderProfileDirectory([], { baseUrl: "https://proofseen.com", lang: "en", filters, hasMore: false });
    expect(empty(NO_DIRECTORY_FILTERS)).toContain("No profile is published yet.");
    expect(empty({ ...NO_DIRECTORY_FILTERS, skills: ["Rust"] })).toContain("No published profile matches these filters.");
  });

  it("dit quoi faire d'un annuaire vide, par de simples liens, les mêmes pour tous et sans invitation (C23)", () => {
    const empty = (filters: DirectoryFilters, lang: "fr" | "en" = "fr"): string => renderProfileDirectory([], { baseUrl: "https://proofseen.com", lang, filters, hasMore: false });
    const none = empty(NO_DIRECTORY_FILTERS);
    expect(none).toContain('<a href="/fr/app/profil">Vous êtes freelance : publiez votre profil</a>');
    expect(none).toContain('<a href="/fr/app/missions/nouvelle">Vous recrutez : publiez une mission</a>');
    expect(none).toContain('<a href="/fr/creer-un-compte">');
    expect(none).not.toContain("invitations");
    expect(scriptsOutsideJsonLd(none)).toBe(0);
    expect(empty(NO_DIRECTORY_FILTERS)).toBe(none);
    const filtered = empty({ ...NO_DIRECTORY_FILTERS, skills: ["Rust"] }, "en");
    expect(filtered).toContain('<a href="/en/freelances">Clear the filters</a>');
    // Des résultats : aucun lien « que faire maintenant ».
    expect(render()).not.toContain("Que faire maintenant");
  });

  it("dit « disponibilité non confirmée » au-delà de 30 jours, avec la date de la dernière confirmation (C23)", () => {
    const [first] = CARDS;
    if (first === undefined) throw new Error("carte absente");
    const stale: DirectoryCardView = { ...first, availability: "unconfirmed" };
    const html = renderProfileDirectory([stale], { baseUrl: "https://proofseen.com", lang: "fr", filters: NO_DIRECTORY_FILTERS, hasMore: false });
    expect(html).toContain('<span class="fc-state stale">Disponibilité non confirmée</span>');
    expect(html).toContain("dernière confirmation le 10 octobre 2026");
    expect(html).not.toMatch(/fc-state now/);
    expect(html).toContain("Développeuse Rust embarqué");
  });

  it("existe en anglais avec le menu public", () => {
    const html = render(NO_DIRECTORY_FILTERS, false, "en");
    expect(html).toContain("Freelancers published on Proofseen");
    expect(html).toContain('<a href="/en/freelances" aria-current="page">Freelancers</a>');
    expect(html).toContain('<a href="/en/entreprises">Companies</a>');
    expect(html).toContain('<a href="/en/missions">Missions</a>');
    expect(html).toContain('<a href="/en/connexion">Sign in</a>');
  });
});

describe("avatars sans photo", () => {
  it("tire les initiales d'un nom, ou les deux premiers signes d'une référence", () => {
    expect(monogram("FR-ZK7M4", null)).toBe("ZK");
    expect(monogram("FR-ZK7M4", "Camille Martin")).toBe("CM");
    expect(monogram("acme", "élodie d'Arc")).toBe("ÉD");
    expect(monogram("FR-AB2CD", "  ")).toBe("AB");
  });

  it("donne une teinte stable, tirée de la référence seule", () => {
    expect(avatarTone("FR-ZK7M4")).toBe(avatarTone("FR-ZK7M4"));
    for (const ref of ["FR-AAAAA", "FR-BBBBB", "FR-ZK7M4", "acme"]) expect(avatarTone(ref)).toBeLessThan(AVATAR_TONES);
  });
});
