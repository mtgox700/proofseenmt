import type { EngineResult, MeasurementView, ProfileFacts, WaveView } from "@proofseen/db";
import { wilson, type Interval } from "@proofseen/stats";

/*
 * What the "AI visibility" screen shows, computed from the stored waves. Every figure is a count of answers out of the
 * answers obtained, with its share and the share's interval: a measurement of the page's visibility, never a score of
 * the person. Between two waves the change is given in shares, because the number of answers can differ.
 */

export const FUNNEL_STEPS = ["retrieved", "named", "top5", "cited"] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface StepView {
  readonly step: FunnelStep;
  readonly count: number;
  readonly draws: number;
  /** `null` when the engine gave no answer at all: nothing was counted. */
  readonly share: number | null;
  readonly interval: Interval | null;
}

export interface EngineFunnel {
  readonly engine: string;
  readonly draws: number;
  readonly steps: readonly StepView[];
}

export const funnelOf = (result: EngineResult): EngineFunnel => ({
  engine: result.engine,
  draws: result.draws,
  steps: FUNNEL_STEPS.map((step) => {
    const count = result[step];
    return { step, count, draws: result.draws, share: result.draws === 0 ? null : count / result.draws, interval: wilson(count, result.draws) };
  }),
});

export interface Tally {
  readonly count: number;
  readonly draws: number;
}

export interface StepChange {
  readonly step: FunnelStep;
  /** `null` when the engine was not measured in that wave. */
  readonly previous: Tally | null;
  readonly current: Tally | null;
  /** Current share minus previous share; `null` unless both waves counted answers for this engine. */
  readonly delta: number | null;
}

/** "both": measured in the two waves; "new": only in the latest; "dropped": only in the one before. */
export type EngineChangeKind = "both" | "new" | "dropped";

export interface EngineChange {
  readonly engine: string;
  readonly kind: EngineChangeKind;
  readonly steps: readonly StepChange[];
}

export interface Evolution {
  readonly current: { readonly waveId: string; readonly measuredAt: Date };
  readonly previous: { readonly waveId: string; readonly measuredAt: Date };
  readonly engines: readonly EngineChange[];
}

const tally = (result: EngineResult | undefined, step: FunnelStep): Tally | null => (result === undefined ? null : { count: result[step], draws: result.draws });

const shareOf = (t: Tally | null): number | null => (t === null || t.draws === 0 ? null : t.count / t.draws);

const kindOf = (previous: EngineResult | undefined, current: EngineResult | undefined): EngineChangeKind =>
  previous !== undefined && current !== undefined ? "both" : current !== undefined ? "new" : "dropped";

/** The change between the two most recent waves (`waves` most recent first); `null` until there are two. */
export const evolutionOf = (waves: readonly WaveView[]): Evolution | null => {
  const [latest, before] = waves;
  if (latest === undefined || before === undefined) return null;
  const engines = [...new Set([...latest.engines, ...before.engines].map((r) => r.engine))].sort();
  return {
    current: { waveId: latest.waveId, measuredAt: latest.measuredAt },
    previous: { waveId: before.waveId, measuredAt: before.measuredAt },
    engines: engines.map((engine) => {
      const now = latest.engines.find((r) => r.engine === engine);
      const then = before.engines.find((r) => r.engine === engine);
      return {
        engine,
        kind: kindOf(then, now),
        steps: FUNNEL_STEPS.map((step) => {
          const previous = tally(then, step);
          const current = tally(now, step);
          const a = shareOf(previous);
          const b = shareOf(current);
          return { step, previous, current, delta: a === null || b === null ? null : b - a };
        }),
      };
    }),
  };
};

/** The way to a first measured result, each step done or not, in the order they have to be taken. */
export type FirstStepKey = "publish" | "prove" | "request";

export interface FirstStep {
  readonly key: FirstStepKey;
  readonly done: boolean;
}

export interface FirstStepsInput {
  readonly profile: Pick<ProfileFacts, "visibility" | "verifiedUrls"> | null;
  readonly requests: readonly Pick<MeasurementView, "status">[];
}

const ASKED: ReadonlySet<MeasurementView["status"]> = new Set(["queued", "running", "done"]);

export const firstSteps = ({ profile, requests }: FirstStepsInput): readonly FirstStep[] => [
  { key: "publish", done: profile !== null && profile.visibility !== "private" },
  { key: "prove", done: profile !== null && profile.verifiedUrls >= 1 },
  { key: "request", done: requests.some((r) => ASKED.has(r.status)) },
];

/** The citations of the latest wave, per engine, for the home tile; `null` before the first measured wave. */
export interface LatestCitations {
  readonly measuredAt: Date;
  readonly engines: readonly { readonly engine: string; readonly cited: number; readonly draws: number }[];
}

export const latestCitations = (waves: readonly WaveView[]): LatestCitations | null => {
  const [latest] = waves;
  if (latest === undefined) return null;
  return { measuredAt: latest.measuredAt, engines: latest.engines.map(({ engine, cited, draws }) => ({ engine, cited, draws })) };
};
