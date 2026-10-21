import { avatarTone, DIRECTORY_STYLES, linksUnder, monogram, nextLinks } from "./directory-cards";
import { pageHead, withBrand } from "./head";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { longDate, marketFooter, marketHeader, money, type Lang } from "./market-shell";
import { profileUrl } from "./profile-page";
import { languageName } from "./profile-sections";

/*
 * Annuaire public des freelances : les profils publiés en cartes, et un panneau de filtres (compétences, ville, mode de
 * travail, poste, disponibilité, faits vérifiés) envoyé en GET. Sans JavaScript, chaque recherche a son adresse, et le
 * même HTML est servi à tous, robots compris. Chaque carte ne porte que des faits publics — titre, ville, TJM affiché,
 * disponibilité déclarée et sa date, compétences et langues déclarées, faits vérifiés — et jamais une note, un score ou
 * un rang. Photo et nom : profil nominatif seulement ; sinon un monogramme tiré de la référence.
 *
 * L'ordre est neutre et dit sur la page : du profil le plus récemment mis à jour au plus ancien (AI Act : aucun
 * classement automatique de personnes). Une page filtrée ou paginée n'est pas à indexer.
 */

export type DirectoryWorkMode = "onsite" | "hybrid" | "remote";

export interface DirectoryFilters {
  readonly skills: readonly string[];
  readonly city: string;
  readonly workModes: readonly DirectoryWorkMode[];
  /** Clé d'une famille de poste, ou "". */
  readonly jobTitle: string;
  readonly availableNow: boolean;
  readonly provenOnly: boolean;
  readonly verifiedMissionsOnly: boolean;
  readonly registryActiveOnly: boolean;
  readonly vigilanceValidOnly: boolean;
  readonly page: number;
}

export const NO_DIRECTORY_FILTERS: DirectoryFilters = {
  skills: [],
  city: "",
  workModes: [],
  jobTitle: "",
  availableNow: false,
  provenOnly: false,
  verifiedMissionsOnly: false,
  registryActiveOnly: false,
  vigilanceValidOnly: false,
  page: 1,
};

export interface DirectoryCardView {
  readonly slug: string;
  readonly reference: string;
  readonly displayName: string | null;
  /** Profil nominatif seulement : l'identifiant du fichier, servi par /fichiers/<id>. */
  readonly photoFileId?: string | null;
  readonly headline: string;
  readonly city: string;
  readonly workMode: DirectoryWorkMode;
  readonly dailyRateCents?: number | null;
  readonly currency?: string;
  /** « unconfirmed » : déclarée il y a plus de 30 jours sans confirmation (règle de la base, C23), jamais « disponible ». */
  readonly availability?: "available" | "available_from" | "unavailable" | "unconfirmed";
  readonly availableFrom?: Date | null;
  readonly availabilityAt?: Date;
  readonly skills: readonly string[];
  readonly languages?: readonly { readonly code: string; readonly level: string }[];
  readonly facts: {
    readonly registryActive: boolean;
    readonly identityVerified: boolean;
    readonly vigilanceValid: boolean;
    readonly verifiedMissions: number;
    readonly provenUrls?: number;
    readonly payingClients: number;
  };
  readonly updatedAt: Date;
}

export interface JobTitleOption {
  readonly key: string;
  readonly label: string;
}

const MAX_TAGS = 6;
const WORK_MODES: readonly DirectoryWorkMode[] = ["remote", "hybrid", "onsite"];

