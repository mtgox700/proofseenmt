import { EMPTY_QUERY, TOGGLES, type LanguageFilter, type SearchQuery, type ToggleKey, type WorkModeValue } from "./freelancer-search";

/*
 * The active filters of a company search, one chip each, and the query that removes it: every chip is a plain link,
 * so removing a filter needs no script. The order and the page are not filters; removing a filter goes back to page 1
 * and keeps the chosen order.
 */

export type Chip =
  | { readonly kind: "text"; readonly value: string; readonly query: SearchQuery }
  | { readonly kind: "skill"; readonly value: string; readonly query: SearchQuery }
  | { readonly kind: "jobTitle"; readonly value: string; readonly query: SearchQuery }
  | { readonly kind: "city"; readonly value: string; readonly query: SearchQuery }
  | { readonly kind: "language"; readonly value: string; readonly level: LanguageFilter["minLevel"]; readonly query: SearchQuery }
  | { readonly kind: "mode"; readonly value: WorkModeValue; readonly query: SearchQuery }
  | { readonly kind: "minRate" | "maxRate"; readonly value: number; readonly query: SearchQuery }
  | { readonly kind: "availableBy"; readonly value: string; readonly query: SearchQuery }
  | { readonly kind: "toggle"; readonly value: ToggleKey; readonly query: SearchQuery };

export const activeChips = (q: SearchQuery): readonly Chip[] => {
  const base: SearchQuery = { ...q, page: 1 };
  return [
    ...(q.text === "" ? [] : [{ kind: "text" as const, value: q.text, query: { ...base, text: "" } }]),
    ...q.skills.map((skill) => ({ kind: "skill" as const, value: skill, query: { ...base, skills: q.skills.filter((s) => s !== skill) } })),
    ...(q.jobTitle === "" ? [] : [{ kind: "jobTitle" as const, value: q.jobTitle, query: { ...base, jobTitle: "" } }]),
    ...(q.city === "" ? [] : [{ kind: "city" as const, value: q.city, query: { ...base, city: "" } }]),
    ...q.languages.map((l) => ({ kind: "language" as const, value: l.code, level: l.minLevel, query: { ...base, languages: q.languages.filter((x) => x.code !== l.code) } })),
    ...q.workModes.map((mode) => ({ kind: "mode" as const, value: mode, query: { ...base, workModes: q.workModes.filter((m) => m !== mode) } })),
    ...(q.minRateCents === null ? [] : [{ kind: "minRate" as const, value: q.minRateCents, query: { ...base, minRateCents: null } }]),
    ...(q.maxRateCents === null ? [] : [{ kind: "maxRate" as const, value: q.maxRateCents, query: { ...base, maxRateCents: null } }]),
    ...(q.availableBy === null ? [] : [{ kind: "availableBy" as const, value: q.availableBy, query: { ...base, availableBy: null } }]),
    ...TOGGLES.filter(([key]) => q[key]).map(([key]) => ({ kind: "toggle" as const, value: key, query: { ...base, [key]: false } })),
  ];
};

/** Every filter removed; the chosen order is kept. */
export const clearedQuery = (q: SearchQuery): SearchQuery => ({ ...EMPTY_QUERY, sort: q.sort });
