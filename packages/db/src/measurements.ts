import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { MeasurementStatus } from "./generated/enums";
import { checkEligibility, refused, type Eligibility } from "./measurement-eligibility";
import { settleSpend, type RunRef } from "./measurement-ledger";
import { backoffAfter, claimMeasurements, MEASUREMENT_MAX_ATTEMPTS, type ClaimPlan, type ClaimResult } from "./measurement-queue";
import type { Actor } from "./messaging";
import { visibility } from "./visibility";

export {
  MEASUREMENT_MIN_ACCOUNT_AGE_HOURS,
  MEASUREMENT_QUEUE_MAX,
  MEASUREMENT_WINDOW_DAYS,
  MEASUREMENTS_PER_WINDOW,
  type Eligibility,
  type MeasurementRefusal,
} from "./measurement-eligibility";
export type { RunRef } from "./measurement-ledger";

/*
 * Mesures de visibilité demandées par le freelance depuis l'application.
 *
 * Qui peut demander, et les limites qui bornent la dépense de la plateforme : `measurement-eligibility`. La dépense
 * elle-même est tenue dans un registre qui survit à l'effacement des comptes : `measurement-ledger`.
 *
 * Les accès sont contrôlés dans les requêtes : on ne demande, on ne liste que pour le profil de l'acteur. Une fin, un
 * échec ou un refus ne valent que pour l'essai qu'ils terminent (`RunRef`) : une exécution périmée, dont le bail a
 * expiré et dont la demande a été reprise, ne clôt jamais l'essai suivant.
 *
 * Le résultat passe par le chemin d'enregistrement existant des vagues (`visibility(db).record`) : une mesure faite
 * depuis l'application et une vague importée par la CLI aboutissent aux mêmes lignes, lues par le même écran.
 */

/** Les fournisseurs facturent en dollars : les montants des mesures sont en centimes de dollar. */
export const MEASUREMENT_CURRENCY = "USD";
/** Clé du verrou consultatif qui sérialise les demandes : la limite de file de la plateforme tient sous la concurrence. */
const REQUEST_LOCK_KEY = 4_213_014;

export type RequestResult = { readonly kind: "queued"; readonly id: string } | Extract<Eligibility, { kind: "refused" }>;

export interface MeasurementView {
  readonly id: string;
  readonly status: MeasurementStatus;
  readonly engines: readonly string[];
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
  readonly errorCode: string | null;
  readonly waveId: string | null;
}

const Stage = z.object({ successes: z.number().int().min(0) });

export const CompletionSchema = z.object({
  measuredAt: z.date(),
  /** Tirages réussis, ceux que l'entonnoir compte. */
  draws: z.number().int().min(0),
  engines: z.array(z.enum(["openai", "anthropic", "perplexity"])).min(1).max(3),
  funnel: z
    .array(z.object({ engine: z.string(), draws: z.number().int().min(0), retrieved: Stage, named: Stage, top5: Stage, cited: Stage }))
    .min(1),
  /** Dépense de cet essai, en centimes de dollar. */
  costCents: z.number().int().min(0),
  /** Le plafond dur a arrêté la mesure avant la fin : la vague est gardée, et la demande le dit. */
  stoppedEarly: z.boolean(),
});
export type Completion = z.infer<typeof CompletionSchema>;

const CodeSchema = z.string().regex(/^[a-z0-9_:.-]{1,80}$/);

export interface Measurements {
  /** Dit si l'acteur peut demander une mesure maintenant, et sinon pourquoi. */
  eligibility(actor: Actor, now: Date): Promise<Eligibility>;
  /** Met une mesure en file pour le profil de l'acteur, ou dit pourquoi elle est refusée. */
  request(actor: Actor, now: Date): Promise<RequestResult>;
  /** Les dernières demandes du profil de l'acteur, la plus récente d'abord. */
  listMine(actor: Actor, limit?: number): Promise<readonly MeasurementView[]>;
  /** Prise en charge par la tâche planifiée, sous bail et dans la limite des plafonds de la plateforme. */
  claim(limit: number, now: Date, plan: ClaimPlan): Promise<ClaimResult>;
  /** Enregistre la vague de l'essai `run` ; « not_running » si cet essai n'est plus en cours. */
  complete(run: RunRef, completion: Completion, now: Date): Promise<"done" | "not_running">;
  /** Échec de l'essai `run` : nouvelle tentative plus tard si `retry` et qu'il en reste, abandon sinon. Dépense cumulée. */
  fail(run: RunRef, failure: { readonly code: string; readonly costCents: number; readonly retry: boolean }, now: Date): Promise<void>;
  /** Refus au moment de mesurer (profil dépublié, plus d'adresse prouvée…) : définitif, sans nouvelle tentative. */
  refuse(run: RunRef, refusal: { readonly code: string; readonly costCents: number }, now: Date): Promise<void>;
}

/** Identifiant de la vague produite par une demande : stable, donc un enregistrement rejoué remplace au lieu d'ajouter. */
export const measurementWaveId = (requestId: string): string => `MEASURE-${requestId}`;

const Uuid = z.uuid();

