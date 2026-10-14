import { sanitizeJobDescription } from "./jd";
import { renderPrompt } from "./prompt";
import { EXTRACTOR_COST_ESTIMATE_USD, WORST_CASE_DRAW_USD } from "./protocol";
import type { EngineId, JobDescription, Manifest, PromptTemplate } from "./schemas";

/*
 * Le déroulé d'une vague, partagé par la CLI (vague sur disque) et la mesure lancée depuis l'application (vague en
 * mémoire). Deux exécutants, un seul plan : l'ordre des tirages, la question posée et la borne de dépense d'une étape
 * viennent d'ici, pour qu'une mesure faite depuis l'application soit la même mesure que celle d'un audit.
 */

/** Une étape : une offre, une formulation, un rang de tirage. Chaque moteur de la vague y répond une fois. */
export interface DrawStep {
  readonly jd: JobDescription;
  readonly prompt: PromptTemplate;
  readonly index: number;
}

/** Les étapes d'une vague, dans l'ordre où elles sont tirées : offre, puis formulation, puis rang. */
export const planDraws = (manifest: Manifest): DrawStep[] =>
  manifest.jobDescriptions.flatMap((jd) =>
    manifest.prompts.flatMap((prompt) => Array.from({ length: manifest.drawsPerCell }, (_, index) => ({ jd, prompt, index }))),
  );

/** La question envoyée aux moteurs pour une étape : l'offre nettoyée de tout contact, jamais l'identité du client. */
export const promptForStep = (step: DrawStep): string =>
  renderPrompt(step.prompt, { jd: sanitizeJobDescription(step.jd.text), brief: step.jd.brief });

/**
 * Ce qu'une étape peut coûter au pire, extraction comprise, pour les moteurs qui y répondent encore. C'est cette borne
 * que le plafond dur vérifie AVANT chaque étape : une étape ne part que si son pire cas tient sous le plafond.
 */
export const stepWorstCaseUsd = (engines: readonly EngineId[]): number =>
  engines.reduce((sum, engine) => sum + WORST_CASE_DRAW_USD[engine] + EXTRACTOR_COST_ESTIMATE_USD, 0);
