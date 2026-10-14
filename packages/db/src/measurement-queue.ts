import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { ProofMethod, WorkMode } from "./generated/enums";

/*
 * La file des mesures, vue de la tâche planifiée : prise en charge sous bail, plafonds de dépense de la plateforme.
 *
 * Une mesure coûte de l'argent réel. Deux exécutions qui se chevauchent ne doivent donc jamais mesurer deux fois la
 * même demande, ni dépasser ensemble un plafond que chacune respecte seule. La prise en charge se fait sous un verrou
 * consultatif de transaction : une seule exécution à la fois calcule ce qui reste sous les plafonds et réserve, pour
 * chaque demande prise, son plafond dur (le pire cas). La réserve reste comptée tant que la demande tourne.
 *
 * Un bail expiré signifie que l'exécution est morte sans bilan : sa dépense est inconnue, elle est donc comptée à son
 * pire cas. Surestimer bloque la file un peu plus tôt ; sous-estimer laisserait passer une dépense non voulue.
 */

/** Au-delà, la demande est abandonnée : trois échecs de suite disent un problème que réessayer ne réglera pas. */
export const MEASUREMENT_MAX_ATTEMPTS = 3;
/** Bail d'une mesure prise en charge : largement plus que sa durée attendue (quelques minutes). */
export const MEASUREMENT_LEASE_MS = 30 * 60_000;
/** Attente avant chaque nouvelle tentative : 15 min, puis 2 h. */
const BACKOFF_MS = [15 * 60_000, 2 * 60 * 60_000] as const;
/** Clé du verrou consultatif qui sérialise les prises en charge (valeur arbitraire, propre à cette file). */
const CLAIM_LOCK_KEY = 4_213_013;
const DAY_MS = 86_400_000;

export const ClaimPlanSchema = z.object({
  /** Moteurs qui seront interrogés : ceux dont la clé est configurée. */
  engines: z.array(z.enum(["openai", "anthropic", "perplexity"])).min(1).max(3),
  /** Plafond dur d'une mesure, réservé sur les plafonds de la plateforme pendant qu'elle tourne. */
  reserveCents: z.number().int().positive(),
  /** Plafond de dépense sur 24 heures glissantes. */
  dailyCapCents: z.number().int().nonnegative(),
  /** Plafond de dépense sur 30 jours glissants. */
  monthlyCapCents: z.number().int().nonnegative(),
});
export type ClaimPlan = z.infer<typeof ClaimPlanSchema>;

/** Tout ce que la mesure doit savoir du profil, lu au moment de la prise en charge (jamais d'après la demande). */
export interface ClaimedMeasurement {
  readonly id: string;
  readonly attempts: number;
  readonly profileId: string;
  readonly reference: string;
  readonly published: boolean;
  readonly displayName: string;
  readonly headline: string | null;
  readonly city: string | null;
  readonly workMode: WorkMode;
  readonly skills: readonly string[];
  readonly verifiedUrls: readonly { readonly url: string; readonly proofMethod: ProofMethod; readonly verifiedAt: Date }[];
}

export interface ClaimResult {
  readonly claimed: readonly ClaimedMeasurement[];
  /** Des demandes attendent mais un plafond de la plateforme est atteint : elles restent en file. */
  readonly held: "daily_cap" | "monthly_cap" | null;
}

const IdRow = z.object({ id: z.string() });

/** Les baux expirés : la demande repart en file (ou est abandonnée), sa dépense inconnue comptée au pire cas. */
const reclaimExpired = async (tx: Prisma.TransactionClient, now: Date): Promise<void> => {
  const expired = await tx.measurementRequest.findMany({
    where: { status: "running", leasedUntil: { lte: now } },
    select: { id: true, attempts: true, costCents: true, estimatedCostCents: true },
  });
  for (const row of expired) {
    const exhausted = row.attempts >= MEASUREMENT_MAX_ATTEMPTS;
    // Gardé par l'état et le bail : une fin enregistrée entre la lecture et l'écriture n'est jamais rouverte.
    await tx.measurementRequest.updateMany({
      where: { id: row.id, status: "running", leasedUntil: { lte: now } },
      data: {
        costCents: (row.costCents ?? 0) + (row.estimatedCostCents ?? 0),
        leasedUntil: null,
        errorCode: "lease_expired",
        ...(exhausted ? { status: "failed", finishedAt: now } : { status: "queued", runAfter: now }),
      },
    });
  }
};

const SpentRow = z.object({ spent: z.number() });

