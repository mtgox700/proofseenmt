import { PROFILE_CARD_CSS } from "@proofseen/brand";
import { DIRECTORY_FRAME_STYLES, linksUnder, nextLinks } from "./directory-cards";
import { pageHead, withBrand } from "./head";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { marketFooter, marketHeader, type Lang } from "./market-shell";
import { anyVerifiedCard, PASSAGE_CSS, profileCardHtml, profileCardLegend, type ProfileCardView } from "./profile-card";
import { activeFilters, directoryQueryString, FILTER_STYLES, filtersForm, type DirectoryFilters, type JobTitleOption } from "./profile-directory-filters";
import { profileUrl } from "./profile-page";

/*
 * Annuaire public des freelances, le registre public (lot c, STORYBOARD c.1 à c.6) : la légende du registre, les
 * profils publiés en cartes (une seule définition, `profile-card.ts`), et un panneau de filtres envoyé en GET, avec la
 * ligne des filtres actifs, chacun retirable par un lien. Sans JavaScript, chaque recherche a son adresse, et le même
 * HTML est servi à tous, robots compris. Jamais un spécimen : on ne montre pas une fausse personne là où l'on en cherche.
 *
 * L'ordre est neutre et dit sur la page : du profil le plus récemment mis à jour au plus ancien (AI Act : aucun
 * classement automatique de personnes). Une page filtrée ou paginée n'est pas à indexer. Un clic sur une carte ouvre
 * le profil ; là où le navigateur sait le faire, la carte devient l'en-tête du dossier (M3, CSS seul).
 */

export { directoryQueryString, NO_DIRECTORY_FILTERS, type DirectoryFilters, type DirectoryWorkMode, type JobTitleOption } from "./profile-directory-filters";

/** Une carte de l'annuaire : un profil publié, donc avec son adresse, son métier et sa ville. */
export type DirectoryCardView = ProfileCardView & { readonly slug: string; readonly headline: string; readonly city: string };

const LABELS = {
  fr: {
    title: "Freelances publiés sur Proofseen",
    lead: "Les profils que leurs titulaires ont rendus publics. Le contact passe par la plateforme.",
    order: "Ordre : du profil le plus récemment mis à jour au plus ancien. Aucun score, aucun classement de personnes.",
    results: "Profils",
    published: (n: number) => (n === 1 ? "1 profil publié" : `${n} profils publiés`),
    matching: (n: number) => (n === 1 ? "1 profil correspond" : `${n} profils correspondent`),
    empty: "Aucun profil publié ne correspond à ces filtres.",
    none: "Aucun profil n'est encore publié.",
    nextTitle: "Que faire maintenant",
    nextNone: [
      ["Vous êtes freelance : publiez votre profil", "app/profil"],
      ["Vous recrutez : publiez une mission", "app/missions/nouvelle"],
      ["Pas encore de compte : en créer un", "creer-un-compte"],
    ],
    nextFiltered: [
      ["Retirer les filtres", "freelances"],
      ["Voir les missions ouvertes", "missions"],
    ],
    how: "Comment un profil arrive ici",
    howSteps: [
      "Le freelance publie son profil : ce qu'il écrit reste marqué comme déclaré.",
      "Ses pièces sont vérifiées une à une par un tiers, puis datées.",
      "L'ordre est la date de mise à jour du profil, jamais un score.",
    ],
    next: "Page suivante",
    previous: "Page précédente",
    pages: "Pages de résultats",
  },
  en: {
    title: "Freelancers published on Proofseen",
    lead: "Profiles their owners made public. Contact goes through the platform.",
    order: "Order: from the most recently updated profile to the oldest. No score, no ranking of people.",
    results: "Profiles",
    published: (n: number) => (n === 1 ? "1 published profile" : `${n} published profiles`),
    matching: (n: number) => (n === 1 ? "1 profile matches" : `${n} profiles match`),
    empty: "No published profile matches these filters.",
    none: "No profile is published yet.",
    nextTitle: "What to do now",
    nextNone: [
      ["Freelancer: publish your profile", "app/profil"],
      ["Hiring: post a mission", "app/missions/nouvelle"],
      ["No account yet: create one", "creer-un-compte"],
    ],
    nextFiltered: [
      ["Clear the filters", "freelances"],
      ["See open missions", "missions"],
    ],
    how: "How a profile gets here",
    howSteps: [
      "The freelancer publishes a profile: what they write stays marked as declared.",
      "Their documents are verified one by one by a third party, then dated.",
      "The order is the date the profile was updated, never a score.",
    ],
    next: "Next page",
    previous: "Previous page",
    pages: "Result pages",
  },
} as const;

/** Une grille clairsemée (un ou deux profils) garde l'encart à côté des cartes au lieu d'un grand vide. */
const FEW = 2;

