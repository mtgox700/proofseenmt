import type { EngineFunnel, StageCount } from "@proofseen/stats";

/*
 * Comparaison de deux mesures du même profil (offre « clé en main » : une mesure de départ, puis une re-mesure à
 * 45 jours, « avec le même protocole pour que la comparaison soit valable »).
 *
 * Le piège que ce fichier existe pour éviter : **s'attribuer un écart qu'on ne peut pas attribuer.** Entre deux
 * mesures, deux choses ont pu bouger — le profil du client, et les moteurs eux-mêmes. Annoncer « vous êtes passé de
 * 2 % à 8 % » sans le dire, c'est vendre comme un résultat ce qui peut être une dérive.
 *
 * Les offres **témoins** servent exactement à ça : elles ne correspondent au client ni avant ni après. Si leur taux
 * bouge, ce sont les moteurs qui ont changé. L'écart du client est donc toujours présenté **avec** celui des témoins.
 */

export type FunnelStage = "retrieved" | "named" | "top5" | "cited";

export interface StageComparison {
  readonly stage: FunnelStage;
  readonly before: { readonly successes: number; readonly draws: number };
  readonly after: { readonly successes: number; readonly draws: number };
  /** Écart des taux, en points. Positif = en hausse. */
  readonly delta: number;
}

export interface ComparisonInput {
  readonly before: readonly EngineFunnel[];
  readonly after: readonly EngineFunnel[];
  /** Dérive mesurée sur les offres témoins : `null` si elle n'a pas pu être calculée. */
  readonly controlDrift: { readonly delta: number; readonly flagged: boolean } | null;
}

export interface Comparison {
  readonly stages: readonly StageComparison[];
  readonly controlDrift: ComparisonInput["controlDrift"];
  /**
   * Ce que la comparaison autorise à dire.
   * - `attributable` : le client a bougé et les témoins non — l'écart lui revient, sous réserve d'usage.
   * - `confounded` : les moteurs ont bougé aussi — une partie de l'écart ne vient pas de lui.
   * - `flat` : rien n'a bougé de façon lisible.
   * - `unknown` : la dérive n'a pas pu être mesurée, donc rien n'est attribuable.
   */
  readonly verdict: "attributable" | "confounded" | "flat" | "unknown";
}

/** En deçà, l'écart du client n'est pas lisible : on ne raconte pas une histoire sur du bruit. */
export const MEANINGFUL_DELTA = 0.02;

const pick = (engine: EngineFunnel, stage: FunnelStage): StageCount =>
  stage === "retrieved" ? engine.retrieved : stage === "named" ? engine.named : stage === "top5" ? engine.top5 : engine.cited;

const total = (funnel: readonly EngineFunnel[], stage: FunnelStage) => ({
  successes: funnel.reduce((sum, engine) => sum + pick(engine, stage).successes, 0),
  draws: funnel.reduce((sum, engine) => sum + engine.draws, 0),
});

const rate = (counts: { successes: number; draws: number }): number => (counts.draws === 0 ? 0 : counts.successes / counts.draws);

const STAGES: readonly FunnelStage[] = ["retrieved", "named", "top5", "cited"];

/**
 * Compare deux mesures. Le verdict ne dit jamais « grâce à nous » : il dit ce que les chiffres permettent de
 * distinguer, et se tait quand ils ne permettent rien.
 */
export const compareWaves = ({ before, after, controlDrift }: ComparisonInput): Comparison => {
  if (before.length === 0 || after.length === 0) throw new Error("comparaison impossible : une des deux mesures ne porte aucun moteur");

  const stages = STAGES.map((stage) => {
    const from = total(before, stage);
    const to = total(after, stage);
    return { stage, before: from, after: to, delta: Math.round((rate(to) - rate(from)) * 1e6) / 1e6 };
  });

  const moved = stages.some((stage) => Math.abs(stage.delta) >= MEANINGFUL_DELTA);
  if (controlDrift === null) return { stages, controlDrift, verdict: "unknown" };
  if (!moved) return { stages, controlDrift, verdict: "flat" };
  return { stages, controlDrift, verdict: controlDrift.flagged ? "confounded" : "attributable" };
};
