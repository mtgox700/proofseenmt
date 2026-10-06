import { z } from "zod";
import type { Db } from "./client";
import type { Actor } from "./messaging";

/*
 * Visibilité mesurée : pour chaque vague, l'entonnoir par moteur (tirages ; page retrouvée, nommée, dans les cinq
 * premiers, citée de façon certaine), tel que le rapport client le publie. Les réponses brutes ne viennent jamais ici :
 * elles restent chiffrées hors base et sont purgées à 72 h.
 *
 * L'enregistrement est idempotent : réimporter une vague remplace ses chiffres, il ne les ajoute pas. Une vague est
 * rattachée au profil dont la référence publique est celle du dossier mesuré ; sans profil correspondant, elle est
 * gardée sans rattachement plutôt que perdue.
 */

const Count = z.number().int().min(0);
const Stage = z.object({ successes: Count });

export const WaveRecordSchema = z
  .object({
    waveId: z.string().min(1).max(120),
    reference: z.string().regex(/^FR-[A-Z2-9]{5,8}$/),
    measuredAt: z.date(),
    draws: Count,
    /** Coût réel s'il est connu ; inconnu vaut nul, jamais zéro. */
    costCents: Count.nullable().default(null),
    currency: z.enum(["EUR", "GBP", "CHF", "USD"]).nullable().default(null),
    funnel: z
      .array(z.object({ engine: z.string().regex(/^[a-z0-9-]{2,40}$/), draws: Count, retrieved: Stage, named: Stage, top5: Stage, cited: Stage }))
      .min(1)
      .max(20),
  })
  .refine((w) => w.funnel.every((f) => [f.retrieved, f.named, f.top5, f.cited].every((s) => s.successes <= f.draws)), {
    message: "une étape compte plus de succès que de tirages",
  });

export type WaveRecord = z.input<typeof WaveRecordSchema>;

export interface EngineResult {
  readonly engine: string;
  readonly draws: number;
  readonly retrieved: number;
  readonly named: number;
  readonly top5: number;
  readonly cited: number;
}

export interface WaveView {
  readonly waveId: string;
  readonly measuredAt: Date;
  readonly draws: number;
  readonly engines: readonly EngineResult[];
}

export interface Visibility {
  /** Enregistre (ou remplace) les résultats d'une vague ; dit si elle a pu être rattachée à un profil. */
  record(wave: WaveRecord): Promise<{ readonly linked: boolean }>;
  /** Les dernières vagues mesurées du profil de l'acteur, la plus récente d'abord. */
  mine(actor: Actor, limit?: number): Promise<readonly WaveView[]>;
}

export const visibility = (db: Db): Visibility => ({
  async record(raw) {
    const wave = WaveRecordSchema.parse(raw);
    const profile = await db.freelanceProfile.findUnique({ where: { reference: wave.reference }, select: { id: true } });
    await db.$transaction(async (tx) => {
      const data = { profileId: profile?.id ?? null, measuredAt: wave.measuredAt, draws: wave.draws, costCents: wave.costCents, currency: wave.currency };
      const row = await tx.wave.upsert({ where: { waveId: wave.waveId }, create: { waveId: wave.waveId, ...data }, update: data, select: { id: true } });
      await tx.visibilityResult.deleteMany({ where: { waveRefId: row.id } });
      await tx.visibilityResult.createMany({
        data: wave.funnel.map((f) => ({
          waveRefId: row.id,
          engine: f.engine,
          draws: f.draws,
          retrieved: f.retrieved.successes,
          named: f.named.successes,
          top5: f.top5.successes,
          cited: f.cited.successes,
        })),
      });
    });
    return { linked: profile !== null };
  },

  async mine(actor, limit = 6) {
    const rows = await db.wave.findMany({
      where: { profile: { userId: actor.userId } },
      orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(limit, 1), 24),
      select: {
        waveId: true,
        measuredAt: true,
        draws: true,
        results: { orderBy: { engine: "asc" }, select: { engine: true, draws: true, retrieved: true, named: true, top5: true, cited: true } },
      },
    });
    return rows.map(({ results, ...wave }) => ({ ...wave, engines: results }));
  },
});
