import { JOB_TITLES, LANGUAGE_CODES, LANGUAGE_LEVELS, MAX_LANGUAGE_FILTERS, type LanguageCode, type LanguageLevelValue, type ProfileBriefFilters, type ProfileSearch, type ProfileSort, type SavedFilters } from "@proofseen/db";
import { centsToField, eurosToCents, skillsOf } from "./mission-form";

/*
 * The GET filters of the company freelancer search (`/fr/app/recherche?q=…&competences=…&ville=…&tri=…`). Every search
 * has its own address, so a colleague opens exactly the same results and the page needs no client script. Anything
 * malformed is dropped, field by field, rather than answered with an error: a hand-edited address always answers.
 *
 * The order is one the company picks among stated, neutral criteria (profile update, daily rate, availability date):
 * never a relevance, a count of proofs or a score of people (AI Act). Verified facts are filters, never an order: an old
 * address with `tri=faits_verifies` falls back to the default order. A language filter keeps the profiles that
 * declare that language at least at the level asked ("at least B2" keeps B2, C1, C2 and native): a filter on a
 * declaration, never a score.
 */

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export type WorkModeValue = (typeof WORK_MODES)[number];

/** Sort slugs as they appear in the address, mapped to the repository's criteria. */
export const SORT_SLUGS = {
  recent: "recent",
  tjm_croissant: "rate_asc",
  tjm_decroissant: "rate_desc",
  disponibilite: "availability",
} as const satisfies Readonly<Record<string, ProfileSort>>;
export type SortSlug = keyof typeof SORT_SLUGS;
const SORT_KEYS = Object.keys(SORT_SLUGS) as SortSlug[];

export const SEARCH_PAGE_SIZE = 20;
const MAX_PAGE = 50;
const MAX_SKILLS = 10;
const MAX_SKILL_LENGTH = 60;
const MAX_CITY_LENGTH = 120;
const MAX_TEXT_LENGTH = 200;
const MAX_RATE_CENTS = 10_000_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const JOB_TITLE_KEYS: readonly string[] = JOB_TITLES.map((t) => t.key);

/** One language asked for, with the lowest level that satisfies it. */
export interface LanguageFilter {
  readonly code: LanguageCode;
  readonly minLevel: LanguageLevelValue;
}

export interface SearchQuery {
  /** Keywords over the headline, summary, skills and experience titles; "" for none. */
  readonly text: string;
  readonly skills: readonly string[];
  /** A job title family key (C21 taxonomy); "" for none. */
  readonly jobTitle: string;
  readonly city: string;
  /** Every language asked for, each at least at its level; three at most, one per language. */
  readonly languages: readonly LanguageFilter[];
  readonly workModes: readonly WorkModeValue[];
  readonly minRateCents: number | null;
  readonly maxRateCents: number | null;
  /** `YYYY-MM-DD`: available on or before that day. */
  readonly availableBy: string | null;
  readonly availableOnly: boolean;
  readonly availableNow: boolean;
  readonly provenOnly: boolean;
  readonly verifiedMissionsOnly: boolean;
  readonly registryActiveOnly: boolean;
  readonly vigilanceValidOnly: boolean;
  readonly photoOnly: boolean;
  readonly portfolioOnly: boolean;
  readonly sort: SortSlug;
  readonly page: number;
}

export const EMPTY_QUERY: SearchQuery = {
  text: "",
  skills: [],
  jobTitle: "",
  city: "",
  languages: [],
  workModes: [],
  minRateCents: null,
  maxRateCents: null,
  availableBy: null,
  availableOnly: false,
  availableNow: false,
  provenOnly: false,
  verifiedMissionsOnly: false,
  registryActiveOnly: false,
  vigilanceValidOnly: false,
  photoOnly: false,
  portfolioOnly: false,
  sort: "recent",
  page: 1,
};

/** The yes/no filters, with their address parameter. */
export const TOGGLES = [
  ["availableOnly", "disponible"],
  ["availableNow", "maintenant"],
  ["provenOnly", "adresse"],
  ["verifiedMissionsOnly", "missions"],
  ["registryActiveOnly", "siret"],
  ["vigilanceValidOnly", "urssaf"],
  ["photoOnly", "photo"],
  ["portfolioOnly", "realisations"],
] as const satisfies readonly (readonly [keyof SearchQuery, string])[];
export type ToggleKey = (typeof TOGGLES)[number][0];

