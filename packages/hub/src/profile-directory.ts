import { FAVICON } from "./pages";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { longDate, marketHeader, MENU_STYLES, type Lang } from "./market-shell";
import { profileUrl } from "./profile-page";

/*
 * Annuaire public des freelances : les profils publiés, et un formulaire de filtres (compétence, ville) envoyé en GET.
 * Sans JavaScript, chaque recherche a son adresse. Chaque carte ne porte que des faits publics — titre, ville,
 * compétences déclarées, faits vérifiés — et jamais une note, un score ou un rang.
 *
 * L'ordre est neutre et dit sur la page : du profil le plus récemment mis à jour au plus ancien (AI Act : aucun
 * classement automatique de personnes).
 */

export interface DirectoryFilters {
  readonly skill: string;
  readonly city: string;
  readonly page: number;
}

export interface DirectoryCardView {
  readonly slug: string;
  readonly reference: string;
  readonly displayName: string | null;
  readonly headline: string;
  readonly city: string;
  readonly workMode: "onsite" | "hybrid" | "remote";
  readonly skills: readonly string[];
  readonly facts: {
    readonly registryActive: boolean;
    readonly identityVerified: boolean;
    readonly vigilanceValid: boolean;
    readonly verifiedMissions: number;
    readonly payingClients: number;
  };
  readonly updatedAt: Date;
}

const MAX_TAGS = 12;

const LABELS = {
  fr: {
    title: "Freelances publiés sur Proofseen",
    lead: "Les profils que leurs titulaires ont rendus publics. Le contact passe par la plateforme.",
    order: "Ordre : du profil le plus récemment mis à jour au plus ancien. Aucun score, aucun classement de personnes.",
    skill: "Compétence",
    city: "Ville",
    search: "Filtrer",
    results: "Profils",
    empty: "Aucun profil publié ne correspond à ces filtres.",
    none: "Aucun profil n'est encore publié.",
    next: "Page suivante",
    previous: "Page précédente",
    pseudonym: (ref: string) => `Freelance ${ref}`,
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    updated: (d: string) => `Profil mis à jour le ${d}`,
    registry: "Entreprise active au répertoire officiel",
    identity: "Identité vérifiée par le prestataire de paiement",
    vigilance: "Attestation de vigilance URSSAF en cours de validité",
    missions: (n: number) => (n === 1 ? "1 mission vérifiée sur pièce" : `${n} missions vérifiées sur pièce`),
    paying: (n: number) => (n === 1 ? "Payé sur Proofseen par 1 entreprise" : `Payé sur Proofseen par ${n} entreprises différentes`),
  },
  en: {
    title: "Freelancers published on Proofseen",
    lead: "Profiles their owners made public. Contact goes through the platform.",
    order: "Order: from the most recently updated profile to the oldest. No score, no ranking of people.",
    skill: "Skill",
    city: "City",
    search: "Filter",
    results: "Profiles",
    empty: "No published profile matches these filters.",
    none: "No profile is published yet.",
    next: "Next page",
    previous: "Previous page",
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    updated: (d: string) => `Profile updated on ${d}`,
    registry: "Business active in the official company register",
    identity: "Identity verified by the payment provider",
    vigilance: "Valid URSSAF vigilance certificate",
    missions: (n: number) => (n === 1 ? "1 mission verified against a document" : `${n} missions verified against a document`),
    paying: (n: number) => (n === 1 ? "Paid on Proofseen by 1 company" : `Paid on Proofseen by ${n} different companies`),
  },
} as const;

const FORM_STYLES =
  ".filters{display:flex;flex-wrap:wrap;gap:.8rem 1.2rem;align-items:end;margin:2rem 0;padding:1rem;border:1px solid var(--line);border-radius:12px;background:var(--surface)}" +
  ".filters label{display:grid;gap:.3rem;font:500 .8rem/1.2 var(--mono);color:var(--muted)}" +
  ".filters input{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--strong);border-radius:8px;padding:.45rem .6rem}" +
  ".filters button{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:.55rem 1rem;background:var(--accent);color:var(--on-accent)}" +
  ".card .verified{list-style:none;margin:0;padding:0;display:grid;gap:.2rem;font-size:.92rem}" +
  ".card .verified li::before{content:\"✓ \";color:var(--accent)}" +
  ".pager{display:flex;justify-content:space-between;margin-top:2rem}";

