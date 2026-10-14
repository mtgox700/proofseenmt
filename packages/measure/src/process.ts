import { measurements, type ClaimedMeasurement, type Db } from "@proofseen/db";
import type { MeasurementKit, Env } from "./kit";
import { measurementCapUsd } from "./plan";
import { runMeasurement, type MeasureOutcome } from "./run";

/*
 * Un passage de la tâche planifiée : prendre UNE demande en file, la mesurer, enregistrer le résultat.
 *
 * Les plafonds de la plateforme sont vérifiés avant la prise en charge, dans la même transaction que la réserve (voir
 * `@proofseen/db`, file des mesures) : quand ils sont atteints, les demandes restent en file et partiront plus tard.
 * Une exception inattendue pendant la mesure est comptée à son plafond dur : on ne sait pas ce qui a été dépensé, et
 * sous-estimer laisserait passer une dépense non voulue.
 */

/** Plafonds par défaut, en dollars. Ils laissent passer une mesure sur trois moteurs (pire cas ~8,70 $), pas deux. */
export const DEFAULT_DAILY_USD = 10;
export const DEFAULT_MONTHLY_USD = 50;

export interface PlatformCaps {
  readonly dailyUsd: number;
  readonly monthlyUsd: number;
}

const amountOf = (raw: string | undefined, fallback: number): number => {
  const value = Number((raw ?? "").trim());
  // Zéro est un choix (mettre les mesures en pause) ; une valeur illisible retombe sur le défaut prudent.
  return (raw ?? "").trim() !== "" && Number.isFinite(value) && value >= 0 ? value : fallback;
};

/** `PROOFSEEN_MEASURE_DAILY_USD` et `PROOFSEEN_MEASURE_MONTHLY_USD`, avec des défauts prudents. */
export const capsFromEnv = (env: Env): PlatformCaps => ({
  dailyUsd: amountOf(env.PROOFSEEN_MEASURE_DAILY_USD, DEFAULT_DAILY_USD),
  monthlyUsd: amountOf(env.PROOFSEEN_MEASURE_MONTHLY_USD, DEFAULT_MONTHLY_USD),
});

export const toCents = (usd: number): number => Math.ceil(Math.round(usd * 1e6) / 1e4);

export type ProcessReport =
  | { readonly kind: "idle" }
  | { readonly kind: "held"; readonly cap: "daily_cap" | "monthly_cap" }
  | { readonly kind: "done" | "refused" | "failed"; readonly requestId: string; readonly code: string | null; readonly costCents: number };

export interface ProcessInput {
  readonly db: Db;
  readonly kit: MeasurementKit;
  readonly caps: PlatformCaps;
  readonly now: () => Date;
}

/**
 * Enregistre ce que la mesure a produit. L'argent est déjà dépensé : si l'enregistrement échoue, la demande est close
 * en échec SANS nouvelle tentative — réessayer referait payer une mesure entière pour une erreur d'écriture.
 */
const persist = async (input: ProcessInput, request: ClaimedMeasurement, outcome: MeasureOutcome): Promise<ProcessReport> => {
  const repo = measurements(input.db);
  const report = (kind: "done" | "refused" | "failed", code: string | null, costCents: number): ProcessReport => ({ kind, requestId: request.id, code, costCents });
  const costCents = outcome.kind === "refused" ? 0 : toCents(outcome.spentUsd);
  try {
    if (outcome.kind === "refused") {
      await repo.refuse(request, { code: outcome.code, costCents: 0 }, input.now());
      return report("refused", outcome.code, 0);
    }
    if (outcome.kind === "failed") {
      // Aucune réponse obtenue : l'essai a peu coûté, une nouvelle tentative plus tard a un sens.
      await repo.fail(request, { code: outcome.code, costCents, retry: true }, input.now());
      return report("failed", outcome.code, costCents);
    }
    const stoppedEarly = outcome.stoppedReason !== null;
    await repo.complete(
      request,
      { measuredAt: outcome.measuredAt, draws: outcome.draws, engines: [...outcome.engines], funnel: [...outcome.funnel], costCents, stoppedEarly },
      input.now(),
    );
    return report("done", stoppedEarly ? "budget_stopped" : null, costCents);
  } catch {
    await repo.fail(request, { code: "record_failed", costCents, retry: false }, input.now());
    return report("failed", "record_failed", costCents);
  }
};

const measure = async (input: ProcessInput, request: ClaimedMeasurement, reserveCents: number): Promise<ProcessReport> => {
  let outcome: MeasureOutcome;
  try {
    outcome = await runMeasurement({ profile: request, kit: input.kit, now: input.now });
  } catch {
    // Dépense inconnue : comptée au plafond dur.
    await measurements(input.db).fail(request, { code: "unexpected", costCents: reserveCents, retry: true }, input.now());
    return { kind: "failed", requestId: request.id, code: "unexpected", costCents: reserveCents };
  }
  return persist(input, request, outcome);
};

export type ClaimStep =
  | Extract<ProcessReport, { kind: "idle" | "held" }>
  | { readonly kind: "claimed"; readonly request: ClaimedMeasurement; readonly reserveCents: number };

/**
 * Première moitié d'un passage : prendre au plus une demande, sous bail, si les plafonds le permettent. Séparée de la
 * mesure pour qu'une route puisse répondre aussitôt et mesurer ensuite, sans faire attendre le planificateur.
 */
export const claimNextMeasurement = async (input: ProcessInput): Promise<ClaimStep> => {
  const reserveCents = toCents(measurementCapUsd(input.kit.engines));
  const { claimed, held } = await measurements(input.db).claim(1, input.now(), {
    engines: [...input.kit.engines],
    reserveCents,
    dailyCapCents: toCents(input.caps.dailyUsd),
    monthlyCapCents: toCents(input.caps.monthlyUsd),
  });
  const request = claimed[0];
  if (request === undefined) return held === null ? { kind: "idle" } : { kind: "held", cap: held };
  return { kind: "claimed", request, reserveCents };
};

/**
 * Seconde moitié : mesurer la demande prise en charge et enregistrer ce qu'il en sort. Une erreur de la mesure devient
 * un échec enregistré ; seule une base injoignable fait lever, et le bail rendra alors la demande.
 */
export const measureClaimed = (input: ProcessInput, step: Extract<ClaimStep, { kind: "claimed" }>): Promise<ProcessReport> =>
  measure(input, step.request, step.reserveCents);

/** Mesure au plus une demande. Sans demande prête, ou plafond atteint, ne dépense rien. */
export const processNextMeasurement = async (input: ProcessInput): Promise<ProcessReport> => {
  const step = await claimNextMeasurement(input);
  return step.kind === "claimed" ? measureClaimed(input, step) : step;
};
