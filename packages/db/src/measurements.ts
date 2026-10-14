import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { MeasurementStatus } from "./generated/enums";
import { backoffAfter, claimMeasurements, MEASUREMENT_MAX_ATTEMPTS, type ClaimPlan, type ClaimResult } from "./measurement-queue";
import type { Actor } from "./messaging";
import { visibility } from "./visibility";

/*
 * Mesures de visibilité demandées par le freelance depuis l'application.
 *
 * Une demande n'est acceptée que pour un profil **publié** qui a **au moins une adresse prouvée** : sans adresse
 * prouvée, aucune citation ne peut être reconnue comme la sienne, et la mesure dépenserait de l'argent pour un zéro
 * certain. Une seule demande active par profil (garanti aussi par un index unique partiel), et un nombre limité de
 * demandes par période glissante : chaque mesure est payée par la plateforme.
 *
 * Les accès sont contrôlés dans les requêtes : on ne demande, on ne liste que pour le profil de l'acteur.
 *
 * Le résultat passe par le chemin d'enregistrement existant des vagues (`visibility(db).record`) : une mesure faite
 * depuis l'application et une vague importée par la CLI aboutissent aux mêmes lignes, lues par le même écran.
 */

/** Demandes acceptées par profil sur la période glissante. */
export const MEASUREMENTS_PER_WINDOW = 2;
export const MEASUREMENT_WINDOW_DAYS = 30;
/** Les fournisseurs facturent en dollars : les montants des mesures sont en centimes de dollar. */
export const MEASUREMENT_CURRENCY = "USD";
const DAY_MS = 86_400_000;
const COUNTED: readonly MeasurementStatus[] = ["queued", "running", "done"];

export type MeasurementRefusal = "no_profile" | "not_published" | "no_proven_url" | "already_active" | "monthly_limit";

export type Eligibility =
  | { readonly kind: "allowed"; readonly remaining: number }
  | { readonly kind: "refused"; readonly reason: MeasurementRefusal; readonly availableAt: Date | null };

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
  /** Enregistre la vague d'une mesure prise en charge ; « not_running » si la demande n'est plus en cours. */
  complete(id: string, completion: Completion, now: Date): Promise<"done" | "not_running">;
  /** Échec d'un essai : nouvelle tentative plus tard si `retry` et qu'il en reste, abandon sinon. Dépense cumulée. */
  fail(id: string, failure: { readonly code: string; readonly costCents: number; readonly retry: boolean }, now: Date): Promise<void>;
  /** Refus au moment de mesurer (profil dépublié, plus d'adresse prouvée…) : définitif, sans nouvelle tentative. */
  refuse(id: string, refusal: { readonly code: string; readonly costCents: number }, now: Date): Promise<void>;
}

/** Identifiant de la vague produite par une demande : stable, donc un enregistrement rejoué remplace au lieu d'ajouter. */
export const measurementWaveId = (requestId: string): string => `MEASURE-${requestId}`;

const refused = (reason: MeasurementRefusal, availableAt: Date | null = null): Extract<Eligibility, { kind: "refused" }> => ({ kind: "refused", reason, availableAt });

const check = async (client: Prisma.TransactionClient, userId: string, now: Date): Promise<Eligibility & { readonly profileId?: string }> => {
  const profile = await client.freelanceProfile.findUnique({
    where: { userId },
    select: { id: true, visibility: true, ownedUrls: { where: { verifiedAt: { not: null } }, select: { id: true }, take: 1 } },
  });
  if (profile === null) return refused("no_profile");
  if (profile.visibility === "private") return refused("not_published");
  if (profile.ownedUrls.length === 0) return refused("no_proven_url");
  const active = await client.measurementRequest.count({ where: { profileId: profile.id, status: { in: ["queued", "running"] } } });
  if (active > 0) return refused("already_active");
  const since = new Date(now.getTime() - MEASUREMENT_WINDOW_DAYS * DAY_MS);
  const recent = await client.measurementRequest.findMany({
    // Un échec qui a coûté compte aussi : sinon redemander en boucle ferait payer la plateforme sans limite.
    where: { profileId: profile.id, createdAt: { gte: since }, OR: [{ status: { in: [...COUNTED] } }, { status: "failed", costCents: { gt: 0 } }] },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (recent.length >= MEASUREMENTS_PER_WINDOW) {
    // La plus ancienne demande comptée sort de la fenêtre : c'est la date à laquelle une place se libère.
    const oldest = recent[0]?.createdAt ?? now;
    return refused("monthly_limit", new Date(oldest.getTime() + MEASUREMENT_WINDOW_DAYS * DAY_MS));
  }
  return { kind: "allowed", remaining: MEASUREMENTS_PER_WINDOW - recent.length, profileId: profile.id };
};

const Uuid = z.uuid();

export const measurements = (db: Db): Measurements => ({
  async eligibility(actor, now) {
    const result = await check(db, actor.userId, now);
    return result.kind === "allowed" ? { kind: "allowed", remaining: result.remaining } : result;
  },

  async request(actor, now) {
    if (!Uuid.safeParse(actor.userId).success) return refused("no_profile");
    try {
      return await db.$transaction(async (tx): Promise<RequestResult> => {
        // Verrou du profil : deux clics simultanés attendent leur tour au lieu de passer tous les deux le contrôle.
        await tx.$queryRaw`SELECT "id" FROM "FreelanceProfile" WHERE "userId" = ${actor.userId}::uuid FOR UPDATE`;
        const result = await check(tx, actor.userId, now);
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

  async complete(id, raw, now) {
    if (!Uuid.safeParse(id).success) return "not_running";
    const completion = CompletionSchema.parse(raw);
    const row = await db.measurementRequest.findFirst({ where: { id, status: "running" }, select: { costCents: true, profile: { select: { reference: true } } } });
    if (row === null) return "not_running";
    const costCents = (row.costCents ?? 0) + completion.costCents;
    const waveId = measurementWaveId(id);
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
      where: { id, status: "running" },
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

  async fail(id, failure, now) {
    if (!Uuid.safeParse(id).success) return;
    const code = CodeSchema.parse(failure.code);
    const row = await db.measurementRequest.findFirst({ where: { id, status: "running" }, select: { attempts: true, costCents: true } });
    if (row === null) return;
    const again = failure.retry && row.attempts < MEASUREMENT_MAX_ATTEMPTS;
    // Le coût nul en base devient zéro avant l'incrément : `increment` sur NULL resterait NULL.
    if (row.costCents === null) await db.measurementRequest.updateMany({ where: { id, costCents: null }, data: { costCents: 0 } });
    await db.measurementRequest.updateMany({
      where: { id, status: "running" },
      data: {
        costCents: { increment: Math.max(0, Math.round(failure.costCents)) },
        errorCode: code,
        leasedUntil: null,
        ...(again ? { status: "queued", runAfter: new Date(now.getTime() + backoffAfter(row.attempts)) } : { status: "failed", finishedAt: now }),
      },
    });
  },

  async refuse(id, refusal, now) {
    if (!Uuid.safeParse(id).success) return;
    const code = CodeSchema.parse(refusal.code);
    const row = await db.measurementRequest.findFirst({ where: { id, status: "running" }, select: { costCents: true } });
    if (row === null) return;
    if (row.costCents === null) await db.measurementRequest.updateMany({ where: { id, costCents: null }, data: { costCents: 0 } });
    await db.measurementRequest.updateMany({
      where: { id, status: "running" },
      data: { status: "refused", errorCode: code, finishedAt: now, leasedUntil: null, costCents: { increment: Math.max(0, Math.round(refusal.costCents)) } },
    });
  },
});