/** L'essai encore en cours, et seulement lui : une exécution périmée ne retrouve pas la demande reprise depuis. */
const current = (run: RunRef) => ({ id: run.id, status: "running" as const, attempts: run.attempts });

export const measurements = (db: Db): Measurements => ({
  async eligibility(actor, now) {
    const result = await checkEligibility(db, actor.userId, now);
    return result.kind === "allowed" ? { kind: "allowed", remaining: result.remaining } : result;
  },

  async request(actor, now) {
    if (!Uuid.safeParse(actor.userId).success) return refused("no_profile");
    try {
      return await db.$transaction(async (tx): Promise<RequestResult> => {
        // Les demandes passent une à une : la limite de file de la plateforme ne se dépasse pas à plusieurs.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REQUEST_LOCK_KEY})`;
        // Verrou du profil : deux clics simultanés attendent leur tour au lieu de passer tous les deux le contrôle.
        await tx.$queryRaw`SELECT "id" FROM "FreelanceProfile" WHERE "userId" = ${actor.userId}::uuid FOR UPDATE`;
        const result = await checkEligibility(tx, actor.userId, now);
        if (result.kind === "refused") return result;
        if (result.profileId === undefined) return refused("no_profile");
        const { id } = await tx.measurementRequest.create({
          data: { profileId: result.profileId, requestedByUserId: actor.userId, runAfter: now, createdAt: now },
          select: { id: true },
        });
        return { kind: "queued", id };
      });
    } catch (error) {
      // L'index unique partiel a refusé une seconde demande active : même réponse que le contrôle.
      if (isUniqueViolation(error)) return refused("already_active");
      throw error;
    }
  },

  async listMine(actor, limit = 10) {
    const rows = await db.measurementRequest.findMany({
      where: { profile: { userId: actor.userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(Math.trunc(limit), 1), 50),
      select: { id: true, status: true, engines: true, createdAt: true, finishedAt: true, errorCode: true, wave: { select: { waveId: true } } },
    });
    return rows.map(({ wave, ...row }) => ({ ...row, waveId: wave?.waveId ?? null }));
  },

  claim(limit, now, plan) {
    return claimMeasurements(db, limit, now, plan);
  },

  async complete(run, raw, now) {
    if (!Uuid.safeParse(run.id).success) return "not_running";
    const completion = CompletionSchema.parse(raw);
    // Au registre d'abord : la dépense réelle y est inscrite même si la demande est partie avec son compte.
    await settleSpend(db, run, completion.costCents, now);
    const row = await db.measurementRequest.findFirst({ where: current(run), select: { costCents: true, profile: { select: { reference: true } } } });
    if (row === null) return "not_running";
    const costCents = (row.costCents ?? 0) + completion.costCents;
    const waveId = measurementWaveId(run.id);
    await visibility(db).record({
      waveId,
      reference: row.profile.reference,
      measuredAt: completion.measuredAt,
      draws: completion.draws,
      costCents,
      currency: MEASUREMENT_CURRENCY,
      funnel: completion.funnel,
    });
    const wave = await db.wave.findUniqueOrThrow({ where: { waveId }, select: { id: true } });
    const { count } = await db.measurementRequest.updateMany({
      where: current(run),
      data: {
        status: "done",
        finishedAt: now,
        leasedUntil: null,
        costCents,
        waveRefId: wave.id,
        engines: [...completion.engines],
        errorCode: completion.stoppedEarly ? "budget_stopped" : null,
      },
    });
    return count === 1 ? "done" : "not_running";
  },

  async fail(run, failure, now) {
    if (!Uuid.safeParse(run.id).success) return;
    const code = CodeSchema.parse(failure.code);
    const spent = Math.max(0, Math.round(failure.costCents));
    await settleSpend(db, run, spent, now);
    const row = await db.measurementRequest.findFirst({ where: current(run), select: { attempts: true, costCents: true } });
    if (row === null) return;
    const again = failure.retry && row.attempts < MEASUREMENT_MAX_ATTEMPTS;
    // Le coût nul en base devient zéro avant l'incrément : `increment` sur NULL resterait NULL.
    if (row.costCents === null) await db.measurementRequest.updateMany({ where: { id: run.id, costCents: null }, data: { costCents: 0 } });
    await db.measurementRequest.updateMany({
      where: current(run),
      data: {
        costCents: { increment: spent },
        errorCode: code,
        leasedUntil: null,
        ...(again ? { status: "queued", runAfter: new Date(now.getTime() + backoffAfter(row.attempts)) } : { status: "failed", finishedAt: now }),
      },
    });
  },

  async refuse(run, refusal, now) {
    if (!Uuid.safeParse(run.id).success) return;
    const code = CodeSchema.parse(refusal.code);
    const spent = Math.max(0, Math.round(refusal.costCents));
    await settleSpend(db, run, spent, now);
    const row = await db.measurementRequest.findFirst({ where: current(run), select: { costCents: true } });
    if (row === null) return;
    if (row.costCents === null) await db.measurementRequest.updateMany({ where: { id: run.id, costCents: null }, data: { costCents: 0 } });
    await db.measurementRequest.updateMany({
      where: current(run),
      data: { status: "refused", errorCode: code, finishedAt: now, leasedUntil: null, costCents: { increment: spent } },
    });
  },
});
