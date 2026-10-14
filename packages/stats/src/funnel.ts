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

/**
 * Ce qu'un tirage réussi laisse derrière lui, quel que soit l'endroit où il est conservé (fichiers de la CLI ou
 * mémoire de la mesure lancée depuis l'application). Seuls les tirages réussis en ont une : un tirage en erreur ne
 * compte ni au numérateur ni au dénominateur.
 */
export interface DrawEvidence {
  readonly engine: Engine;
  readonly jdId: string;
  readonly retrieved: boolean;
  /** Citations pointant vers les domaines propres du client (décompte des domaines cités). */
  readonly clientCitations: number;
  readonly match: { readonly type: "certain" | "probable"; readonly rank: number | null; readonly clientUrlCited: boolean } | null;
}

/**
 * La seule définition des étapes de l'entonnoir pour un tirage. Seules les correspondances certaines comptent : une
 * correspondance probable est montrée « à revoir », jamais comptée — en cas de doute, on ne compte pas.
 */
export const outcomeOf = (draw: DrawEvidence): DrawOutcome => {
  const certain = draw.match !== null && draw.match.type === "certain";
  return {
    engine: draw.engine,
    jdId: draw.jdId,
    retrieved: draw.retrieved,
    named: certain,
    top5: certain && draw.match !== null && draw.match.rank !== null && draw.match.rank <= 5,
    cited: draw.clientCitations > 0 || (certain && draw.match !== null && draw.match.clientUrlCited),
  };
};

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
