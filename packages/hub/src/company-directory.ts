import { companyUrl } from "./company-page";
import { pageHead, withBrand } from "./head";
import { avatarTone, DIRECTORY_STYLES, linksUnder, monogram } from "./directory-cards";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { blankState, factLine, LEDGER_STYLES, listLegend } from "./ledger";
import { longDate, marketFooter, marketHeader, type Lang } from "./market-shell";
import { typeset } from "./typography";

/*
 * Ce que l'annuaire des entreprises ajoute aux cartes partagées avec celui des freelances (directory-cards.ts, qui
 * n'est pas modifié ici) : le registre de la carte au carré (vert pour le seul fait contrôlé), des cibles de 44 px
 * dans le panneau de filtres, et la colonne unique d'un annuaire encore vide.
 */
const COMPANY_DIRECTORY_STYLES =
  ".pcard .reg{list-style:none;margin:0;padding:0;display:grid;gap:var(--ps-space-1);font-size:var(--ps-step--1)}" +
  ".pcard .reg .vline.open{color:var(--ps-muted)}" +
  ".facets select{min-height:2.75rem}.facets .check{min-height:2.75rem}.facets .reset{display:inline-flex;align-items:center;min-height:2.75rem}" +
  ".solo{margin-top:var(--ps-space-6)}";

/*
 * Annuaire public des entreprises (C22) : celles qui ont ouvert une page publique, et seulement elles. Chaque carte porte
 * des faits — ville et type déclarés, SIRET actif au répertoire (date du contrôle), inscrite depuis, missions ouvertes,
 * délai médian de réponse avec son n — et un lien vers la page de l'entreprise. Pas de logo déposé : un monogramme.
 *
 * Filtres en GET (ville, type, « recrute en ce moment », SIRET actif), avec l'effectif de chaque option ; ordre choisi
 * et dit sur la page. Aucun JavaScript, le même HTML pour tous ; une page filtrée, triée ou paginée n'est pas à indexer.
 */

export const COMPANY_DIRECTORY_SORTS = ["name", "recent", "missions"] as const;
export type CompanyDirectorySort = (typeof COMPANY_DIRECTORY_SORTS)[number];

export const COMPANY_KINDS = ["startup", "scaleup", "grand_groupe", "eti", "pme", "secteur_public", "editeur_logiciel", "esn", "association"] as const;
export type CompanyKind = (typeof COMPANY_KINDS)[number];

export interface CompanyDirectoryFilters {
  readonly city: string;
  readonly kind: CompanyKind | "";
  readonly hiringOnly: boolean;
  readonly registryActiveOnly: boolean;
  readonly sort: CompanyDirectorySort;
  readonly page: number;
}

export const NO_COMPANY_FILTERS: CompanyDirectoryFilters = { city: "", kind: "", hiringOnly: false, registryActiveOnly: false, sort: "name", page: 1 };

export interface CompanyDirectoryCardView {
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly kind: CompanyKind;
  readonly registryActiveCheckedAt: Date | null;
  readonly memberSince: Date;
  readonly openMissions: number;
  readonly response: { readonly medianDays: number; readonly decided: number } | null;
}

export interface CompanyDirectoryFacetsView {
  readonly total: number;
  readonly cities: readonly { readonly key: string; readonly label: string; readonly count: number }[];
  readonly kinds: readonly { readonly kind: CompanyKind; readonly count: number }[];
  readonly hiring: number;
  readonly registryActive: number;
}

const KIND_LABELS: Readonly<Record<Lang, Readonly<Record<CompanyKind, string>>>> = {
  fr: { startup: "Start-up", scaleup: "Scale-up", grand_groupe: "Grand groupe", eti: "ETI", pme: "PME", secteur_public: "Secteur public", editeur_logiciel: "Éditeur de logiciel", esn: "ESN", association: "Association" },
  en: { startup: "Start-up", scaleup: "Scale-up", grand_groupe: "Large group", eti: "Mid-cap", pme: "SME", secteur_public: "Public sector", editeur_logiciel: "Software publisher", esn: "IT services firm", association: "Non-profit" },
};