/**
 * Dépense comptée depuis `from` : le réel des essais commencés depuis, plus la réserve de ce qui tourne encore. Une
 * seule requête, donc un seul instantané : une mesure qui se termine pendant le calcul ne peut pas disparaître des deux
 * sommes à la fois (plus en cours, coût pas encore écrit).
 */
const spentSince = async (tx: Prisma.TransactionClient, from: Date): Promise<number> => {
  const [row] = await tx.$queryRaw<unknown[]>`
    SELECT (COALESCE(SUM(CASE WHEN "startedAt" >= ${from} THEN "costCents" END), 0)
          + COALESCE(SUM(CASE WHEN "status" = 'running' THEN "estimatedCostCents" END), 0))::float8 AS "spent"
    FROM "MeasurementRequest"`;
  return SpentRow.parse(row).spent;
};

const details = async (tx: Prisma.TransactionClient, ids: readonly string[]): Promise<ClaimedMeasurement[]> => {
  const rows = await tx.measurementRequest.findMany({
    where: { id: { in: [...ids] } },
    orderBy: [{ runAfter: "asc" }, { id: "asc" }],
    select: {
      id: true,
      attempts: true,
      profile: {
        select: {
          id: true,
          reference: true,
          visibility: true,
          headline: true,
          city: true,
          workMode: true,
          user: { select: { displayName: true } },
          skills: { select: { skill: { select: { label: true } } }, orderBy: { skill: { key: "asc" } } },
          ownedUrls: { where: { verifiedAt: { not: null } }, select: { url: true, proofMethod: true, verifiedAt: true }, orderBy: { verifiedAt: "asc" } },
        },
      },
    },
  });
  return rows.map(({ id, attempts, profile }) => ({
    id,
    attempts,
    profileId: profile.id,
    reference: profile.reference,
    published: profile.visibility !== "private",
    displayName: profile.user.displayName,
    headline: profile.headline,
    city: profile.city,
    workMode: profile.workMode,
    skills: profile.skills.map((s) => s.skill.label),
    verifiedUrls: profile.ownedUrls.flatMap((u) => (u.verifiedAt === null ? [] : [{ url: u.url, proofMethod: u.proofMethod, verifiedAt: u.verifiedAt }])),
  }));
};

/** Prend en charge jusqu'à `limit` demandes prêtes, dans la limite de ce que les plafonds laissent réserver. */
export const claimMeasurements = (db: Db, limit: number, now: Date, rawPlan: ClaimPlan): Promise<ClaimResult> => {
  const plan = ClaimPlanSchema.parse(rawPlan);
  const wanted = Math.min(Math.max(Math.trunc(limit), 0), 10);
  return db.$transaction(async (tx): Promise<ClaimResult> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAIM_LOCK_KEY})`;
    await reclaimExpired(tx, now);
    const ready = await tx.measurementRequest.count({ where: { status: "queued", runAfter: { lte: now } } });
    if (ready === 0 || wanted === 0) return { claimed: [], held: null };

    const [day, month] = await Promise.all([spentSince(tx, new Date(now.getTime() - DAY_MS)), spentSince(tx, new Date(now.getTime() - 30 * DAY_MS))]);
    const roomDay = Math.floor((plan.dailyCapCents - day) / plan.reserveCents);
    const roomMonth = Math.floor((plan.monthlyCapCents - month) / plan.reserveCents);
    const room = Math.min(wanted, roomDay, roomMonth);
    if (room <= 0) return { claimed: [], held: roomDay <= 0 ? "daily_cap" : "monthly_cap" };

    const picked = (
      await tx.$queryRaw<unknown[]>`
        SELECT "id"::text AS "id" FROM "MeasurementRequest"
        WHERE "status" = 'queued' AND "runAfter" <= ${now}
        ORDER BY "runAfter", "id"
        LIMIT ${room}
        FOR UPDATE SKIP LOCKED`
    ).map((row) => IdRow.parse(row).id);
    if (picked.length === 0) return { claimed: [], held: null };

    await tx.measurementRequest.updateMany({
      where: { id: { in: picked } },
      data: {
        status: "running",
        leasedUntil: new Date(now.getTime() + MEASUREMENT_LEASE_MS),
        attempts: { increment: 1 },
        startedAt: now,
        estimatedCostCents: plan.reserveCents,
        engines: [...plan.engines],
        errorCode: null,
      },
    });
    return { claimed: await details(tx, picked), held: null };
  });
};

/** Attente avant la tentative suivante, selon le nombre d'essais déjà faits. */
export const backoffAfter = (attempts: number): number => BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1] ?? BACKOFF_MS[0];
