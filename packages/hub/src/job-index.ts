import { escapeHtml as e, STYLES } from "./html";
import { pageHead, withBrand } from "./head";
import { marketFooter, marketHeader } from "./market-shell";
import type { PublicMission } from "./job-posting";
import { cityUrl } from "./city-page";
import { jobCard, JOB_CARD_STYLES } from "./job-card";
import { blankState, LEDGER_STYLES, square, type Action } from "./ledger";

/*
 * Index public des missions ouvertes : la liste, et un formulaire de filtres envoyé en GET. Sans JavaScript, la
 * recherche marche quand même, et chaque recherche a son adresse, que l'on peut partager et qu'un moteur peut lire.
 *
 * L'ordre est celui que le visiteur choisit (plus récentes, TJM), et il est écrit au-dessus de la liste : aucune
 * pertinence calculée, comme partout ailleurs. La recherche par mots est un filtre de plus, pas un classement.
 *
 * Deux états vides, qui ne disent pas la même chose : aucune mission ouverte du tout (la page le dit et propose quoi
 * faire, sans formulaire inutile), ou aucune mission pour ces filtres (la page propose de les retirer).
 */

type Lang = "fr" | "en";

/** Fenêtres proposées pour « publiée depuis », en jours. */
export const SINCE_DAYS = [1, 7, 30] as const;
export type SinceDays = (typeof SINCE_DAYS)[number];

export interface JobIndexFilters {
  readonly mode: readonly string[];
  readonly skill: string;
  readonly city: string;
  readonly sort: "recent" | "rate_desc" | "rate_asc";
  readonly page: number;
  /** Mots cherchés dans l'intitulé, la description et les compétences. */
  readonly q?: string;
  /** TJM en euros entiers, tels que saisis. */
  readonly rateMin?: number | null;
  readonly rateMax?: number | null;
  readonly maxDuration?: number | null;
  readonly since?: SinceDays | null;
}

export interface JobIndexCity {
  readonly key: string;
  readonly label: string;
  readonly missions: number;
}

const LABELS = {
  fr: {
    title: "Missions freelance ouvertes",
    lead: "Publiées par les entreprises sur Proofseen. On postule ici, la conversation reste sur la plateforme.",
    legendVerified: "entreprise active au répertoire officiel, date du contrôle",
    legendOpen: "activité au répertoire non confirmée",
    filters: "Filtres",
    active: (n: number) => (n === 0 ? "aucun actif" : n === 1 ? "1 actif" : `${n} actifs`),
    q: "Mots-clés",
    skill: "Compétence",
    city: "Ville",
    mode: "Mode de travail",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    rateMin: "TJM min. (€)",
    rateMax: "TJM max. (€)",
    duration: "Durée max. (mois)",
    since: "Publiée depuis",
    sinceAny: "Toutes dates",
    sinces: { 1: "24 heures", 7: "7 jours", 30: "30 jours" },
    sort: "Trier par",
    sorts: { recent: "Plus récentes", rate_desc: "TJM le plus haut", rate_asc: "TJM le plus bas" },
    order: { recent: "Ordre : date de publication, les plus récentes d'abord.", rate_desc: "Ordre : TJM maximum, du plus haut au plus bas.", rate_asc: "Ordre : TJM minimum, du plus bas au plus haut." },
    search: "Filtrer",
    reset: "Retirer les filtres",
    results: "Missions correspondantes",
    empty: "Aucune mission ne correspond à ces filtres.",
    emptyWhy: "D'autres missions sont peut-être ouvertes : retirez un filtre, ou élargissez le TJM et la durée.",
    none: "Aucune mission n'est ouverte aujourd'hui.",
    noneWhy: "Une mission apparaît ici dès qu'une entreprise la publie, avec sa date de publication et l'état de l'entreprise au répertoire officiel.",
    noneActs: [
      ["Vous recrutez : créez un compte et publiez une mission", "creer-un-compte"],
      ["Voir les freelances publiés", "freelances"],
      ["Consulter le baromètre des TJM", "barometre/tjm"],
    ],
    next: "Page suivante",
    previous: "Page précédente",
    cities: "Missions par ville",
  },
  en: {
    title: "Open freelance missions",
    lead: "Posted by companies on Proofseen. Apply here; the conversation stays on the platform.",
    legendVerified: "company active in the official register, date of the check",
    legendOpen: "register status not confirmed",
    filters: "Filters",
    active: (n: number) => (n === 0 ? "none active" : `${n} active`),
    q: "Keywords",
    skill: "Skill",
    city: "City",
    mode: "Work mode",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    rateMin: "Min. day rate (€)",
    rateMax: "Max. day rate (€)",
    duration: "Max. duration (months)",
    since: "Posted within",
    sinceAny: "Any date",
    sinces: { 1: "24 hours", 7: "7 days", 30: "30 days" },
    sort: "Sort by",
    sorts: { recent: "Most recent", rate_desc: "Highest day rate", rate_asc: "Lowest day rate" },
    order: { recent: "Order: publication date, most recent first.", rate_desc: "Order: maximum day rate, highest first.", rate_asc: "Order: minimum day rate, lowest first." },
    search: "Filter",
    reset: "Clear the filters",
    results: "Matching missions",
    empty: "No mission matches these filters.",
    emptyWhy: "Other missions may be open: remove a filter, or widen the day rate and the duration.",
    none: "No mission is open today.",
    noneWhy: "A mission shows here as soon as a company publishes it, with its publication date and the company's status in the official register.",
    noneActs: [
      ["Hiring: create an account and publish a mission", "creer-un-compte"],
      ["See published freelancers", "freelances"],
      ["Read the day-rate barometer", "barometre/tjm"],
    ],
    next: "Next page",
    previous: "Previous page",
    cities: "Missions by city",
  },
} as const;

