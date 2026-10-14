import { AUDIT_PROTOCOL, ManifestSchema, worstCaseUsd, type EngineId, type JobDescription, type Manifest } from "@proofseen/core";

/*
 * Le manifeste d'une mesure lancée depuis l'application, et ce qu'elle peut coûter.
 *
 * L'instrument est celui du protocole (`AUDIT_PROTOCOL`) : mêmes quatre formulations, mêmes modèles, cinq tirages par
 * cellule. Deux différences assumées avec un audit :
 * - **une seule offre, sans offre témoin.** L'entonnoir publié ne compte que les offres cibles ; une offre témoin
 *   doublerait la dépense sans changer un seul chiffre affiché au freelance ;
 * - **seuls les moteurs configurés** : une vague dit les moteurs qu'elle a réellement interrogés, jamais ceux du
 *   protocole qu'elle n'a pas pu joindre.
 *
 * Le plafond dur d'une mesure est son pire cas (bornes `WORST_CASE_DRAW_USD` du protocole, extraction comprise) avec la
 * marge que le protocole applique aux audits : une mesure arrêtée en cours de route serait incomplète.
 */

/** Marge au-dessus du pire cas, la même que celle des audits (`COST_CAP_MARGIN` du protocole). */
const CAP_MARGIN = 1.15;
/** Aucune mesure ne part si son plafond dur dépasse ce montant : garde-fou contre un changement de protocole. */
export const MAX_MEASUREMENT_USD = 10;

/** Identifiant de vague accepté par le manifeste (32 caractères au plus). */
const manifestWaveId = (reference: string): string => `APP-${reference}`.replace(/[^A-Za-z0-9+_-]/g, "-").slice(0, 32);

/** Le manifeste qu'aurait un audit d'une offre, réduit aux moteurs configurés. Figé : le protocole l'est dans le code. */
export const measurementManifest = (input: { readonly reference: string; readonly engines: readonly EngineId[]; readonly jobDescription: JobDescription; readonly now: Date }): Manifest => {
  const engines = AUDIT_PROTOCOL.engines.filter((engine) => input.engines.includes(engine));
  const draft = {
    version: 1 as const,
    waveId: manifestWaveId(input.reference),
    frozenAt: input.now.toISOString(),
    engines,
    models: Object.fromEntries(engines.map((engine) => [engine, AUDIT_PROTOCOL.models[engine]])),
    drawsPerCell: AUDIT_PROTOCOL.drawsPerCell,
    costCapUsd: MAX_MEASUREMENT_USD,
    jobDescriptions: [input.jobDescription],
    prompts: AUDIT_PROTOCOL.prompts.map((prompt) => ({ ...prompt })),
  };
  const capUsd = capFor(ManifestSchema.parse(draft));
  return ManifestSchema.parse({ ...draft, costCapUsd: capUsd });
};

const capFor = (manifest: Manifest): number => Math.ceil(worstCaseUsd(manifest) * CAP_MARGIN * 100) / 100;

/** Plafond dur d'une mesure pour ces moteurs, en dollars : ce que la plateforme réserve avant de la lancer. */
export const measurementCapUsd = (engines: readonly EngineId[]): number => {
  const probe = { id: "T01", lang: "fr" as const, role: "target" as const, source: "client" as const, text: "Mission freelance de référence pour le calcul du plafond.", brief: "un ou une freelance" };
  return capFor(measurementManifest({ reference: "FR-PLAFOND", engines, jobDescription: probe, now: new Date(0) }));
};