const LABELS = {
  fr: {
    title: "Entreprises sur Proofseen",
    lead: "Les entreprises qui ont choisi d'avoir une page publique : leurs faits vérifiés et leurs missions ouvertes.",
    filters: "Filtres",
    city: "Ville",
    anyCity: "Toutes les villes",
    kind: "Type d'entreprise",
    anyKind: "Tous les types",
    hiring: "Recrute en ce moment (au moins une mission ouverte)",
    registry: "SIRET actif au répertoire officiel",
    sort: "Ordre",
    sorts: { name: "Nom, de A à Z", recent: "Page ouverte le plus récemment", missions: "Nombre de missions ouvertes" },
    search: "Filtrer",
    reset: "Effacer les filtres",
    results: (n: number) => `${n} entreprise${n > 1 ? "s" : ""}`,
    order: (sort: string) => `Ordre choisi : ${sort}. Des faits, jamais une note.`,
    empty: "Aucune entreprise ne correspond à ces filtres.",
    none: "Aucune entreprise n'a encore ouvert de page publique.",
    nextTitle: "Que faire maintenant",
    nextNone: [
      ["Vous recrutez : créez votre compte et ouvrez la page de votre entreprise", "creer-un-compte"],
      ["Vous êtes freelance : voir les freelances publiés", "freelances"],
    ],
    nextFiltered: [["Retirer les filtres", "entreprises"]],
    next: "Page suivante",
    previous: "Page précédente",
    registryFact: (d: string) => `Entreprise active au répertoire officiel (vérifié le ${d})`,
    registryUnknown: "Activité au répertoire officiel non confirmée",
    legendVerified: "vérifié par un tiers, daté",
    legendOpen: "mesuré sur Proofseen ou déclaré",
    emptyWhy: "D'autres entreprises ont peut-être une page publique : retirez un filtre.",
    noneWhy: "Une entreprise apparaît ici quand elle ouvre sa page publique, avec son activité au répertoire officiel, datée, et ses missions ouvertes.",
    since: (d: string) => `Inscrite sur Proofseen depuis le ${d}`,
    missions: (n: number) => (n === 0 ? "Aucune mission ouverte" : n === 1 ? "1 mission ouverte" : `${n} missions ouvertes`),
    response: (days: number, n: number) => `Répond en ${days} jour${days > 1 ? "s" : ""} (médiane, ${n} candidatures)`,
    see: "Voir la page",
  },
  en: {
    title: "Companies on Proofseen",
    lead: "Companies that chose to have a public page: their verified facts and their open missions.",
    filters: "Filters",
    city: "City",
    anyCity: "All cities",
    kind: "Company type",
    anyKind: "All types",
    hiring: "Hiring now (at least one open mission)",
    registry: "Active SIRET in the official register",
    sort: "Order",
    sorts: { name: "Name, A to Z", recent: "Page opened most recently", missions: "Number of open missions" },
    search: "Filter",
    reset: "Clear filters",
    results: (n: number) => `${n} compan${n > 1 ? "ies" : "y"}`,
    order: (sort: string) => `Chosen order: ${sort}. Facts, never a rating.`,
    empty: "No company matches these filters.",
    none: "No company has opened a public page yet.",
    nextTitle: "What to do now",
    nextNone: [
      ["Hiring: create your account and open your company page", "creer-un-compte"],
      ["Freelancer: see published freelancers", "freelances"],
    ],
    nextFiltered: [["Clear the filters", "entreprises"]],
    next: "Next page",
    previous: "Previous page",
    registryFact: (d: string) => `Business active in the official register (checked on ${d})`,
    registryUnknown: "Not confirmed as active in the official register",
    legendVerified: "verified by a third party, dated",
    legendOpen: "measured on Proofseen or stated",
    emptyWhy: "Other companies may have a public page: remove a filter.",
    noneWhy: "A company shows here when it opens its public page, with its status in the official register, dated, and its open missions.",
    since: (d: string) => `On Proofseen since ${d}`,
    missions: (n: number) => (n === 0 ? "No open mission" : n === 1 ? "1 open mission" : `${n} open missions`),
    response: (days: number, n: number) => `Answers in ${days} day${days > 1 ? "s" : ""} (median, ${n} applications)`,
    see: "See the page",
  },
} as const;

