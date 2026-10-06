import type { PublicProfile } from "./identity";

/*
 * Profile → profile internal linking (veille Malt du 2026-09-21, F6). Two constraints shape the rule:
 *
 * 1. No ranking of people. Annex III point 4 of the AI Act covers access to self-employment, so "related profiles"
 *    must never look like a merit ordering. The order here is the public identifier, alphabetically — as neutral as it
 *    gets, and anyone can verify it.
 * 2. No hub effect. If every profile linked to the same first three, the tail would stay orphaned. So each profile
 *    links to the ones that FOLLOW it in that order, wrapping around: a ring. Every profile is then linked at least
 *    once, the links spread evenly, and the rule stays one sentence long.
 */

export const RELATED_LIMIT = 3;
/** Below this, "related" would mean "everyone else" and the link would carry no information. */
export const MIN_SHARED_SKILLS = 1;

export const RELATED_NOTE = {
  fr: "Profils partageant une compétence et une zone, dans l'ordre des identifiants. Aucun classement, aucune évaluation.",
  en: "Profiles sharing a skill and an area, ordered by identifier. No ranking, no assessment.",
} as const;

/** "Paris / Île-de-France" → "paris": the same first-part rule the intent pages use. */
const areaKey = (area: string): string =>
  area
    .split("/")[0]!
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const sharedSkills = (a: PublicProfile, b: PublicProfile): number => {
  const theirs = new Set(b.skills.map((s) => s.toLowerCase()));
  return a.skills.filter((s) => theirs.has(s.toLowerCase())).length;
};

const byId = (a: PublicProfile, b: PublicProfile): number => a.id.localeCompare(b.id);

/**
 * The profiles a given profile links to. Pure and deterministic: same input, same links.
 * `candidates` is expected to hold only publishable profiles — a link to a noindex page wastes crawl budget.
 */
export const relatedProfiles = (profile: PublicProfile, candidates: readonly PublicProfile[], limit: number = RELATED_LIMIT): PublicProfile[] => {
  const ring = candidates
    .filter((other) => areaKey(other.area) === areaKey(profile.area) && sharedSkills(profile, other) >= MIN_SHARED_SKILLS)
    .sort(byId);
  const start = ring.findIndex((other) => other.id === profile.id);
  if (start === -1 || ring.length <= 1) return [];
  // Walk forward from the profile's own position and wrap around, so each one hands over to the next.
  return Array.from({ length: Math.min(limit, ring.length - 1) }, (_, step) => ring[(start + step + 1) % ring.length]!);
};