export const directoryUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/freelances`;

const query = (f: DirectoryFilters, page: number): string => {
  const params = new URLSearchParams();
  if (f.skill !== "") params.set("competence", f.skill);
  if (f.city !== "") params.set("ville", f.city);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

const factLines = (c: DirectoryCardView, lang: Lang): readonly string[] => {
  const l = LABELS[lang];
  return [
    ...(c.facts.registryActive ? [l.registry] : []),
    ...(c.facts.identityVerified ? [l.identity] : []),
    ...(c.facts.vigilanceValid ? [l.vigilance] : []),
    ...(c.facts.verifiedMissions === 0 ? [] : [l.missions(c.facts.verifiedMissions)]),
    ...(c.facts.payingClients === 0 ? [] : [l.paying(c.facts.payingClients)]),
  ];
};

const card = (c: DirectoryCardView, lang: Lang): string => {
  const l = LABELS[lang];
  const facts = factLines(c, lang);
  const skills = c.skills.slice(0, MAX_TAGS);
  return (
    `<li class="card"><h3><a href="/${lang}/profils/${e(c.slug)}">${e(c.displayName ?? l.pseudonym(c.reference))}</a></h3>` +
    `<p>${e(c.headline)}</p>` +
    `<p class="when">${e(c.city)} · ${l.modes[c.workMode]}</p>` +
    (skills.length === 0 ? "" : `<ul class="tags">${skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`) +
    (facts.length === 0 ? "" : `<ul class="verified">${facts.map((f) => `<li>${e(f)}</li>`).join("")}</ul>`) +
    `<p class="when">${e(l.updated(longDate(c.updatedAt, lang)))}</p></li>`
  );
};

export const renderProfileDirectory = (
  items: readonly DirectoryCardView[],
  o: { readonly baseUrl: string; readonly lang: Lang; readonly filters: DirectoryFilters; readonly hasMore: boolean },
): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const base = o.baseUrl.replace(/\/$/, "");
  // Une page filtrée ou paginée n'est pas une page à indexer : seule la liste nue est canonique.
  const filtered = query(f, f.page) !== "";
  const pager = [
    f.page > 1 ? `<a class="crumb" href="/${o.lang}/freelances${e(query(f, f.page - 1))}">← ${l.previous}</a>` : "<span></span>",
    o.hasMore ? `<a class="crumb" href="/${o.lang}/freelances${e(query(f, f.page + 1))}">${l.next} →</a>` : "<span></span>",
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

  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    `<link rel="icon" href="${FAVICON}">`,
    `<title>${l.title} — Proofseen</title>`,
    `<meta name="description" content="${e(l.lead)}">`,
    `<link rel="canonical" href="${e(directoryUrl(base, o.lang))}">`,
    filtered ? '<meta name="robots" content="noindex, follow">' : "",
    `<link rel="alternate" hreflang="fr" href="${e(directoryUrl(base, "fr"))}">`,
    `<link rel="alternate" hreflang="en" href="${e(directoryUrl(base, "en"))}">`,
    `<style>${STYLES}${MENU_STYLES}${FORM_STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, `/${other}/freelances`, "freelancers"),
    '<main class="wrap">',
    `<h1 class="title">${l.title}</h1>`,
    `<p class="headline">${l.lead}</p>`,
    `<form class="filters" method="get" action="/${o.lang}/freelances">` +
      `<label>${l.skill}<input name="competence" value="${e(f.skill)}" maxlength="60"></label>` +
      `<label>${l.city}<input name="ville" value="${e(f.city)}" maxlength="120"></label>` +
      `<button type="submit">${l.search}</button></form>`,
    `<h2>${l.results}</h2>`,
    `<p class="muted">${l.order}</p>`,
    items.length === 0 ? `<p class="muted">${empty}</p>` : `<ul class="missions">${items.map((c) => card(c, o.lang)).join("")}</ul>`,
    `<nav class="pager">${pager}</nav>`,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