const LABELS = {
  fr: {
    title: "Freelances publiés sur Proofseen",
    lead: "Les profils que leurs titulaires ont rendus publics. Le contact passe par la plateforme.",
    order: "Ordre : du profil le plus récemment mis à jour au plus ancien. Aucun score, aucun classement de personnes.",
    filters: "Filtres",
    active: (n: number) => (n === 0 ? "aucun actif" : `${n} actif${n > 1 ? "s" : ""}`),
    skill: "Compétences",
    skillHint: "Séparées par des virgules, cinq au plus : chaque profil doit toutes les avoir.",
    city: "Ville",
    mode: "Mode de travail",
    jobTitle: "Poste",
    anyJobTitle: "Tous les postes",
    availability: "Disponibilité",
    availableNow: "Disponible maintenant (confirmé depuis 30 jours au plus)",
    facts: "Faits vérifiés",
    proven: "Adresse web prouvée",
    missionsOnly: "Mission vérifiée sur pièce",
    registryOnly: "SIRET actif au répertoire",
    vigilanceOnly: "Attestation URSSAF en cours",
    search: "Filtrer",
    reset: "Effacer les filtres",
    results: "Profils",
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
    next: "Page suivante",
    previous: "Page précédente",
    pseudonym: (ref: string) => `Freelance ${ref}`,
    photo: (name: string) => `Photo de ${name}`,
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    perDay: "/ jour",
    available: "Disponible",
    from: (d: string) => `À partir du ${d}`,
    unavailable: "Indisponible",
    unconfirmed: "Disponibilité non confirmée",
    confirmed: (d: string) => `confirmée le ${d}`,
    lastConfirmed: (d: string) => `dernière confirmation le ${d}`,
    native: "langue maternelle",
    more: (n: number) => `+${n}`,
    updated: (d: string) => `Profil mis à jour le ${d}`,
    see: "Voir le profil",
    registry: "Entreprise active au répertoire officiel",
    identity: "Identité vérifiée par le prestataire de paiement",
    vigilance: "Attestation de vigilance URSSAF en cours de validité",
    missions: (n: number) => (n === 1 ? "1 mission vérifiée sur pièce" : `${n} missions vérifiées sur pièce`),
    provenUrls: (n: number) => (n === 1 ? "1 adresse web dont la possession est prouvée" : `${n} adresses web dont la possession est prouvée`),
    paying: (n: number) => (n === 1 ? "Payé sur Proofseen par 1 entreprise" : `Payé sur Proofseen par ${n} entreprises différentes`),
  },
  en: {
    title: "Freelancers published on Proofseen",
    lead: "Profiles their owners made public. Contact goes through the platform.",
    order: "Order: from the most recently updated profile to the oldest. No score, no ranking of people.",
    filters: "Filters",
    active: (n: number) => (n === 0 ? "none active" : `${n} active`),
    skill: "Skills",
    skillHint: "Comma-separated, five at most: every profile must have them all.",
    city: "City",
    mode: "Work mode",
    jobTitle: "Job title",
    anyJobTitle: "All job titles",
    availability: "Availability",
    availableNow: "Available now (confirmed within the last 30 days)",
    facts: "Verified facts",
    proven: "Proven web address",
    missionsOnly: "Mission verified against a document",
    registryOnly: "Active SIRET in the register",
    vigilanceOnly: "Valid URSSAF certificate",
    search: "Filter",
    reset: "Clear filters",
    results: "Profiles",
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
    next: "Next page",
    previous: "Previous page",
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    photo: (name: string) => `Photo of ${name}`,
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    perDay: "/ day",
    available: "Available",
    from: (d: string) => `From ${d}`,
    unavailable: "Unavailable",
    unconfirmed: "Availability not confirmed",
    confirmed: (d: string) => `confirmed on ${d}`,
    lastConfirmed: (d: string) => `last confirmed on ${d}`,
    native: "native",
    more: (n: number) => `+${n}`,
    updated: (d: string) => `Profile updated on ${d}`,
    see: "See the profile",
    registry: "Business active in the official company register",
    identity: "Identity verified by the payment provider",
    vigilance: "Valid URSSAF vigilance certificate",
    missions: (n: number) => (n === 1 ? "1 mission verified against a document" : `${n} missions verified against a document`),
    provenUrls: (n: number) => (n === 1 ? "1 web address with proven ownership" : `${n} web addresses with proven ownership`),
    paying: (n: number) => (n === 1 ? "Paid on Proofseen by 1 company" : `Paid on Proofseen by ${n} different companies`),
  },
} as const;