/*
 * Le panneau de filtres : replié sur un téléphone (ouvert d'office quand un filtre est actif), toujours ouvert à partir
 * de 62 rem, sans script. Le triangle natif est remplacé par un signe en mono ; ce n'est pas du texte.
 */
const INDEX_STYLES =
  ".wrap.wide{width:min(100% - 2*var(--ps-gutter),72rem)}" +
  ".dir{display:grid;gap:var(--ps-space-5) var(--ps-space-7);margin-top:var(--ps-space-6)}" +
  "@media (min-width:62rem){.dir{grid-template-columns:17rem minmax(0,1fr);align-items:start}.dir>.drawer{position:sticky;top:calc(4rem + var(--ps-space-4))}" +
  ".dir>.drawer::details-content{content-visibility:visible;display:block}.dir>.drawer>summary{cursor:default}.dir>.drawer>summary::after{content:none}}" +
  ".drawer{border:1px solid var(--ps-line);border-radius:var(--ps-radius);background:var(--ps-surface)}" +
  ".drawer>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:var(--ps-space-3);min-height:3rem;padding:var(--ps-space-2) var(--ps-space-4);font:var(--ps-weight-mono) var(--ps-step--1)/1.2 var(--ps-font-mono)}" +
  ".drawer>summary::-webkit-details-marker{display:none}" +
  ".drawer>summary::after{content:\"+\";font:var(--ps-weight-mono) var(--ps-step-1)/1 var(--ps-font-mono);color:var(--ps-muted)}.drawer[open]>summary::after{content:\"−\"}" +
  ".drawer>summary:focus-visible{outline-offset:-2px}" +
  ".filters{display:grid;gap:var(--ps-space-4);padding:var(--ps-space-1) var(--ps-space-4) var(--ps-space-5)}" +
  ".filters label{display:grid;gap:var(--ps-space-1);font:var(--ps-weight-mono) var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}" +
  ".filters input,.filters select{width:100%;font:inherit;font-family:var(--ps-font-text);font-weight:var(--ps-weight-text);font-size:max(16px,var(--ps-step-0));letter-spacing:0;text-transform:none;min-height:2.75rem;color:var(--ps-text);background:var(--ps-bg);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);padding:var(--ps-space-2) var(--ps-space-3)}" +
  ".filters fieldset{border:0;margin:0;padding:0;display:grid}" +
  ".filters legend{padding:0;margin-bottom:var(--ps-space-1);font:var(--ps-weight-mono) var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}" +
  ".filters fieldset label{display:flex;gap:var(--ps-space-3);align-items:center;min-height:2.75rem;font:inherit;font-family:var(--ps-font-text);letter-spacing:0;text-transform:none;color:var(--ps-text)}" +
  ".filters fieldset input{width:1.15rem;min-height:0;height:1.15rem;padding:0;accent-color:var(--ps-text)}" +
  ".filters .btn{width:100%}" +
  ".filters .reset{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;color:var(--ps-muted);font-size:var(--ps-step--1)}" +
  ".res-head{display:grid;gap:var(--ps-space-2);margin-bottom:var(--ps-space-4)}.res-head h2{margin:0}" +
  ".cities{margin-top:var(--ps-space-2)}.cities a{display:inline-flex;align-items:center;min-height:2.75rem;text-decoration:none}";