const ticked = (params: URLSearchParams, name: string): boolean => {
  const value = params.get(name);
  return value === "on" || value === "1";
};

const rate = (raw: string | null): number | null => {
  const cents = eurosToCents(raw ?? "");
  return cents === null || Number.isNaN(cents) || cents > MAX_RATE_CENTS ? null : cents;
};

const isoDate = (raw: string | null): string | null => {
  const value = (raw ?? "").trim();
  if (!ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
};

const isCode = (raw: string): raw is LanguageCode => (LANGUAGE_CODES as readonly string[]).includes(raw);
const isLevel = (raw: string): raw is LanguageLevelValue => (LANGUAGE_LEVELS as readonly string[]).includes(raw);

/** Language filters without duplicates (the first one asked wins), unknown codes dropped, three at most. */
export const languageFilters = (items: readonly { readonly code: string; readonly minLevel: string }[]): readonly LanguageFilter[] => {
  const kept = new Map<LanguageCode, LanguageLevelValue>();
  for (const item of items) {
    const code = item.code.trim().toLowerCase();
    const level = item.minLevel.trim().toLowerCase();
    // A level that cannot be read asks for no level: any declared level satisfies it.
    if (isCode(code) && !kept.has(code)) kept.set(code, isLevel(level) ? level : "a1");
  }
  return [...kept].slice(0, MAX_LANGUAGE_FILTERS).map(([code, minLevel]) => ({ code, minLevel }));
};

/** `langue` and `niveau` come in pairs, in the order of the form; an empty language slot is no filter. */
const languagesOf = (params: URLSearchParams): readonly LanguageFilter[] => {
  const levels = params.getAll("niveau");
  return languageFilters(params.getAll("langue").map((code, i) => ({ code, minLevel: levels[i] ?? "" })));
};

/**
 * Skills from the comma list (`competences`, the canonical form) and from single fields (`competence`: a ticked
 * suggestion or the "add a skill" box), without duplicates, ten at most.
 */
const skillsFrom = (params: URLSearchParams): readonly string[] => {
  const all = [params.get("competences") ?? "", ...params.getAll("competence")].join(",");
  const seen = new Set<string>();
  return skillsOf(all)
    .filter((skill) => skill.length <= MAX_SKILL_LENGTH)
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SKILLS);
};

const pageOf = (raw: string | null): number => {
  const value = Number(raw ?? "1");
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
};

const textOf = (raw: string | null): string => {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  return value.length <= MAX_TEXT_LENGTH ? value : "";
};

/** The search a GET address describes; malformed fields fall back to "no filter". */
export const searchQuery = (params: URLSearchParams): SearchQuery => {
  const sort = params.get("tri") ?? "";
  const city = (params.get("ville") ?? "").trim();
  const jobTitle = (params.get("poste") ?? "").trim();
  return {
    text: textOf(params.get("q")),
    skills: skillsFrom(params),
    jobTitle: JOB_TITLE_KEYS.includes(jobTitle) ? jobTitle : "",
    city: city.length <= MAX_CITY_LENGTH ? city : "",
    languages: languagesOf(params),
    workModes: WORK_MODES.filter((mode) => params.getAll("mode").includes(mode)),
    minRateCents: rate(params.get("tjm_min")),
    maxRateCents: rate(params.get("tjm_max")),
    availableBy: isoDate(params.get("dispo_avant")),
    availableOnly: ticked(params, "disponible"),
    availableNow: ticked(params, "maintenant"),
    provenOnly: ticked(params, "adresse"),
    verifiedMissionsOnly: ticked(params, "missions"),
    registryActiveOnly: ticked(params, "siret"),
    vigilanceValidOnly: ticked(params, "urssaf"),
    photoOnly: ticked(params, "photo"),
    portfolioOnly: ticked(params, "realisations"),
    sort: (SORT_KEYS as readonly string[]).includes(sort) ? (sort as SortSlug) : "recent",
    page: pageOf(params.get("page")),
  };
};

