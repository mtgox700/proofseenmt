import { assertOperator, type Operator } from "./back-office";
import type { Db } from "./client";
import { funnel, type Cohort, type Funnel } from "./funnel";
import { spentSince } from "./measurement-ledger";

/*
 * Chiffres de l'opérateur (C19), en lecture seule : l'entonnoir de la marketplace sur une période, et la dépense des
 * mesures de visibilité lue dans le registre (`MeasurementSpend`), avec la profondeur de la file. Rien ne se pilote
 * d'ici : les plafonds restent ceux de la configuration du serveur.
 */

const DAY_MS = 86_400_000;

export interface MeasurementOversight {
  /** Centimes de dollar, depuis minuit (UTC) et depuis le premier du mois (UTC). */
  readonly spentTodayCents: number;
  readonly spentMonthCents: number;
  /** Les fenêtres glissantes qu'appliquent les plafonds : 24 heures et 30 jours. */
  readonly spentLastDayCents: number;
  readonly spentLast30DaysCents: number;
  readonly queued: number;
  readonly running: number;
  readonly failedLastDay: number;
}

export interface OperatorStats {
  funnel(cohort: Cohort): Promise<Funnel>;
  measurements(now: Date): Promise<MeasurementOversight>;
}

const startOfDay = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const startOfMonth = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export const operatorStats = (db: Db, operator: Operator): OperatorStats => {
  assertOperator(operator);
  return {
    funnel: (cohort) => funnel(db).measure(cohort),

    async measurements(now) {
      const dayAgo = new Date(now.getTime() - DAY_MS);
      const [spentTodayCents, spentMonthCents, spentLastDayCents, spentLast30DaysCents, queued, running, failedLastDay] = await Promise.all([
        spentSince(db, startOfDay(now)),
        spentSince(db, startOfMonth(now)),
        spentSince(db, dayAgo),
        spentSince(db, new Date(now.getTime() - 30 * DAY_MS)),
        db.measurementRequest.count({ where: { status: "queued" } }),
        db.measurementRequest.count({ where: { status: "running" } }),
        db.measurementRequest.count({ where: { status: "failed", finishedAt: { gte: dayAgo } } }),
      ]);
      return { spentTodayCents, spentMonthCents, spentLastDayCents, spentLast30DaysCents, queued, running, failedLastDay };
    },
  };
};
