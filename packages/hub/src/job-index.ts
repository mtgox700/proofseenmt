import { FAVICON } from "./pages";
import { escapeHtml as e, STYLES } from "./html";
import { marketHeader, MENU_STYLES } from "./market-shell";
import { rateText } from "./job-page";
import type { PublicMission } from "./job-posting";
import { cityUrl } from "./city-page";

/*
 * Index public des missions ouvertes : la liste, et un formulaire de filtres envoyé en GET. Sans JavaScript, la
 * recherche marche quand même, et chaque recherche a son adresse, que l'on peut partager et qu'un moteur peut lire.
 *
 * L'ordre est celui que le visiteur choisit (plus récentes, TJM), et il est écrit au-dessus de la liste : aucune
 * pertinence calculée, comme partout ailleurs. La recherche par mots est un filtre de plus, pas un classement.
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
    results: "Missions correspondantes",
    empty: "Aucune mission ne correspond à ces filtres.",
    next: "Page suivante",
    previous: "Page précédente",
    cities: "Missions par ville",
  },
  en: {
    title: "Open freelance missions",
    lead: "Posted by companies on Proofseen. Apply here; the conversation stays on the platform.",
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
    results: "Matching missions",
    empty: "No mission matches these filters.",
    next: "Next page",
    previous: "Previous page",
    cities: "Missions by city",
  },
} as const;

const FORM_STYLES =
  ".filters{display:flex;flex-wrap:wrap;gap:.8rem 1.2rem;align-items:end;margin:2rem 0;padding:1rem;border:1px solid var(--line);border-radius:12px;background:var(--surface)}" +
  ".filters label{display:grid;gap:.3rem;font:500 .8rem/1.2 var(--mono);color:var(--muted)}" +
  ".filters input,.filters select{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--strong);border-radius:8px;padding:.45rem .6rem}" +
  ".filters input[type=number]{width:8rem}" +
  ".filters fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.3rem .8rem;align-items:center}" +
  ".filters legend{padding:0;margin-bottom:.3rem;font:500 .8rem/1.2 var(--mono);color:var(--muted)}" +
  ".filters fieldset label{display:flex;gap:.35rem;align-items:center;font:inherit;color:var(--ink)}" +
  ".filters button{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:.55rem 1rem;background:var(--accent);color:var(--on-accent)}" +
  ".pager{display:flex;justify-content:space-between;margin-top:2rem}";

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

const card = (m: PublicMission, lang: Lang): string => {
  const l = LABELS[lang];
  const where = m.workMode === "remote" || m.city === null ? l.modes[m.workMode] : `${m.city} · ${l.modes[m.workMode]}`;
  return (
    `<li class="card"><h3><a href="/${lang}/missions/${e(m.id)}">${e(m.title)}</a></h3>` +
    `<p class="when">${e(m.organisationName)} · ${e(where)}</p>` +
    (m.skills.length === 0 ? "" : `<ul class="tags">${m.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`) +
    `<p class="lead"><b>${e(rateText(m, lang))}</b></p></li>`
  );
};

const filterForm = (f: JobIndexFilters, lang: Lang): string => {
  const l = LABELS[lang];
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
    `<button type="submit">${l.search}</button></form>`
  );
};

const cityLinks = (cities: readonly JobIndexCity[], baseUrl: string, lang: Lang): string => {
  if (cities.length === 0) return "";
  const sorted = [...cities].sort((a, b) => a.label.localeCompare(b.label, lang) || a.key.localeCompare(b.key));
  const items = sorted.map((c) => `<li><a href="${e(cityUrl(baseUrl, lang, c.key))}">${e(c.label)} (${c.missions})</a></li>`).join("");
  return `<h2>${LABELS[lang].cities}</h2><ul class="tags">${items}</ul>`;
};

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
    `<link rel="canonical" href="${e(`${o.baseUrl}/${o.lang}/missions`)}">`,
    filtered ? '<meta name="robots" content="noindex, follow">' : "",
    `<link rel="alternate" hreflang="fr" href="${e(`${o.baseUrl}/fr/missions`)}">`,
    `<link rel="alternate" hreflang="en" href="${e(`${o.baseUrl}/en/missions`)}">`,
    `<style>${STYLES}${MENU_STYLES}${FORM_STYLES}</style>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, `/${other}/missions`, "missions"),
    '<main class="wrap">',
    `<h1 class="title">${l.title}</h1>`,
    `<p class="headline">${l.lead}</p>`,
    filterForm(f, o.lang),
    `<h2>${l.results}</h2>`,
    `<p class="muted">${l.order[f.sort]}</p>`,
    items.length === 0 ? `<p class="muted">${l.empty}</p>` : `<ul class="missions">${items.map((m) => card(m, o.lang)).join("")}</ul>`,
    `<nav class="pager">${pager}</nav>`,
    filtered ? "" : cityLinks(o.cities ?? [], o.baseUrl, o.lang),
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