/** The filters of a query, without its order and page: what a saved search keeps and its alert replays. */
export const savedFiltersOf = (q: SearchQuery): SavedFilters => ({
  ...(q.text === "" ? {} : { text: q.text }),
  ...(q.jobTitle === "" ? {} : { jobTitle: q.jobTitle }),
  skills: [...q.skills],
  languages: q.languages.map((l) => ({ code: l.code, minLevel: l.minLevel })),
  workModes: [...q.workModes],
  ...(q.city === "" ? {} : { city: q.city }),
  ...(q.minRateCents === null ? {} : { minDailyRateCents: q.minRateCents }),
  ...(q.maxRateCents === null ? {} : { maxDailyRateCents: q.maxRateCents }),
  ...(q.availableBy === null ? {} : { availableBy: q.availableBy }),
  availableOnly: q.availableOnly,
  availableNow: q.availableNow,
  provenOnly: q.provenOnly,
  verifiedMissionsOnly: q.verifiedMissionsOnly,
  registryActiveOnly: q.registryActiveOnly,
  vigilanceValidOnly: q.vigilanceValidOnly,
  photoOnly: q.photoOnly,
  portfolioOnly: q.portfolioOnly,
});

/** The repository's input for a query. */
export const searchFilters = (q: SearchQuery): ProfileSearch => {
  const { availableBy, ...saved } = savedFiltersOf(q);
  return {
    ...saved,
    ...(availableBy === undefined ? {} : { availableBy: new Date(`${availableBy}T00:00:00Z`) }),
    sort: SORT_SLUGS[q.sort],
    page: q.page,
    pageSize: SEARCH_PAGE_SIZE,
  };
};

/** The canonical address parameters of a query; defaults are left out so addresses stay short. */
export const searchParamsOf = (q: SearchQuery): URLSearchParams => {
  const params = new URLSearchParams();
  if (q.text !== "") params.set("q", q.text);
  if (q.skills.length > 0) params.set("competences", q.skills.join(", "));
  if (q.jobTitle !== "") params.set("poste", q.jobTitle);
  if (q.city !== "") params.set("ville", q.city);
  for (const language of q.languages) {
    params.append("langue", language.code);
    params.append("niveau", language.minLevel);
  }
  for (const mode of q.workModes) params.append("mode", mode);
  if (q.minRateCents !== null) params.set("tjm_min", centsToField(q.minRateCents));
  if (q.maxRateCents !== null) params.set("tjm_max", centsToField(q.maxRateCents));
  if (q.availableBy !== null) params.set("dispo_avant", q.availableBy);
  for (const [key, name] of TOGGLES) if (q[key]) params.set(name, "1");
  if (q.sort !== "recent") params.set("tri", q.sort);
  if (q.page !== 1) params.set("page", String(q.page));
  return params;
};

/** The address of a search page; `extra` adds a notice flag (never user text). */
export const searchHref = (lang: string, q: SearchQuery, extra?: Readonly<Record<string, string>>): string => {
  const params = searchParamsOf(q);
  for (const [name, value] of Object.entries(extra ?? {})) params.set(name, value);
  const query = params.toString();
  return `/${lang}/app/recherche${query === "" ? "" : `?${query}`}`;
};

/** How many filters a query sets, its order and page aside. */
export const activeFilterCount = (q: SearchQuery): number =>
  (q.text === "" ? 0 : 1) +
  q.skills.length +
  (q.jobTitle === "" ? 0 : 1) +
  (q.city === "" ? 0 : 1) +
  q.languages.length +
  q.workModes.length +
  (q.minRateCents === null ? 0 : 1) +
  (q.maxRateCents === null ? 0 : 1) +
  (q.availableBy === null ? 0 : 1) +
  TOGGLES.filter(([key]) => q[key]).length;

/** A brief's proposed filters as a visible, editable query; the order stays the company's default choice. */
export const queryFromBrief = (f: ProfileBriefFilters): SearchQuery => ({
  ...EMPTY_QUERY,
  skills: f.skills.filter((skill) => skill.length <= MAX_SKILL_LENGTH).slice(0, MAX_SKILLS),
  city: f.city !== undefined && f.city.length <= MAX_CITY_LENGTH ? f.city : "",
  languages: languageFilters(f.languages ?? []),
  workModes: WORK_MODES.filter((mode) => f.workModes.includes(mode)),
  maxRateCents: f.maxDailyRateCents !== undefined && f.maxDailyRateCents <= MAX_RATE_CENTS ? f.maxDailyRateCents : null,
  availableOnly: f.availableOnly,
});
