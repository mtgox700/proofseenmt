import { wilson, type Interval } from "./wilson";

export type Engine = "openai" | "anthropic" | "perplexity";

/** One draw reduced to the funnel stages E2-E5 (E1, indexation, is measured outside the engines). */
export interface DrawOutcome {
  readonly engine: Engine;
  readonly jdId: string;
  readonly retrieved: boolean;
  readonly named: boolean;
  readonly top5: boolean;
  readonly cited: boolean;
}

export interface StageCount {
  readonly successes: number;
  readonly interval: Interval | null;
}

export interface EngineFunnel {
  readonly engine: Engine;
  readonly draws: number;
  readonly retrieved: StageCount;
  readonly named: StageCount;
  readonly top5: StageCount;
  readonly cited: StageCount;
}

const stage = (outcomes: readonly DrawOutcome[], pick: (o: DrawOutcome) => boolean): StageCount => {
  const successes = outcomes.filter(pick).length;
  return { successes, interval: wilson(successes, outcomes.length) };
};

export const funnel = (outcomes: readonly DrawOutcome[]): EngineFunnel[] => {
  const engines = [...new Set(outcomes.map((o) => o.engine))];
  return engines.map((engine) => {
    const own = outcomes.filter((o) => o.engine === engine);
    return {
      engine,
      draws: own.length,
      retrieved: stage(own, (o) => o.retrieved),
      named: stage(own, (o) => o.named),
      top5: stage(own, (o) => o.top5),
      cited: stage(own, (o) => o.cited),
    };
  });
};
