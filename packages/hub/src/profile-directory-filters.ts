import { escapeHtml as e } from "./html";
import type { Lang } from "./market-shell";

/*
 * La recherche publique de l'annuaire des freelances (STORYBOARD c.2) : un formulaire GET, et la ligne des filtres
 * actifs, chacun en lien vers la même recherche sans lui. Sans JavaScript, chaque recherche a son adresse, et retirer
 * un filtre est un simple lien. L'intention d'abord (compétences, ville), puis les faits vérifiés, puis le reste.
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

export interface JobTitleOption {
  readonly key: string;
  readonly label: string;
}

const WORK_MODES: readonly DirectoryWorkMode[] = ["remote", "hybrid", "onsite"];

type Toggle = "availableNow" | "provenOnly" | "verifiedMissionsOnly" | "registryActiveOnly" | "vigilanceValidOnly";

const LABELS = {
  fr: {
    filters: "Filtres",
    active: (n: number) => (n === 0 ? "aucun actif" : `${n} actif${n > 1 ? "s" : ""}`),
    skill: "Compétences",
    skillHint: "Séparées par des virgules, cinq au plus : chaque profil doit toutes les avoir.",
    city: "Ville",
    mode: "Mode de travail",
    jobTitle: "Poste",
    anyJobTitle: "Tous les postes",
    availability: "Disponibilité",
    facts: "Faits vérifiés",
    search: "Filtrer",
    reset: "Effacer les filtres",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    toggles: {
      availableNow: "Disponible maintenant (confirmé depuis 30 jours au plus)",
      provenOnly: "Adresse web prouvée",
      verifiedMissionsOnly: "Mission vérifiée",
      registryActiveOnly: "SIRET actif au répertoire",
      vigilanceValidOnly: "Attestation URSSAF en cours",
    },
    chipToggles: { availableNow: "Disponible maintenant", provenOnly: "Adresse web prouvée", verifiedMissionsOnly: "Mission vérifiée", registryActiveOnly: "SIRET actif", vigilanceValidOnly: "URSSAF en cours" },
    activeTitle: "Filtres actifs",
    remove: (label: string) => `Retirer le filtre : ${label}`,
    pair: (name: string, value: string) => `${name} : ${value}`,
    oneSkill: "Compétence",
  },
  en: {
    filters: "Filters",
    active: (n: number) => (n === 0 ? "none active" : `${n} active`),
    skill: "Skills",
    skillHint: "Comma-separated, five at most: every profile must have them all.",
    city: "City",
    mode: "Work mode",
    jobTitle: "Job title",
    anyJobTitle: "All job titles",
    availability: "Availability",
    facts: "Verified facts",
    search: "Filter",
    reset: "Clear filters",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    toggles: {
      availableNow: "Available now (confirmed within the last 30 days)",
      provenOnly: "Proven web address",
      verifiedMissionsOnly: "Verified mission",
      registryActiveOnly: "Active SIRET in the register",
      vigilanceValidOnly: "Valid URSSAF certificate",
    },
    chipToggles: { availableNow: "Available now", provenOnly: "Proven web address", verifiedMissionsOnly: "Verified mission", registryActiveOnly: "Active SIRET", vigilanceValidOnly: "Valid URSSAF" },
    activeTitle: "Active filters",
    remove: (label: string) => `Remove the filter: ${label}`,
    pair: (name: string, value: string) => `${name}: ${value}`,
    oneSkill: "Skill",
  },
} as const;

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

const FACT_TOGGLES: readonly Toggle[] = ["provenOnly", "verifiedMissionsOnly", "registryActiveOnly", "vigilanceValidOnly"];

export const activeFilterCount = (f: DirectoryFilters): number =>
  (f.skills.length > 0 ? 1 : 0) + (f.city === "" ? 0 : 1) + (f.workModes.length > 0 ? 1 : 0) + (f.jobTitle === "" ? 0 : 1) +
  [f.availableNow, ...FACT_TOGGLES.map((t) => f[t])].filter(Boolean).length;

const check = (name: string, label: string, checked: boolean, value = "1"): string =>
  `<label class="check"><input type="checkbox" name="${name}" value="${value}"${checked ? " checked" : ""}>${label}</label>`;

const TOGGLE_PARAMS: Readonly<Record<Toggle, string>> = { availableNow: "disponible", provenOnly: "adresse", verifiedMissionsOnly: "missions", registryActiveOnly: "siret", vigilanceValidOnly: "urssaf" };

/** Le panneau de filtres : replié sur un téléphone, ouvert d'office sur grand écran, sans script. */
export const filtersForm = (lang: Lang, f: DirectoryFilters, jobTitles: readonly JobTitleOption[]): string => {
  const l = LABELS[lang];
  const active = activeFilterCount(f);
  return (
    `<details class="drawer"><summary><span>${l.filters} <span class="muted">· ${l.active(active)}</span></span></summary>` +
    `<form class="facets" method="get" action="/${lang}/freelances">` +
    `<label><span class="lbl">${l.skill}</span><input type="search" name="competence" value="${e(f.skills.join(", "))}" maxlength="320" aria-describedby="dir-skill-hint"></label>` +
    `<p id="dir-skill-hint" class="hint">${l.skillHint}</p>` +
    `<label><span class="lbl">${l.city}</span><input type="search" name="ville" value="${e(f.city)}" maxlength="120" autocomplete="address-level2"></label>` +
    `<fieldset class="fg-facts"><legend>${l.facts}</legend>${FACT_TOGGLES.map((t) => check(TOGGLE_PARAMS[t], l.toggles[t], f[t])).join("")}</fieldset>` +
    `<fieldset><legend>${l.mode}</legend>${WORK_MODES.map((m) => check("mode", l.modes[m], f.workModes.includes(m), m)).join("")}</fieldset>` +
    (jobTitles.length === 0
      ? ""
      : `<label><span class="lbl">${l.jobTitle}</span><select name="poste"><option value="">${l.anyJobTitle}</option>` +
        jobTitles.map((t) => `<option value="${e(t.key)}"${t.key === f.jobTitle ? " selected" : ""}>${e(t.label)}</option>`).join("") +
        `</select></label>`) +
    `<fieldset><legend>${l.availability}</legend>${check("disponible", l.toggles.availableNow, f.availableNow)}</fieldset>` +
    `<button class="btn btn-primary" type="submit">${l.search}</button>` +
    (active === 0 ? "" : `<a class="reset" href="/${lang}/freelances">${l.reset}</a>`) +
    `</form></details>`
  );
};

