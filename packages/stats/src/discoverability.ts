import { wilson, type Interval } from "./wilson";

/*
 * LLM Discoverability Rate (ARCHITECTURE_ANONYME §5): among the draws where a recruiter-style question was asked, the
 * share where the profile is actually cited — per profile, per engine, per query, and globally, always with its
 * interval. Two separate numbers on purpose: "the crawler came" is CONTROLLED by us, "the answer cited us" is NOT.
 */

export interface Observation {
  readonly profileId: string;
  readonly engine: string;
  readonly queryId: string;
  /** The answer named the profile or linked its page. */
  readonly cited: boolean;
  /** The engine fetched the page during this draw (server logs or citation of any of our URLs). */
  readonly retrieved: boolean;
}

/** Below this, a rate means nothing and is not published (same spirit as the k ≥ 10 rule of the project). */
export const MIN_DRAWS_TO_PUBLISH = 10;

export interface Breakdown {
  readonly key: string;
  readonly draws: number;
  readonly cited: number;
  readonly rate: Interval | null;
}

export interface ProfileDiscoverability {
  readonly profileId: string;
  readonly draws: number;
  readonly cited: number;
  readonly retrieved: number;
  readonly rate: Interval | null;
  readonly retrievalRate: Interval | null;
  /** A rate computed on too few draws is kept for the operator but must not be shown to a client. */
  readonly publishable: boolean;
  readonly note: string | null;
  /** "Made visible": cited at least once and the lower bound of the interval is above zero. */
  readonly visible: boolean;
  readonly byEngine: readonly Breakdown[];
  readonly byQuery: readonly Breakdown[];
}

export interface DiscoverabilityReport {
  readonly profiles: readonly ProfileDiscoverability[];
  readonly global: { readonly draws: number; readonly cited: number; readonly rate: Interval | null };
  readonly profilesMeasured: number;
  readonly visibleProfiles: number;
}

const breakdown = (observations: readonly Observation[], keyOf: (o: Observation) => string): Breakdown[] => {
  const keys = [...new Set(observations.map(keyOf))].sort();
  return keys.map((key) => {
    const subset = observations.filter((o) => keyOf(o) === key);
    const cited = subset.filter((o) => o.cited).length;
    return { key, draws: subset.length, cited, rate: wilson(cited, subset.length) };
  });
};

const forProfile = (profileId: string, observations: readonly Observation[]): ProfileDiscoverability => {
  const draws = observations.length;
  const cited = observations.filter((o) => o.cited).length;
  const retrieved = observations.filter((o) => o.retrieved).length;
  const rate = wilson(cited, draws);
  const publishable = draws >= MIN_DRAWS_TO_PUBLISH;
  return {
    profileId,
    draws,
    cited,
    retrieved,
    rate,
    retrievalRate: wilson(retrieved, draws),
    publishable,
    note: publishable ? null : `${draws} tirages : trop peu pour publier un taux (minimum ${MIN_DRAWS_TO_PUBLISH})`,
    visible: cited > 0 && rate !== null && rate.low > 0,
    byEngine: breakdown(observations, (o) => o.engine),
    byQuery: breakdown(observations, (o) => o.queryId),
  };
};

export const discoverability = (observations: readonly Observation[]): DiscoverabilityReport => {
  const ids = [...new Set(observations.map((o) => o.profileId))].sort();
  const profiles = ids.map((id) => forProfile(id, observations.filter((o) => o.profileId === id)));
  const draws = observations.length;
  const cited = observations.filter((o) => o.cited).length;
  return {
    profiles,
    // Weighted by draws by construction: every draw counts once, whatever the profile.
    global: { draws, cited, rate: wilson(cited, draws) },
    profilesMeasured: profiles.length,
    visibleProfiles: profiles.filter((p) => p.visible).length,
  };
};
