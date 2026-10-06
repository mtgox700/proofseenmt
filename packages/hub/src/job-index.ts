import { FAVICON } from "./pages";
import { escapeHtml as e, STYLES } from "./html";
import { rateText } from "./job-page";
import type { PublicMission } from "./job-posting";

/*
 * Index public des missions ouvertes : la liste, et un formulaire de filtres envoyé en GET. Sans JavaScript, la
 * recherche marche quand même, et chaque recherche a son adresse, que l'on peut partager et qu'un moteur peut lire.
 *
 * L'ordre est celui que le visiteur choisit (plus récentes, TJM) : aucune pertinence calculée, comme partout ailleurs.
 */

type Lang = "fr" | "en";

export interface JobIndexFilters {
  readonly mode: readonly string[];
  readonly skill: string;
  readonly city: string;
  readonly sort: "recent" | "rate_desc" | "rate_asc";
  readonly page: number;
}

const LABELS = {
  fr: {
    title: "Missions freelance ouvertes",
    lead: "Publiées par les entreprises sur Proofseen. On postule ici, la conversation reste sur la plateforme.",
    skill: "Compétence",
    city: "Ville",
    mode: "Mode de travail",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    sort: "Trier par",
    sorts: { recent: "Plus récentes", rate_desc: "TJM le plus haut", rate_asc: "TJM le plus bas" },
    search: "Filtrer",
    results: "Missions correspondantes",
    empty: "Aucune mission ne correspond à ces filtres.",
    next: "Page suivante",
    previous: "Page précédente",
    otherLang: "English",
  },
  en: {
    title: "Open freelance missions",
    lead: "Posted by companies on Proofseen. Apply here; the conversation stays on the platform.",
    skill: "Skill",
    city: "City",
    mode: "Work mode",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    sort: "Sort by",
    sorts: { recent: "Most recent", rate_desc: "Highest day rate", rate_asc: "Lowest day rate" },
    search: "Filter",
    results: "Matching missions",
    empty: "No mission matches these filters.",
    next: "Next page",
    previous: "Previous page",
    otherLang: "Français",
  },
} as const;

const FORM_STYLES =
  ".filters{display:flex;flex-wrap:wrap;gap:.8rem 1.2rem;align-items:end;margin:2rem 0;padding:1rem;border:1px solid var(--line);border-radius:12px;background:var(--surface)}" +
  ".filters label{display:grid;gap:.3rem;font:500 .8rem/1.2 var(--mono);color:var(--muted)}" +
  ".filters input,.filters select{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--strong);border-radius:8px;padding:.45rem .6rem}" +
  ".filters fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.3rem .8rem;align-items:center}" +
  ".filters legend{padding:0;margin-bottom:.3rem;font:500 .8rem/1.2 var(--mono);color:var(--muted)}" +
  ".filters fieldset label{display:flex;gap:.35rem;align-items:center;font:inherit;color:var(--ink)}" +
  ".filters button{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:.55rem 1rem;background:var(--accent);color:var(--on-accent)}" +
  ".pager{display:flex;justify-content:space-between;margin-top:2rem}";

const query = (f: JobIndexFilters, page: number): string => {
  const params = new URLSearchParams();
  for (const mode of f.mode) params.append("mode", mode);
  if (f.skill !== "") params.set("competence", f.skill);
  if (f.city !== "") params.set("ville", f.city);
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

export const renderJobIndex = (
  items: readonly PublicMission[],
  o: { readonly baseUrl: string; readonly lang: Lang; readonly filters: JobIndexFilters; readonly hasMore: boolean },
): string => {
  const l = LABELS[o.lang];
  const f = o.filters;
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const modes = (Object.keys(l.modes) as (keyof typeof l.modes)[])
    .map((m) => `<label><input type="checkbox" name="mode" value="${m}"${f.mode.includes(m) ? " checked" : ""}> ${l.modes[m]}</label>`)
    .join("");
  const sorts = (Object.keys(l.sorts) as (keyof typeof l.sorts)[])
    .map((s) => `<option value="${s}"${f.sort === s ? " selected" : ""}>${l.sorts[s]}</option>`)
    .join("");
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
    `<style>${STYLES}${FORM_STYLES}</style>`,
    "</head>",
    "<body>",
    `<header class="top"><div class="wrap"><a class="me" href="/${o.lang}">Proofseen</a>` +
      `<a class="lang" href="/${other}/missions" hreflang="${other}" lang="${other}">${l.otherLang}</a></div></header>`,
    '<main class="wrap">',
    `<h1 class="title">${l.title}</h1>`,
    `<p class="headline">${l.lead}</p>`,
    `<form class="filters" method="get" action="/${o.lang}/missions">` +
      `<label>${l.skill}<input name="competence" value="${e(f.skill)}" maxlength="60"></label>` +
      `<label>${l.city}<input name="ville" value="${e(f.city)}" maxlength="120"></label>` +
      `<fieldset><legend>${l.mode}</legend>${modes}</fieldset>` +
      `<label>${l.sort}<select name="tri">${sorts}</select></label>` +
      `<button type="submit">${l.search}</button></form>`,
    `<h2>${l.results}</h2>`,
    items.length === 0 ? `<p class="muted">${l.empty}</p>` : `<ul class="missions">${items.map((m) => card(m, o.lang)).join("")}</ul>`,
    `<nav class="pager">${pager}</nav>`,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