/** Chaque filtre actif, avec la recherche qu'on obtient sans lui (toujours en page 1). */
const removable = (lang: Lang, f: DirectoryFilters, jobTitles: readonly JobTitleOption[]): readonly { readonly label: string; readonly without: DirectoryFilters }[] => {
  const l = LABELS[lang];
  const base = { ...f, page: 1 };
  const jobTitle = jobTitles.find((t) => t.key === f.jobTitle)?.label ?? f.jobTitle;
  return [
    ...f.skills.map((s) => ({ label: l.pair(l.oneSkill, s), without: { ...base, skills: f.skills.filter((x) => x !== s) } })),
    ...(f.city === "" ? [] : [{ label: l.pair(l.city, f.city), without: { ...base, city: "" } }]),
    ...FACT_TOGGLES.filter((t) => f[t]).map((t) => ({ label: l.chipToggles[t], without: { ...base, [t]: false } })),
    ...f.workModes.map((m) => ({ label: l.pair(l.mode, l.modes[m]), without: { ...base, workModes: f.workModes.filter((x) => x !== m) } })),
    ...(f.jobTitle === "" ? [] : [{ label: l.pair(l.jobTitle, jobTitle), without: { ...base, jobTitle: "" } }]),
    ...(f.availableNow ? [{ label: l.chipToggles.availableNow, without: { ...base, availableNow: false } }] : []),
  ];
};

/** La ligne des filtres actifs : un lien par filtre, qui mène à la même recherche sans lui, puis « Effacer les filtres ». */
export const activeFilters = (lang: Lang, f: DirectoryFilters, jobTitles: readonly JobTitleOption[]): string => {
  const l = LABELS[lang];
  const items = removable(lang, f, jobTitles);
  if (items.length === 0) return "";
  const links = items
    .map((i) => `<li><a href="/${lang}/freelances${e(directoryQueryString(i.without, 1))}" aria-label="${e(l.remove(i.label))}">${e(i.label)} <span aria-hidden="true">×</span></a></li>`)
    .join("");
  return `<div class="dir-active"><p class="lbl" id="dir-active">${l.activeTitle}</p><ul class="dir-chips" aria-labelledby="dir-active">${links}<li><a class="clear" href="/${lang}/freelances">${l.reset}</a></li></ul></div>`;
};

export const FILTER_STYLES = [
  // « Faits vérifiés » : un filet et le carré au filet, jamais vert (un filtre n'est pas un fait vérifié).
  ".facets .fg-facts{padding-top:var(--ps-space-3);border-top:1px solid var(--ps-line)}",
  ".facets .fg-facts legend{display:flex;align-items:center;gap:var(--ps-space-2)}",
  ".facets .fg-facts legend::before{content:\"\";width:8px;height:8px;border:1px solid var(--ps-line-strong)}",
  // Des cibles de 44 px : cases, champs, liste et lien d'effacement.
  ".facets .check{min-height:2.75rem}",
  ".facets input[type=search],.facets select{min-height:2.75rem}",
  ".facets .reset{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem}",
  ".dir-active{display:grid;gap:var(--ps-space-2);margin-bottom:var(--ps-space-5)}",
  ".dir-active .lbl{font:var(--ps-weight-mono) var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}",
  ".dir-chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--ps-space-2)}",
  ".dir-chips a{display:inline-flex;align-items:center;gap:var(--ps-space-2);min-height:2.75rem;padding:0 var(--ps-space-4);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius-pill);" +
    "font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-text);text-decoration:none;overflow-wrap:anywhere}",
  ".dir-chips a.clear{border-style:dashed;color:var(--ps-muted)}",
  "@media (hover:hover) and (pointer:fine){.dir-chips a:hover{border-color:var(--ps-text)}}",
].join("\n");