export const companyDirectoryUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/entreprises`;

export const companyDirectoryQueryString = (f: CompanyDirectoryFilters, page: number): string => {
  const params = new URLSearchParams();
  if (f.city !== "") params.set("ville", f.city);
  if (f.kind !== "") params.set("type", f.kind);
  if (f.hiringOnly) params.set("recrute", "1");
  if (f.registryActiveOnly) params.set("siret", "1");
  if (f.sort !== "name") params.set("tri", f.sort);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

const check = (name: string, label: string, checked: boolean, count: number): string =>
  `<label class="check"><input type="checkbox" name="${name}" value="1"${checked ? " checked" : ""}>${label}<span class="n">${count}</span></label>`;

const option = (value: string, label: string, selected: boolean): string => `<option value="${e(value)}"${selected ? " selected" : ""}>${e(label)}</option>`;

const filtersForm = (lang: Lang, f: CompanyDirectoryFilters, facets: CompanyDirectoryFacetsView, action: string): string => {
  const l = LABELS[lang];
  const active = (f.city === "" ? 0 : 1) + (f.kind === "" ? 0 : 1) + (f.hiringOnly ? 1 : 0) + (f.registryActiveOnly ? 1 : 0);
  const cities = facets.cities.some((c) => c.label.toLowerCase() === f.city.toLowerCase()) || f.city === "" ? facets.cities : [{ key: f.city, label: f.city, count: 0 }, ...facets.cities];
  return (
    `<details class="drawer"><summary><span>${l.filters}</span></summary>` +
    `<form class="facets" method="get" action="${e(action)}">` +
    `<label><span class="lbl">${l.city}</span><select name="ville">${option("", l.anyCity, f.city === "")}` +
    cities.map((c) => option(c.label, `${c.label} (${c.count})`, c.label.toLowerCase() === f.city.toLowerCase())).join("") +
    `</select></label>` +
    `<label><span class="lbl">${l.kind}</span><select name="type">${option("", l.anyKind, f.kind === "")}` +
    facets.kinds.map((k) => option(k.kind, `${KIND_LABELS[lang][k.kind]} (${k.count})`, k.kind === f.kind)).join("") +
    `</select></label>` +
    `<fieldset><legend>${l.filters}</legend>${check("recrute", l.hiring, f.hiringOnly, facets.hiring)}${check("siret", l.registry, f.registryActiveOnly, facets.registryActive)}</fieldset>` +
    `<label><span class="lbl">${l.sort}</span><select name="tri">${COMPANY_DIRECTORY_SORTS.map((s) => option(s, l.sorts[s], s === f.sort)).join("")}</select></label>` +
    `<button class="btn btn-primary" type="submit">${l.search}</button>` +
    (active === 0 && f.sort === "name" ? "" : `<a class="reset" href="${e(action)}">${l.reset}</a>`) +
    `</form></details>`
  );
};

/**
 * Une carte d'entreprise : ses faits et le lien vers sa page. Le carré vert ne précède que l'activité au répertoire
 * officiel, contrôlée et datée ; l'inscription et le délai de réponse sont mesurés sur Proofseen, au carré neutre.
 */
const companyCard = (c: CompanyDirectoryCardView, lang: Lang): string => {
  const l = LABELS[lang];
  const href = `/${lang}/entreprises/${e(c.slug)}`;
  const facts = [
    c.registryActiveCheckedAt === null ? factLine(l.registryUnknown, false, "li") : factLine(l.registryFact(longDate(c.registryActiveCheckedAt, lang)), true, "li"),
    factLine(l.since(longDate(c.memberSince, lang)), false, "li"),
    ...(c.response === null ? [] : [factLine(l.response(c.response.medianDays, c.response.decided), false, "li")]),
  ];
  return (
    `<li><article class="pcard" aria-labelledby="c-${e(c.slug)}">` +
    `<div class="pc-head"><span class="avatar sq tone-${avatarTone(c.slug)}" aria-hidden="true">${e(monogram(c.slug, c.name))}</span>` +
    `<div><h3 class="pc-name" id="c-${e(c.slug)}"><a href="${href}">${e(c.name)}</a></h3><p class="pc-ref">${e(KIND_LABELS[lang][c.kind])}</p></div></div>` +
    `<p class="avail"><span class="badge ${c.openMissions > 0 ? "now" : "off"}"><i aria-hidden="true"></i>${e(l.missions(c.openMissions))}</span></p>` +
    (c.city === null ? "" : `<p class="pc-meta">${e(c.city)}</p>`) +
    `<ul class="reg">${facts.join("")}</ul>` +
    `<div class="pc-foot"><span></span><a class="go" href="${href}" aria-hidden="true" tabindex="-1">${l.see} →</a></div>` +
    `</article></li>`
  );
};

export interface CompanyDirectoryOptions {
  readonly baseUrl: string;
  readonly lang: Lang;
  readonly filters: CompanyDirectoryFilters;
  readonly facets: CompanyDirectoryFacetsView;
  readonly hasMore: boolean;
}

export const renderCompanyDirectory = (items: readonly CompanyDirectoryCardView[], o: CompanyDirectoryOptions): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const base = o.baseUrl.replace(/\/$/, "");
  const path = `/${o.lang}/entreprises`;
  const filtered = companyDirectoryQueryString(f, f.page) !== "";
  const next = linksUnder(o.lang, filtered ? l.nextFiltered : l.nextNone);
  const nobody = !filtered && items.length === 0 && o.facets.total === 0;
  const pager = [
    f.page > 1 ? `<a class="crumb" href="${path}${e(companyDirectoryQueryString(f, f.page - 1))}" rel="prev">← ${l.previous}</a>` : "<span></span>",
    o.hasMore ? `<a class="crumb" href="${path}${e(companyDirectoryQueryString(f, f.page + 1))}" rel="next">${l.next} →</a>` : "<span></span>",
  ].join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: l.title,
    url: companyDirectoryUrl(base, o.lang),
    inLanguage: o.lang,
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: items.length,
      itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: companyUrl(base, o.lang, c.slug) })),
    },
  };
  return typeset(
    o.lang,
    [
      "<!doctype html>",
      `<html lang="${o.lang}">`,
      "<head>",
      ...pageHead({ lang: o.lang, title: withBrand(l.title), description: l.lead, canonical: companyDirectoryUrl(base, o.lang) }),
      filtered ? '<meta name="robots" content="noindex, follow">' : "",
      `<link rel="alternate" hreflang="fr" href="${e(companyDirectoryUrl(base, "fr"))}">`,
      `<link rel="alternate" hreflang="en" href="${e(companyDirectoryUrl(base, "en"))}">`,
      `<link rel="alternate" hreflang="x-default" href="${e(companyDirectoryUrl(base, "fr"))}">`,
      `<style>${STYLES}${DIRECTORY_STYLES}${LEDGER_STYLES}${COMPANY_DIRECTORY_STYLES}</style>`,
      `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
      "</head>",
      "<body>",
      marketHeader(o.lang, `/${other}/entreprises`, "companies"),
      '<main id="contenu" class="wrap wide">',
      `<h1 class="title">${l.title}</h1>`,
      `<p class="headline">${l.lead}</p>`,
      listLegend(l.legendVerified, l.legendOpen, { items: items.length, anyVerified: items.some((c) => c.registryActiveCheckedAt !== null) }),
      // Aucune page publique du tout : pas de filtres à régler pour rien, l'état vide dit pourquoi et propose quoi faire.
      nobody ? '<div class="solo">' : '<div class="dir">',
      nobody ? "" : filtersForm(o.lang, f, o.facets, path),
      "<section>",
      `<div class="res-head"><h2>${l.results(o.facets.total)}</h2><p class="trace">${l.order(l.sorts[f.sort])}</p></div>`,
      items.length === 0 ? blankState(filtered ? l.empty : l.none, filtered ? l.emptyWhy : l.noneWhy, next) : `<ul class="grid">${items.map((c) => companyCard(c, o.lang)).join("")}</ul>`,
      `<nav class="pager">${pager}</nav>`,
      "</section>",
      "</div>",
      "</main>",
      marketFooter(o.lang),
      "</body>",
      "</html>",
      "",
    ].join("\n"),
  );
};
