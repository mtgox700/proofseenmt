import { PROFILE_CARD_CSS } from "@proofseen/brand";
import { describe, expect, it } from "vitest";
import { passageName, profileCardBody, profileCardFields, type ProfileCardView } from "../src/profile-card";
import { NO_DIRECTORY_FILTERS, renderProfileDirectory, type DirectoryCardView, type DirectoryFilters } from "../src/profile-directory";
import { FILTER_STYLES } from "../src/profile-directory-filters";
import { renderProfilePage, type PublicProfile } from "../src/profile-page";

/*
 * Lot c de la refonte : une seule carte de profil, sa légende, le vert réservé au vérifié, les filtres retirables en
 * GET, des états vides honnêtes et le passage au guichet (la carte devient l'en-tête du profil, CSS seul).
 */

const BASE = "https://proofseen.com";
const NO_FACTS = { registryActive: false, identityVerified: false, vigilanceValid: false, verifiedMissions: 0, provenUrls: 0, payingClients: 0 };

const BARE: DirectoryCardView = {
  slug: "fr-rvvua",
  reference: "FR-RVVUA",
  displayName: null,
  photoFileId: null,
  headline: "Développeur full stack",
  city: "Paris",
  workMode: "remote",
  dailyRateCents: null,
  availability: "available",
  availableFrom: null,
  availabilityAt: new Date("2026-10-18T08:00:00Z"),
  skills: ["TypeScript", "React"],
  facts: NO_FACTS,
  updatedAt: new Date("2026-10-20T08:00:00Z"),
};

const PROVEN: DirectoryCardView = {
  ...BARE,
  slug: "fr-abcde",
  reference: "FR-ABCDE",
  dailyRateCents: 65_000,
  currency: "EUR",
  hasPortfolio: true,
  facts: { registryActive: true, identityVerified: false, vigilanceValid: true, verifiedMissions: 2, provenUrls: 1, payingClients: 0 },
};

const directory = (items: readonly DirectoryCardView[], filters: DirectoryFilters = NO_DIRECTORY_FILTERS, hasMore = false, lang: "fr" | "en" = "fr"): string =>
  renderProfileDirectory(items, { baseUrl: BASE, lang, filters, hasMore, jobTitles: [{ key: "data-engineer", label: "Data engineer" }] });

const styleOf = (html: string): string => /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
const cards = (html: string): string[] => [...html.matchAll(/<article class="fiche-card"[\s\S]*?<\/article>/g)].map((m) => m[0]);

/** Les règles CSS de premier niveau (un bloc @media compte pour une règle), pour lire leurs sélecteurs. */
const rules = (css: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        out.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  return out;
};

describe("une seule carte de profil", () => {
  it("se lit de haut en bas : trace, identité, contexte, disponibilité datée, registre, déclaré", () => {
    const [card] = cards(directory([PROVEN]));
    const order = ["fc-trace", "fc-name", "fc-role", "fc-ctx", "fc-avail", "fc-proof", "fc-tags", "fc-foot"].map((cls) => card?.indexOf(`class="${cls}`) ?? -1);
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(card).toContain("Profil FR-ABCDE · mis à jour le 20 octobre 2026");
    // Intl sépare le montant de sa devise par une espace fine insécable.
    expect(card).toMatch(/<b>650\s€<\/b> \/ jour/u);
    expect(card).toContain("Disponible</span> <span>· confirmée le 18 octobre 2026</span>");
    expect(card).toContain("Réalisations présentées sur le profil");
  });

  it("n'affiche le TJM que s'il est public, et jamais de photo pour un pseudonyme", () => {
    const [card] = cards(directory([{ ...BARE, photoFileId: "aaaaaaaa-0000-4000-8000-000000000000" }]));
    expect(card).not.toContain("/ jour");
    expect(card).not.toContain("<img");
    expect(card).toContain('<span class="fc-avatar" aria-hidden="true">RV</span>');
    expect(profileCardFields({ ...BARE, photoFileId: "x" }, "fr").photo).toBeNull();
  });

  it("nomme et compte chaque fait vérifié, et dit calmement quand il n'y en a aucun", () => {
    const [proven, bare] = cards(directory([PROVEN, BARE]));
    expect(proven).toContain(
      '<ul class="fc-proof"><li>2 missions vérifiées</li><li>1 adresse web dont la possession est prouvée</li><li>Entreprise active au répertoire officiel</li><li>Attestation de vigilance URSSAF en cours de validité</li></ul>',
    );
    expect(proven).not.toContain("fc-none");
    expect(bare).toContain('<p class="fc-none">Pas encore de fait vérifié.</p>');
    expect(bare).not.toContain("fc-proof");
  });

  it("ne porte ni score, ni note, ni rang", () => {
    for (const card of cards(directory([PROVEN, BARE]))) expect(card).not.toMatch(/score|rang\b|rank|note|\/ 5|%|★|top/i);
  });

  it("garde un seul arrêt de tabulation par carte, et sa cible couvre la carte", () => {
    const [card] = cards(directory([PROVEN]));
    expect(card?.match(/<a\b/g)?.length).toBe(2);
    expect(card).toContain('aria-hidden="true" tabindex="-1">Voir le profil →</a>');
    expect(PROFILE_CARD_CSS).toContain(".fc-name a::after{content:\"\";position:absolute;inset:0");
  });

  it("donne le même corps de carte, champ pour champ, à qui l'insère ailleurs (recherche connectée)", () => {
    const view: ProfileCardView = { ...PROVEN, slug: null };
    const body = profileCardBody(view, "en", "card-1");
    expect(body).toContain('<h3 class="fc-name" id="card-1">Freelancer FR-ABCDE</h3>');
    expect(body).toContain("2 verified missions");
    expect(body).not.toContain("<article");
  });
});

