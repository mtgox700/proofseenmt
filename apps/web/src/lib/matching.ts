import { JOB_TITLES, MATCH_CRITERIA, MatchOptionsSchema, type MatchCriterion, type MatchOptions, type MatchReason, type SuggestedMission, type SuggestedProfile, type Suggestions } from "@proofseen/db";
import { languageName, type NearbyMission, type NearbyProfile, type NearbyReason } from "@proofseen/hub";
import type { MatchingDictionary } from "../i18n/market/matching-fr";
import type { Lang } from "../i18n/types";
import { day } from "./format";

/*
 * Explained matching (C22) on screen: typed reasons from the repository turned into text, the viewer's criteria read
 * from the page's query, and the public "nearby" lists handed to the hub renderers. Nothing here computes anything
 * about a person: the repository compares facts, this file only words them.
 */

/** What the "rate" criterion meant for this comparison. */
export type RateSense = "budget" | "overlap" | "close";

const SHOWN_SKILLS = 4;
const MODES = { fr: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" }, en: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" } } as const;

const familyLabels = (keys: readonly string[], lang: Lang): readonly string[] =>
  keys.flatMap((key) => {
    const title = JOB_TITLES.find((t) => t.key === key);
    return title === undefined ? [] : [title.label[lang]];
  });

/** One reason as text, in the viewer's language. */
export const reasonText = (r: MatchReason, m: MatchingDictionary, lang: Lang, rate: RateSense): string => {
  const t = m.reasons;
  switch (r.kind) {
    case "skills": {
      const shown = r.shared.slice(0, SHOWN_SKILLS).join(", ");
      return t.skills(r.shared.length, r.shared.length > SHOWN_SKILLS ? `${shown} ${t.more(r.shared.length - SHOWN_SKILLS)}` : shown);
    }
    case "job_title":
      return t.jobTitle(familyLabels(r.families, lang).join(", "));
    case "city":
      return t.city(r.city);
    case "work_mode":
      return t.workMode(MODES[lang][r.mode]);
    case "rate":
      return rate === "budget" ? t.rateBudget : rate === "overlap" ? t.rateOverlap : t.rateClose;
    case "availability":
      return r.from === null ? t.availableNow : t.availableFrom(day(r.from, lang));
    case "languages":
      return t.languages(r.codes.map((code) => languageName(code, lang)).join(", "));
    case "proven_address":
      return t.provenAddress;
    case "verified_missions":
      return t.verifiedMissions(r.count);
    case "registry_active":
      return t.registryActive;
    case "vigilance_valid":
      return t.vigilanceValid;
    case "company_registry":
      return t.companyRegistry;
  }
};

/** A page's raw search params as URLSearchParams, repeated keys kept. */
export const queryOf = (raw: Readonly<Record<string, string | readonly string[] | undefined>>): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(raw)) {
    for (const item of typeof value === "string" ? [value] : (value ?? [])) params.append(name, item);
  }
  return params;
};

const isCriterion = (value: string): value is MatchCriterion => (MATCH_CRITERIA as readonly string[]).includes(value);

/** The criteria a page offers as filters, in a stable order. */
export const FOR_YOU_CRITERIA: readonly MatchCriterion[] = ["skills", "job_title", "city", "work_mode", "rate", "company_registry"];

/**
 * The viewer's choice from the query: `f=1` marks a submitted form, `c` the counted criteria, `r` the required ones.
 * Without a submitted form every criterion counts. Unknown values are dropped, never an error.
 */
export const matchOptionsFromQuery = (params: URLSearchParams, offered: readonly MatchCriterion[], limit: number): MatchOptions => {
  const pick = (name: string): MatchCriterion[] => [...new Set(params.getAll(name).filter(isCriterion))].filter((c) => offered.includes(c));
  const submitted = params.get("f") === "1";
  const parsed = MatchOptionsSchema.safeParse({ ...(submitted ? { counted: pick("c") } : {}), required: pick("r"), limit });
  return parsed.success ? parsed.data : { limit };
};

/** Public kinds only: the nearby lists show similarity, never a person's proofs. */
const publicReason = (r: MatchReason, lang: Lang): readonly NearbyReason[] => {
  switch (r.kind) {
    case "skills":
    case "city":
    case "work_mode":
    case "rate":
    case "languages":
      return [r];
    case "job_title":
      return [{ kind: "job_title", labels: familyLabels(r.families, lang) }];
    default:
      return [];
  }
};

export const toNearbyMissions = (s: Suggestions<SuggestedMission> | null, lang: Lang): readonly NearbyMission[] =>
  (s?.items ?? []).map(({ item, matched }) => ({
    id: item.id,
    title: item.title,
    organisationName: item.organisationName,
    city: item.city,
    workMode: item.workMode,
    reasons: matched.flatMap((r) => publicReason(r, lang)),
  }));

export const toNearbyProfiles = (s: Suggestions<SuggestedProfile> | null, lang: Lang): readonly NearbyProfile[] =>
  (s?.items ?? []).map(({ item, matched }) => ({
    slug: item.slug,
    reference: item.reference,
    ...(item.displayName === undefined ? {} : { displayName: item.displayName }),
    headline: item.headline,
    city: item.city,
    workMode: item.workMode,
    reasons: matched.flatMap((r) => publicReason(r, lang)),
  }));