const amount = (value: number | null | undefined): string => (value === null || value === undefined ? "" : String(value));

const query = (f: JobIndexFilters, page: number): string => {
  const params = new URLSearchParams();
  if ((f.q ?? "") !== "") params.set("q", f.q ?? "");
  for (const mode of f.mode) params.append("mode", mode);
  if (f.skill !== "") params.set("competence", f.skill);
  if (f.city !== "") params.set("ville", f.city);
  if (amount(f.rateMin) !== "") params.set("tjmMin", amount(f.rateMin));
  if (amount(f.rateMax) !== "") params.set("tjmMax", amount(f.rateMax));
  if (amount(f.maxDuration) !== "") params.set("dureeMax", amount(f.maxDuration));
  if (f.since !== null && f.since !== undefined) params.set("depuis", String(f.since));
  if (f.sort !== "recent") params.set("tri", f.sort);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

/** Le nombre de filtres actifs (le tri n'en est pas un : il ne retire aucune mission). */
const activeFilters = (f: JobIndexFilters): number =>
  [(f.q ?? "") !== "", f.mode.length > 0, f.skill !== "", f.city !== "", amount(f.rateMin) !== "", amount(f.rateMax) !== "", amount(f.maxDuration) !== "", f.since != null].filter(Boolean).length;

const filterForm = (f: JobIndexFilters, lang: Lang): string => {
  const l = LABELS[lang];
  const active = activeFilters(f);
  const modes = (Object.keys(l.modes) as (keyof typeof l.modes)[])
    .map((m) => `<label><input type="checkbox" name="mode" value="${m}"${f.mode.includes(m) ? " checked" : ""}> ${l.modes[m]}</label>`)
    .join("");
  const sorts = (Object.keys(l.sorts) as (keyof typeof l.sorts)[])
    .map((s) => `<option value="${s}"${f.sort === s ? " selected" : ""}>${l.sorts[s]}</option>`)
    .join("");
  const sinces =
    `<option value=""${f.since == null ? " selected" : ""}>${l.sinceAny}</option>` +
    SINCE_DAYS.map((d) => `<option value="${d}"${f.since === d ? " selected" : ""}>${l.sinces[d]}</option>`).join("");
  return (
    `<details class="drawer"${active > 0 ? " open" : ""}><summary><span>${l.filters} · ${l.active(active)}</span></summary>` +
    `<form class="filters" method="get" action="/${lang}/missions">` +
    `<label>${l.q}<input type="search" name="q" value="${e(f.q ?? "")}" maxlength="200"></label>` +
    `<label>${l.skill}<input name="competence" value="${e(f.skill)}" maxlength="60"></label>` +
    `<label>${l.city}<input name="ville" value="${e(f.city)}" maxlength="120"></label>` +
    `<fieldset><legend>${l.mode}</legend>${modes}</fieldset>` +
    `<label>${l.rateMin}<input type="number" name="tjmMin" min="0" max="100000" step="1" value="${e(amount(f.rateMin))}"></label>` +
    `<label>${l.rateMax}<input type="number" name="tjmMax" min="0" max="100000" step="1" value="${e(amount(f.rateMax))}"></label>` +
    `<label>${l.duration}<input type="number" name="dureeMax" min="1" max="600" step="1" value="${e(amount(f.maxDuration))}"></label>` +
    `<label>${l.since}<select name="depuis">${sinces}</select></label>` +
    `<label>${l.sort}<select name="tri">${sorts}</select></label>` +
    `<button class="btn btn-primary" type="submit">${l.search}</button>` +
    (active === 0 ? "" : `<a class="reset" href="/${lang}/missions">${l.reset}</a>`) +
    `</form></details>`
  );
};

const cityLinks = (cities: readonly JobIndexCity[], baseUrl: string, lang: Lang): string => {
  if (cities.length === 0) return "";
  const sorted = [...cities].sort((a, b) => a.label.localeCompare(b.label, lang) || a.key.localeCompare(b.key));
  const items = sorted.map((c) => `<li><a href="${e(cityUrl(baseUrl, lang, c.key))}">${e(c.label)} (${c.missions})</a></li>`).join("");
  return `<h2>${LABELS[lang].cities}</h2><ul class="tags cities">${items}</ul>`;
};

const actions = (lang: Lang, pairs: readonly (readonly [string, string])[]): readonly Action[] => pairs.map(([text, path]) => ({ text, href: `/${lang}/${path}` }));

export const renderJobIndex = (
  items: readonly PublicMission[],
  o: { readonly baseUrl: string; readonly lang: Lang; readonly filters: JobIndexFilters; readonly hasMore: boolean; readonly cities?: readonly JobIndexCity[] },
): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const pager = [
    f.page > 1 ? `<a class="crumb" href="/${o.lang}/missions${e(query(f, f.page - 1))}">← ${l.previous}</a>` : "<span></span>",
    o.hasMore ? `<a class="crumb" href="/${o.lang}/missions${e(query(f, f.page + 1))}">${l.next} →</a>` : "<span></span>",
  ].join("");
  // Une page filtrée n'est pas une page à indexer : seule la liste nue est canonique.
  const filtered = query(f, f.page) !== "";
  // Rien d'ouvert du tout : pas de formulaire à remplir pour rien, l'état vide dit pourquoi et propose quoi faire.
  const nothingOpen = activeFilters(f) === 0 && f.page === 1 && items.length === 0;
  const list =
    items.length === 0
      ? blankState(l.empty, l.emptyWhy, actions(o.lang, [[l.reset, "missions"]]))
      : `<ul class="entries missions">${items.map((m) => jobCard(m, o.lang)).join("")}</ul><nav class="pager">${pager}</nav>`;

  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: withBrand(l.title), description: l.lead, canonical: `${o.baseUrl}/${o.lang}/missions` }),
    filtered ? '<meta name="robots" content="noindex, follow">' : "",
    `<link rel="alternate" hreflang="fr" href="${e(`${o.baseUrl}/fr/missions`)}">`,
    `<link rel="alternate" hreflang="en" href="${e(`${o.baseUrl}/en/missions`)}">`,
    `<style>${STYLES}${LEDGER_STYLES}${JOB_CARD_STYLES}${INDEX_STYLES}</style>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, `/${other}/missions`, "missions"),
    '<main id="contenu" class="wrap wide">',
    `<h1 class="title">${l.title}</h1>`,
    `<p class="headline">${l.lead}</p>`,
    `<p class="legend"><span class="vline">${square(true)}${l.legendVerified}</span><span class="vline">${square(false)}${l.legendOpen}</span></p>`,
    nothingOpen
      ? blankState(l.none, l.noneWhy, actions(o.lang, l.noneActs))
      : `<div class="dir">${filterForm(f, o.lang)}<section aria-labelledby="resultats"><div class="res-head"><h2 id="resultats">${l.results}</h2><p class="trace">${l.order[f.sort]}</p></div>${list}</section></div>`,
    filtered ? "" : cityLinks(o.cities ?? [], o.baseUrl, o.lang),
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