describe("la légende et la règle du vert", () => {
  it("met la légende du registre sous le chapeau, une fois, dans les deux langues", () => {
    const fr = directory([PROVEN, BARE]);
    expect(fr).toContain('<ul class="ps-legend" aria-label="Légende des cartes"><li class="k-proof">vérifié par un tiers</li><li class="k-decl">déclaré par le freelance</li></ul>');
    expect(fr.match(/class="ps-legend"/g)?.length).toBe(1);
    expect(fr.indexOf('class="headline"')).toBeLessThan(fr.indexOf('class="ps-legend"'));
    expect(directory([PROVEN], NO_DIRECTORY_FILTERS, false, "en")).toContain('<li class="k-proof">verified by a third party</li>');
  });

  it("n'affiche pas de clé verte sans carte verte, ni de légende sur une liste vide (revue Kensa, M5)", () => {
    const bare = directory([BARE]);
    expect(bare).toContain('<ul class="ps-legend" aria-label="Légende des cartes"><li class="k-decl">déclaré par le freelance</li></ul>');
    expect(bare).not.toContain('<li class="k-proof">');
    expect(directory([], NO_DIRECTORY_FILTERS, false, "en")).not.toContain('<ul class="ps-legend"');
  });

  it("ne pose le vert que sur un fait vérifié et sur sa clé de légende", () => {
    const green = rules(PROFILE_CARD_CSS).filter((r) => r.includes("--ps-proof"));
    expect(green).toEqual([".ps-legend .k-proof::before,.fc-proof li::before{background:var(--ps-proof)}"]);
    expect(FILTER_STYLES).not.toContain("--ps-proof");
    // La page de l'annuaire n'ajoute aucun vert à la marque et à la carte.
    const page = styleOf(directory([PROVEN]));
    const own = page.slice(page.indexOf(PROFILE_CARD_CSS) + PROFILE_CARD_CSS.length);
    expect(own).not.toContain("--ps-proof");
  });

  it("ne cache rien, ne tape aucune couleur, et réserve le survol aux pointeurs qui survolent", () => {
    // Le triangle du panneau de filtres est la seule chose masquée (Safari le dessine seul) : ce n'est pas du texte.
    const page = styleOf(directory([PROVEN])).replace(/[.>\w]*::-webkit-details-marker\{display:none\}/g, "");
    for (const css of [PROFILE_CARD_CSS, FILTER_STYLES, page]) {
      expect(css).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
      const outside = css.replace(/@media \(hover:hover\) and \(pointer:fine\)\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "");
      expect(outside).not.toContain(":hover");
    }
    expect(PROFILE_CARD_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});

describe("les filtres, en GET et retirables", () => {
  const filters: DirectoryFilters = { ...NO_DIRECTORY_FILTERS, skills: ["Rust", "Go"], city: "Lyon", workModes: ["remote"], jobTitle: "data-engineer", verifiedMissionsOnly: true, page: 2 };

  it("envoie le formulaire en GET, sans script, l'intention d'abord puis les faits vérifiés", () => {
    const html = directory([PROVEN], filters);
    expect(html).toContain('<form class="facets" method="get" action="/fr/freelances">');
    const at = (s: string): number => html.indexOf(s);
    expect(at('name="competence"')).toBeLessThan(at('name="ville"'));
    expect(at('name="ville"')).toBeLessThan(at('class="fg-facts"'));
    expect(at('class="fg-facts"')).toBeLessThan(at('name="mode"'));
    expect([...html.matchAll(/<script\b([^>]*)>/g)].every(([, attrs]) => attrs?.includes("application/ld+json"))).toBe(true);
  });

  it("fait de chaque filtre actif un lien vers la même recherche sans lui, en première page", () => {
    const html = directory([PROVEN], filters);
    expect(html).toContain('<a href="/fr/freelances?competence=Go&amp;ville=Lyon&amp;mode=remote&amp;poste=data-engineer&amp;missions=1" aria-label="Retirer le filtre : Compétence : Rust">Compétence\u202f: Rust <span aria-hidden="true">×</span></a>');
    expect(html).toContain('aria-label="Retirer le filtre : Ville : Lyon"');
    expect(html).toContain('aria-label="Retirer le filtre : Poste : Data engineer"');
    expect(html).toContain('href="/fr/freelances?competence=Rust%2C+Go&amp;ville=Lyon&amp;mode=remote&amp;poste=data-engineer" aria-label="Retirer le filtre : Mission vérifiée"');
    expect(html).toContain('<li><a class="clear" href="/fr/freelances">Effacer les filtres</a></li>');
    expect(directory([PROVEN])).not.toContain('class="dir-chips"');
  });

  it("donne 44 px à chaque cible des filtres", () => {
    expect(FILTER_STYLES).toContain(".dir-chips a{display:inline-flex;align-items:center;gap:var(--ps-space-2);min-height:2.75rem");
    expect(FILTER_STYLES).toContain(".facets .check{min-height:2.75rem}");
  });
});

describe("des états vides honnêtes, jamais de spécimen", () => {
  it("dit qu'aucun profil n'est publié, explique comment on arrive ici, et propose quoi faire", () => {
    const html = directory([]);
    expect(html).toContain('<p class="dir-empty">Aucun profil n\'est encore publié.</p>');
    expect(html).toContain("Comment un profil arrive ici");
    expect(html).toContain('<a href="/fr/app/profil">');
    expect(cards(html)).toEqual([]);
    expect(html).not.toMatch(/spécimen|specimen|exemple illustratif|données fictives/i);
  });

  it("garde les liens de retrait quand une recherche ne trouve rien", () => {
    const html = directory([], { ...NO_DIRECTORY_FILTERS, skills: ["Rust"] });
    expect(html).toContain("Aucun profil publié ne correspond à ces filtres.");
    expect(html).toContain('aria-label="Retirer le filtre : Compétence : Rust"');
    expect(html).toContain('<a href="/fr/missions">Voir les missions ouvertes</a>');
    expect(html).not.toContain("Comment un profil arrive ici");
  });

  it("donne le vrai compte quand il est entier, et met l'encart à côté d'une grille clairsemée", () => {
    const one = directory([BARE]);
    expect(one).toContain('<p class="res-count">1 profil publié</p>');
    expect(one).toContain('<div class="few"><ul class="grid">');
    expect(one).toContain("Ordre\u202f: du profil le plus récemment mis à jour au plus ancien. Aucun score, aucun classement de personnes.");
    expect(directory([BARE], NO_DIRECTORY_FILTERS, true)).not.toContain('class="res-count"');
    expect(directory([BARE, PROVEN, { ...BARE, slug: "fr-zzzzz", reference: "FR-ZZZZZ" }])).not.toContain('class="few"');
  });
});

describe("M3, le passage au guichet", () => {
  const profile: PublicProfile = {
    reference: "FR-ABCDE",
    slug: "fr-abcde",
    visibility: "pseudonymous",
    displayName: null,
    headline: "Développeur full stack",
    summary: "Résumé.",
    city: "Paris",
    workMode: "remote",
    availability: "available",
    availableFrom: null,
    dailyRateCents: null,
    currency: "EUR",
    skills: [],
    provenUrls: [],
    provenUrlCount: 0,
    missions: [],
    reviews: [],
    facts: { registryActive: false, registryCheckedAt: null, identityVerified: false, vigilanceValidUntil: null, payingClients: 0 } as unknown as PublicProfile["facts"],
    updatedAt: new Date("2026-10-20T08:00:00Z"),
  };

  it("donne à la carte de l'annuaire et à l'en-tête du profil le même nom de transition, unique par profil", () => {
    const dir = directory([PROVEN, BARE]);
    const page = renderProfilePage(profile, { baseUrl: BASE, lang: "fr", contactHref: "/fr/creer-un-compte" });
    expect(passageName("fr-abcde")).toBe("pf-fr-abcde");
    expect(dir).toContain('<article class="fiche-card" aria-labelledby="p-fr-abcde" style="view-transition-name:pf-fr-abcde">');
    expect(page).toContain('<header class="fiche" style="view-transition-name:pf-fr-abcde">');
    const names = [...dir.matchAll(/view-transition-name:([a-z0-9-]+)/g)].map((m) => m[1]);
    expect(new Set(names).size).toBe(names.length);
    expect(passageName('a"><b>')).toBe("pf-ab");
  });

  it("n'opère qu'en CSS, des deux côtés, et jamais en mouvement réduit", () => {
    for (const html of [directory([PROVEN]), renderProfilePage(profile, { baseUrl: BASE, lang: "fr", contactHref: "/fr/creer-un-compte" })]) {
      const css = styleOf(html);
      expect(css).toContain("@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}");
      expect(css.match(/@view-transition/g)?.length).toBe(1);
      expect(html.match(/<script\b/g)?.length).toBe(1);
    }
  });
});
