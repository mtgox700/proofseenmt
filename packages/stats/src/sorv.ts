import { createRng } from "./rng";
import { DEFAULT_BOOTSTRAP, percentile, resample, type BootstrapOptions } from "./bootstrap";
import type { DrawOutcome, Engine } from "./funnel";

export interface SorvResult {
  readonly estimate: number;
  readonly low: number;
  readonly high: number;
  readonly perEngine: Partial<Record<Engine, number>>;
}

const perEngineRates = (outcomes: readonly DrawOutcome[]): Partial<Record<Engine, number>> => {
  const engines = [...new Set(outcomes.map((o) => o.engine))];
  return Object.fromEntries(
    engines.map((engine) => {
      const own = outcomes.filter((o) => o.engine === engine);
      return [engine, own.filter((o) => o.top5).length / own.length];
    }),
  );
};

const meanOfRates = (rates: Partial<Record<Engine, number>>): number => {
  const values = Object.values(rates);
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
};

const groupByJd = (outcomes: readonly DrawOutcome[]): DrawOutcome[][] => {
  const groups = new Map<string, DrawOutcome[]>();
  outcomes.forEach((o) => groups.set(o.jdId, [...(groups.get(o.jdId) ?? []), o]));
  return [...groups.values()];
};

/** SoRV@5: mean TA@5 across engines (equal weights in V0), with a bootstrap over job descriptions. */
export const sorvAt5 = (
  outcomes: readonly DrawOutcome[],
  options: BootstrapOptions = DEFAULT_BOOTSTRAP,
): SorvResult => {
  if (outcomes.length === 0) throw new RangeError("sorvAt5: no outcome");
  const groups = groupByJd(outcomes);
  const rng = createRng(options.seed);
  const samples = Array.from({ length: options.iterations }, () =>
    meanOfRates(perEngineRates(resample(groups, rng).flat())),
  ).sort((a, b) => a - b);
  const perEngine = perEngineRates(outcomes);
  return {
    estimate: meanOfRates(perEngine),
    low: percentile(samples, 0.025),
    high: percentile(samples, 0.975),
    perEngine,
  };
};

export interface MatchEvidence {
  readonly jdId: string;
  readonly source: "market" | "client";
  readonly type: "certain" | "probable";
}

/** North-star rule: at least 2 certain matches on 2 distinct market JDs AND a strictly positive lower bound. */
export const isRenderedVisible = (matches: readonly MatchEvidence[], sorvLowerBound: number): boolean => {
  const certainMarket = matches.filter((m) => m.type === "certain" && m.source === "market");
  const distinctJds = new Set(certainMarket.map((m) => m.jdId));
  return certainMarket.length >= 2 && distinctJds.size >= 2 && sorvLowerBound > 0;
};
