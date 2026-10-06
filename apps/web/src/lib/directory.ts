import { byFreshnessThenId, searchProfiles, type ProfileResult, type PublicProfile } from "@proofseen/profiles";

/*
 * Recruiter search. Two orders exist and only two: freshness (the published rule) or identifier. No score, no ranking
 * of people: Annex III point 4 of the AI Act covers access to self-employment (CONFORMITE §6).
 */

export type SortKey = "freshness" | "id";

export interface Criteria {
  readonly skill: string | undefined;
  readonly area: string | undefined;
  readonly availableOnly: boolean;
  readonly sort: SortKey;
}

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

const MAX_FIELD = 60;

const single = (value: string | string[] | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_FIELD);
  return trimmed === "" ? undefined : trimmed;
};

export const parseCriteria = (raw: RawParams): Criteria => ({
  skill: single(raw.skill),
  area: single(raw.area),
  availableOnly: single(raw.available) === "1",
  sort: single(raw.sort) === "id" ? "id" : "freshness",
});

export const runSearch = (profiles: readonly PublicProfile[], criteria: Criteria): ProfileResult[] => {
  const found = searchProfiles(profiles, {
    skills: criteria.skill === undefined ? undefined : [criteria.skill],
    area: criteria.area,
    availableOnly: criteria.availableOnly,
  });
  return criteria.sort === "id" ? [...found].sort((a, b) => a.id.localeCompare(b.id)) : [...found].sort(byFreshnessThenId);
};