export const directoryUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/freelances`;

const PAGE_STYLES = [
  ".dir-head .ps-legend{margin-top:var(--ps-space-5)}",
  ".res-head{display:grid;gap:var(--ps-space-1);margin-bottom:var(--ps-space-5)}",
  ".res-head h2{margin:0}",
  ".res-count{font:var(--ps-weight-display) var(--ps-step-2)/var(--ps-lead-2) var(--ps-font-display);letter-spacing:var(--ps-track-2)}",
  ".res-order{font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted);max-width:var(--ps-measure)}",
  ".dir-empty{margin-bottom:var(--ps-space-4);font-size:var(--ps-step-1);line-height:var(--ps-lead-1)}",
  // Un ou deux profils : les cartes s'étirent sur deux tiers, l'encart prend le dernier tiers (dessous à 375 px).
  ".few{display:grid;gap:var(--ps-space-4);align-items:start}.few>.grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,18.5rem),1fr))}",
  "@media (min-width:48rem){.few{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}}",
  ".how{margin-block:var(--ps-space-5);padding:var(--ps-space-5);border:1px dashed var(--ps-line-strong);border-radius:var(--ps-radius)}.few>.how{margin:0}",
  ".how h2{margin:0 0 var(--ps-space-3)}",
  ".how ol{margin:0;padding:0;list-style:none;counter-reset:how;display:grid;gap:var(--ps-space-3);font:var(--ps-weight-mono) var(--ps-step--2)/1.55 var(--ps-font-mono);color:var(--ps-muted)}",
  ".how li{counter-increment:how;display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--ps-space-2)}",
  ".how li::before{content:counter(how,decimal-leading-zero);color:var(--ps-text)}",
  ".next a{display:inline-flex;align-items:center;min-height:2.75rem}",
  ".pager a{display:inline-flex;align-items:center;min-height:2.75rem}",
].join("\n");

const howBox = (lang: Lang): string =>
  `<aside class="how" aria-labelledby="dir-how"><h2 id="dir-how">${LABELS[lang].how}</h2><ol>${LABELS[lang].howSteps.map((s) => `<li>${s}</li>`).join("")}</ol></aside>`;

const resultsCount = (items: number, filtered: boolean, f: DirectoryFilters, hasMore: boolean, lang: Lang): string => {
  // Le compte réel, seulement quand il est entier : première page, sans page suivante.
  if (items === 0 || f.page > 1 || hasMore) return "";
  const l = LABELS[lang];
  return `<p class="res-count">${filtered ? l.matching(items) : l.published(items)}</p>`;
};

/** `narrowed` : une recherche filtrée, ou une page au-delà de la première ; seul l'annuaire nu et vide se dit vide. */
const results = (items: readonly DirectoryCardView[], lang: Lang, narrowed: boolean, sparse: boolean): string => {
  const l = LABELS[lang];
  if (items.length === 0) {
    const next = nextLinks(l.nextTitle, linksUnder(lang, narrowed ? l.nextFiltered : l.nextNone));
    return `<p class="dir-empty">${narrowed ? l.empty : l.none}</p>${narrowed ? "" : howBox(lang)}${next}`;
  }
  const grid = `<ul class="grid">${items.map((c) => `<li>${profileCardHtml(c, lang)}</li>`).join("")}</ul>`;
  return sparse ? `<div class="few">${grid}${howBox(lang)}</div>` : grid;
};

export const renderProfileDirectory = (
  items: readonly DirectoryCardView[],
  o: { readonly baseUrl: string; readonly lang: Lang; readonly filters: DirectoryFilters; readonly hasMore: boolean; readonly jobTitles?: readonly JobTitleOption[] },
): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const jobTitles = o.jobTitles ?? [];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const base = o.baseUrl.replace(/\/$/, "");
  // Une page filtrée ou paginée n'est pas une page à indexer : seule la liste nue est canonique.
  const filtered = directoryQueryString(f, 1) !== "";
  const sparse = !filtered && f.page === 1 && !o.hasMore && items.length <= FEW;
  const pager = [
    f.page > 1 ? `<a class="crumb" href="/${o.lang}/freelances${e(directoryQueryString(f, f.page - 1))}" rel="prev">← ${l.previous}</a>` : "<span></span>",
    o.hasMore ? `<a class="crumb" href="/${o.lang}/freelances${e(directoryQueryString(f, f.page + 1))}" rel="next">${l.next} →</a>` : "<span></span>",
  ].join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: l.title,
    url: directoryUrl(base, o.lang),
    inLanguage: o.lang,
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: items.length,
      itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: profileUrl(base, o.lang, c.slug) })),
    },
  };

  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: withBrand(l.title), description: l.lead, canonical: directoryUrl(base, o.lang) }),
    filtered || f.page > 1 ? '<meta name="robots" content="noindex, follow">' : "",
    `<link rel="alternate" hreflang="fr" href="${e(directoryUrl(base, "fr"))}">`,
    `<link rel="alternate" hreflang="en" href="${e(directoryUrl(base, "en"))}">`,
    `<link rel="alternate" hreflang="x-default" href="${e(directoryUrl(base, "fr"))}">`,
    `<style>${STYLES}${DIRECTORY_FRAME_STYLES}\n${PROFILE_CARD_CSS}\n${FILTER_STYLES}\n${PAGE_STYLES}\n${PASSAGE_CSS}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, `/${other}/freelances`, "freelancers"),
    '<main id="contenu" class="wrap wide">',
    `<div class="dir-head"><h1 class="title">${l.title}</h1>`,
    `<p class="headline">${l.lead}</p>`,
    // Revue Kensa, M5 : aucune clé sur une liste vide ; le vert de la clé seulement si une carte affichée en porte.
    `${items.length === 0 ? "" : profileCardLegend(o.lang, { proof: anyVerifiedCard(items) })}</div>`,
    '<div class="dir">',
    filtersForm(o.lang, f, jobTitles),
    '<section aria-labelledby="dir-results">',
    `<div class="res-head"><h2 id="dir-results">${l.results}</h2>${resultsCount(items.length, filtered, f, o.hasMore, o.lang)}<p class="res-order">${l.order}</p></div>`,
    activeFilters(o.lang, f, jobTitles),
    results(items, o.lang, filtered || f.page > 1, sparse),
    f.page > 1 || o.hasMore ? `<nav class="pager" aria-label="${l.pages}">${pager}</nav>` : "",
    "</section>",
    "</div>",
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
