import type { PublicProfile } from "./identity";
import { contactPath, profilePath } from "./render";
import { ORDERING_NOTE, byFreshnessThenId } from "./order";

export { ORDERING_NOTE };

/*
 * Read-only query layer, shared by the static API and the MCP connector (ARCHITECTURE_ANONYME §2, contrainte 7).
 * Deterministic filters and a published ordering rule — deliberately NO score and NO automated ranking: Annex III
 * point 4 of the AI Act covers access to self-employment, and a scored shortlist would drag us into the high-risk
 * regime (CONFORMITE). The order is freshness first, then id, and it is stated inside the payload itself.
 */

export interface SearchCriteria {
  /** All of them must be present on the profile (case-insensitive). */
  readonly skills?: readonly string[] | undefined;
  readonly area?: string | undefined;
  readonly availableOnly?: boolean | undefined;
  /** Keeps profiles whose lower day rate is at or below this budget; a profile without a rate is kept. */
  readonly maxRate?: number | undefined;
}

/** What the API and the connector return: exactly what a visitor reads on the page, plus its URL. */
export interface ProfileResult extends PublicProfile {
  readonly url: string;
}

export const DEFAULT_LIMIT = 20;

const has = (haystack: readonly string[], needle: string): boolean =>
  haystack.some((value) => value.toLowerCase() === needle.toLowerCase().trim());

const matches = (profile: PublicProfile, criteria: SearchCriteria): boolean => {
  if (criteria.skills !== undefined && !criteria.skills.every((skill) => has(profile.skills, skill))) return false;
  if (criteria.area !== undefined && !profile.area.toLowerCase().includes(criteria.area.toLowerCase().trim())) return false;
  if (criteria.availableOnly === true && profile.availability.status === "unavailable") return false;
  if (criteria.maxRate !== undefined && profile.rate !== null && profile.rate.min > criteria.maxRate) return false;
  return true;
};


export const searchProfiles = (
  profiles: readonly PublicProfile[],
  criteria: SearchCriteria,
  limit: number = DEFAULT_LIMIT,
  baseUrl = "",
): ProfileResult[] =>
  profiles
    .filter((profile) => matches(profile, criteria))
    .sort(byFreshnessThenId)
    .slice(0, limit)
    .map((profile) => ({ ...profile, url: `${baseUrl}${profilePath("fr", profile.id)}` }));


export const CONTACT_NOTE = {
  fr: "Le contact passe par Proofseen. L'identité réelle est communiquée après accord du freelance, avant tout engagement.",
  en: "Contact goes through Proofseen. The real identity is shared after the freelancer agrees, before any commitment.",
} as const;

/** Static read-only API: one JSON file served next to the pages, usable by any agent without a server. */
export const publicApi = (profiles: readonly PublicProfile[], baseUrl: string): { path: string; content: string } => ({
  path: "api/profiles.json",
  content: `${JSON.stringify(
    {
      version: 1,
      updatedAt: profiles.map((p) => p.availability.updatedAt).sort().at(-1) ?? null,
      ordering: ORDERING_NOTE.fr,
      notice: `${ORDERING_NOTE.en} ${CONTACT_NOTE.en}`,
      contact: `${baseUrl}${contactPath("fr")}`,
      profiles: searchProfiles(profiles, {}, profiles.length, baseUrl),
    },
    null,
    2,
  )}\n`,
});
