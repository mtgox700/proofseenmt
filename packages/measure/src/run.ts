import { EXTRACTOR_COST_ESTIMATE_USD, planDraws, promptForStep, stepWorstCaseUsd, type DrawStep, type EngineId, type Identity } from "@proofseen/core";
import { assertCanSpend, BudgetExceededError, createBudget, type EngineAdapter } from "@proofseen/engines";
import { analyzeAnswer } from "@proofseen/extract";
import { funnel, outcomeOf, type DrawEvidence, type EngineFunnel } from "@proofseen/stats";
import type { MeasurementKit } from "./kit";
import { MAX_MEASUREMENT_USD, measurementManifest } from "./plan";
import { subjectOf, type MeasuredProfile, type SubjectRefusal } from "./subject";

/*
 * Une mesure de visibilité, entièrement en mémoire : aucun fichier, aucune réponse brute conservée.
 *
 * Même chaîne que la CLI, pièce par pièce : le plan des tirages et la question viennent de `core/plan`, l'analyse de
 * `analyzeAnswer`, les étapes de l'entonnoir de `outcomeOf` et `funnel`. La réponse d'un moteur ne vit que le temps de
 * son analyse ; seuls les booléens de l'entonnoir en sortent.
 *
 * Plafond dur, comme une vague de la CLI : le pire cas de la mesure entière est vérifié AVANT de commencer, puis le pire
 * cas de chaque étape avant de la lancer. Les étapes tournent à quelques-unes en parallèle ; la borne des étapes en vol
 * est réservée, de sorte que la dépense ne peut jamais dépasser le plafond, même si toutes répondent au pire.
 */

/** Étapes menées en parallèle : une mesure tient en quelques minutes au lieu d'une dizaine. */
const STEP_CONCURRENCY = 2;

export type MeasureRefusal = SubjectRefusal | "not_published" | "over_budget";

export type MeasureOutcome =
  | { readonly kind: "refused"; readonly code: MeasureRefusal }
  | { readonly kind: "failed"; readonly code: "no_answers"; readonly spentUsd: number; readonly engines: readonly EngineId[] }
  | {
      readonly kind: "measured";
      readonly engines: readonly EngineId[];
      readonly measuredAt: Date;
      /** Tirages réussis : ceux que l'entonnoir compte. */
      readonly draws: number;
      readonly attempted: number;
      readonly errors: number;
      readonly funnel: readonly EngineFunnel[];
      readonly spentUsd: number;
      /** Raison de l'arrêt si le plafond a coupé la mesure avant la fin. */
      readonly stoppedReason: string | null;
    };

export interface MeasureInput {
  readonly profile: MeasuredProfile & { readonly published: boolean };
  readonly kit: MeasurementKit;
  readonly now: () => Date;
}

interface DrawResult {
  readonly costUsd: number;
  readonly evidence: DrawEvidence | null;
}

/** Un tirage : question, réponse, analyse en mémoire. Une erreur devient un tirage en échec, jamais une exception. */
const drawOne = async (step: DrawStep, engine: EngineId, adapter: EngineAdapter, identity: Identity, kit: MeasurementKit): Promise<DrawResult> => {
  let answerCost = 0;
  try {
    const answer = await adapter.runDraw(promptForStep(step));
    // Facturé dès que le moteur a répondu, même si l'analyse échoue ensuite.
    answerCost = answer.costUsd;
    const analysis = await analyzeAnswer({ answer, identity, extract: kit.extract });
    return {
      costUsd: answerCost + EXTRACTOR_COST_ESTIMATE_USD,
      evidence: { engine, jdId: step.jd.id, retrieved: analysis.outcome.retrieved, clientCitations: analysis.citedDomains.client, match: analysis.outcome.match },
    };
  } catch {
    return { costUsd: answerCost, evidence: null };
  }
};

export const runMeasurement = async ({ profile, kit, now }: MeasureInput): Promise<MeasureOutcome> => {
  if (!profile.published) return { kind: "refused", code: "not_published" };
  const subject = subjectOf(profile);
  if ("refusal" in subject) return { kind: "refused", code: subject.refusal };
  const manifest = measurementManifest({ reference: profile.reference, engines: kit.engines, jobDescription: subject.jobDescription, now: now() });
  if (manifest.costCapUsd > MAX_MEASUREMENT_USD) return { kind: "refused", code: "over_budget" };

  const engines = manifest.engines;
  const steps = planDraws(manifest);
  const stepWorst = stepWorstCaseUsd(engines);
  const budget = createBudget(manifest.costCapUsd);
  const evidence: DrawEvidence[] = [];
  let spent = 0;
  let reserved = 0;
  let attempted = 0;
  let next = 0;
  let stoppedReason: string | null = null;

  const worker = async (): Promise<void> => {
    while (stoppedReason === null && next < steps.length) {
      const step = steps[next];
      next += 1;
      if (step === undefined) break;
      try {
        assertCanSpend({ ...budget, spentUsd: spent + reserved }, stepWorst);
      } catch (error) {
        if (!(error instanceof BudgetExceededError)) throw error;
        stoppedReason = error.message;
        break;
      }
      reserved += stepWorst;
      try {
        const results = await Promise.all(
          engines.map((engine) => {
            const adapter = kit.adapters[engine];
            return adapter === undefined ? Promise.resolve({ costUsd: 0, evidence: null }) : drawOne(step, engine, adapter, subject.identity, kit);
          }),
        );
        for (const result of results) {
          spent += result.costUsd;
          attempted += 1;
          if (result.evidence !== null) evidence.push(result.evidence);
        }
      } finally {
        reserved -= stepWorst;
      }
    }
  };
  await Promise.all(Array.from({ length: STEP_CONCURRENCY }, worker));

  const spentUsd = Math.round(spent * 1e6) / 1e6;
  // Toutes les offres d'une mesure sont des offres cibles : l'entonnoir les compte toutes, comme le rapport client.
  const engineFunnel = funnel(evidence.map(outcomeOf));
  if (engineFunnel.length === 0) return { kind: "failed", code: "no_answers", spentUsd, engines };
  return {
    kind: "measured",
    engines,
    measuredAt: now(),
    draws: evidence.length,
    attempted,
    errors: attempted - evidence.length,
    funnel: engineFunnel,
    spentUsd,
    stoppedReason,
  };
};