export const directoryUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/freelances`;

/** Les paramètres d'adresse d'une recherche ; les valeurs par défaut sont omises, pour des adresses courtes. */
export const directoryQueryString = (f: DirectoryFilters, page: number): string => {
  const params = new URLSearchParams();
  if (f.skills.length > 0) params.set("competence", f.skills.join(", "));
  if (f.city !== "") params.set("ville", f.city);
  for (const mode of f.workModes) params.append("mode", mode);
  if (f.jobTitle !== "") params.set("poste", f.jobTitle);
  if (f.availableNow) params.set("disponible", "1");
  if (f.provenOnly) params.set("adresse", "1");
  if (f.verifiedMissionsOnly) params.set("missions", "1");
  if (f.registryActiveOnly) params.set("siret", "1");
  if (f.vigilanceValidOnly) params.set("urssaf", "1");
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

const activeCount = (f: DirectoryFilters): number =>
  (f.skills.length > 0 ? 1 : 0) + (f.city === "" ? 0 : 1) + (f.workModes.length > 0 ? 1 : 0) + (f.jobTitle === "" ? 0 : 1) +
  [f.availableNow, f.provenOnly, f.verifiedMissionsOnly, f.registryActiveOnly, f.vigilanceValidOnly].filter(Boolean).length;

const factLines = (c: DirectoryCardView, lang: Lang): readonly string[] => {
  const l = LABELS[lang];
  const proven = c.facts.provenUrls ?? 0;
  return [
    ...(c.facts.registryActive ? [l.registry] : []),
    ...(c.facts.identityVerified ? [l.identity] : []),
    ...(c.facts.vigilanceValid ? [l.vigilance] : []),
    ...(c.facts.verifiedMissions === 0 ? [] : [l.missions(c.facts.verifiedMissions)]),
    ...(proven === 0 ? [] : [l.provenUrls(proven)]),
    ...(c.facts.payingClients === 0 ? [] : [l.paying(c.facts.payingClients)]),
  ];
};

const avatar = (c: DirectoryCardView, lang: Lang): string =>
  c.displayName !== null && c.photoFileId !== undefined && c.photoFileId !== null
    ? `<img class="avatar" src="/fichiers/${e(encodeURIComponent(c.photoFileId))}" width="56" height="56" alt="${e(LABELS[lang].photo(c.displayName))}" loading="lazy" decoding="async">`
    : `<span class="avatar tone-${avatarTone(c.reference)}" aria-hidden="true">${e(monogram(c.reference, c.displayName))}</span>`;

const availabilityBadge = (c: DirectoryCardView, lang: Lang): string => {
  const l = LABELS[lang];
  if (c.availability === undefined) return "";
  const unconfirmed = c.availability === "unconfirmed";
  const text = unconfirmed
    ? l.unconfirmed
    : c.availability === "available"
      ? l.available
      : c.availability === "available_from" && c.availableFrom != null
        ? l.from(longDate(c.availableFrom, lang))
        : l.unavailable;
  const tone = c.availability === "available" ? "now" : c.availability === "available_from" ? "later" : "off";
  const when = c.availabilityAt === undefined ? null : longDate(c.availabilityAt, lang);
  const confirmed = when === null ? "" : ` <span class="pc-ref">${e(unconfirmed ? l.lastConfirmed(when) : l.confirmed(when))}</span>`;
  return `<p class="avail"><span class="badge ${tone}"><i aria-hidden="true"></i>${e(text)}</span>${confirmed}</p>`;
};

const levelText = (level: string, lang: Lang): string => (level === "native" ? LABELS[lang].native : level.toUpperCase());

const card = (c: DirectoryCardView, lang: Lang): string => {
  const l = LABELS[lang];
  const facts = factLines(c, lang);
  const skills = c.skills.slice(0, MAX_TAGS);
  const hidden = c.skills.length - skills.length;
  const name = c.displayName ?? l.pseudonym(c.reference);
  const href = `/${lang}/profils/${e(c.slug)}`;
  const rate = c.dailyRateCents == null ? "" : `<span><b>${e(money(c.dailyRateCents, c.currency ?? "EUR", lang))}</b> ${l.perDay}</span>`;
  const languages = (c.languages ?? []).map((x) => `${languageName(x.code, lang)} (${levelText(x.level, lang)})`);
  return (
    `<li><article class="pcard" aria-labelledby="p-${e(c.slug)}">` +
    `<div class="pc-head">${avatar(c, lang)}<div><h3 class="pc-name" id="p-${e(c.slug)}"><a href="${href}">${e(name)}</a></h3>` +
    `<p class="pc-ref">${e(c.reference)}</p></div></div>` +
    availabilityBadge(c, lang) +
    `<p class="pc-headline">${e(c.headline)}</p>` +
    `<p class="pc-meta"><span>${e(c.city)} · ${l.modes[c.workMode]}</span>${rate}</p>` +
    (skills.length === 0 ? "" : `<ul class="tags">${skills.map((s) => `<li>${e(s)}</li>`).join("")}${hidden > 0 ? `<li class="plus">${l.more(hidden)}</li>` : ""}</ul>`) +
    (facts.length === 0 ? "" : `<ul class="verified">${facts.map((f) => `<li>${e(f)}</li>`).join("")}</ul>`) +
    (languages.length === 0 ? "" : `<p class="pc-meta">${e(languages.join(" · "))}</p>`) +
    `<p class="pc-foot"><span>${e(l.updated(longDate(c.updatedAt, lang)))}</span><a class="go" href="${href}" aria-hidden="true" tabindex="-1">${l.see} →</a></p>` +
    `</article></li>`
  );
};

const check = (name: string, label: string, checked: boolean, value = "1"): string =>
  `<label class="check"><input type="checkbox" name="${name}" value="${value}"${checked ? " checked" : ""}>${label}</label>`;

const filtersForm = (lang: Lang, f: DirectoryFilters, jobTitles: readonly JobTitleOption[]): string => {
  const l = LABELS[lang];
  const active = activeCount(f);
  return (
    `<details class="drawer"><summary><span>${l.filters} <span class="muted">· ${l.active(active)}</span></span></summary>` +
    `<form class="facets" method="get" action="/${lang}/freelances">` +
    `<label><span class="lbl">${l.skill}</span><input type="search" name="competence" value="${e(f.skills.join(", "))}" maxlength="320" aria-describedby="dir-skill-hint"></label>` +
    `<p id="dir-skill-hint" class="hint">${l.skillHint}</p>` +
    `<label><span class="lbl">${l.city}</span><input type="search" name="ville" value="${e(f.city)}" maxlength="120" autocomplete="address-level2"></label>` +
    `<fieldset><legend>${l.mode}</legend>${WORK_MODES.map((m) => check("mode", l.modes[m], f.workModes.includes(m), m)).join("")}</fieldset>` +
    (jobTitles.length === 0
      ? ""
      : `<label><span class="lbl">${l.jobTitle}</span><select name="poste"><option value="">${l.anyJobTitle}</option>` +
        jobTitles.map((t) => `<option value="${e(t.key)}"${t.key === f.jobTitle ? " selected" : ""}>${e(t.label)}</option>`).join("") +
        `</select></label>`) +
    `<fieldset><legend>${l.availability}</legend>${check("disponible", l.availableNow, f.availableNow)}</fieldset>` +
    `<fieldset><legend>${l.facts}</legend>${check("adresse", l.proven, f.provenOnly)}${check("missions", l.missionsOnly, f.verifiedMissionsOnly)}${check("siret", l.registryOnly, f.registryActiveOnly)}${check("urssaf", l.vigilanceOnly, f.vigilanceValidOnly)}</fieldset>` +
    `<button class="btn btn-primary" type="submit">${l.search}</button>` +
    (active === 0 ? "" : `<a class="reset" href="/${lang}/freelances">${l.reset}</a>`) +
    `</form></details>`
  );
};

export const renderProfileDirectory = (
  items: readonly DirectoryCardView[],
  o: { readonly baseUrl: string; readonly lang: Lang; readonly filters: DirectoryFilters; readonly hasMore: boolean; readonly jobTitles?: readonly JobTitleOption[] },
): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const base = o.baseUrl.replace(/\/$/, "");
  // Une page filtrée ou paginée n'est pas une page à indexer : seule la liste nue est canonique.
  const filtered = directoryQueryString(f, f.page) !== "";
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
  const empty = filtered ? l.empty : l.none;
  const next = linksUnder(o.lang, filtered ? l.nextFiltered : l.nextNone);

  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: withBrand(l.title), description: l.lead, canonical: directoryUrl(base, o.lang) }),
    filtered ? '<meta name="robots" content="noindex, follow">' : "",
    `<link rel="alternate" hreflang="fr" href="${e(directoryUrl(base, "fr"))}">`,
    `<link rel="alternate" hreflang="en" href="${e(directoryUrl(base, "en"))}">`,
    `<style>${STYLES}${DIRECTORY_STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, `/${other}/freelances`, "freelancers"),
    '<main id="contenu" class="wrap wide">',
    `<h1 class="title">${l.title}</h1>`,
    `<p class="headline">${l.lead}</p>`,
    '<div class="dir">',
    filtersForm(o.lang, f, o.jobTitles ?? []),
    "<section>",
    `<div class="res-head"><h2>${l.results}</h2><p class="muted">${l.order}</p></div>`,
    items.length === 0 ? `<p class="muted">${empty}</p>${nextLinks(l.nextTitle, next)}` : `<ul class="grid">${items.map((c) => card(c, o.lang)).join("")}</ul>`,
    `<nav class="pager">${pager}</nav>`,
    "</section>",
    "</div>",
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
