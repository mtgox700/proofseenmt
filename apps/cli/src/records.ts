import { z } from "zod";
import { DrawRecordSchema, MatchSchema } from "@proofseen/core";

export const WaveMetaSchema = z.object({
  waveId: z.string(),
  dryRun: z.boolean(),
  manifestSha256: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  spentUsd: z.number(),
  draws: z.number().int(),
  errors: z.number().int(),
  stoppedReason: z.string().nullable(),
});
export type WaveMeta = z.infer<typeof WaveMetaSchema>;

/** A draw record plus the context the report needs (JD role/source, prompt). */
export const StoredDrawSchema = DrawRecordSchema.extend({
  jdRole: z.enum(["target", "control"]),
  jdSource: z.enum(["market", "client"]),
  extractionFailed: z.boolean(),
  extractionError: z.string().max(80).nullable(),
});
export type StoredDraw = z.infer<typeof StoredDrawSchema>;

export const StoredMatchSchema = MatchSchema;

/** Outcome of one arm of the three-arm test on one draw (packages/extract/src/arms.ts). */
export const ArmRecordSchema = z.object({
  drawId: z.string().min(1),
  armId: z.string().min(1),
  retrieved: z.boolean(),
  cited: z.boolean(),
  type: z.enum(["certain", "probable"]).nullable(),
  rank: z.number().int().positive().nullable(),
  needsReview: z.boolean(),
});
export type ArmRecord = z.infer<typeof ArmRecordSchema>;

export const RescoreRecordSchema = z.object({
  drawId: z.string(),
  named: z.boolean(),
  rank: z.number().int().positive().nullable(),
  type: z.enum(["certain", "probable"]).nullable(),
});
export type RescoreRecord = z.infer<typeof RescoreRecordSchema>;

export const drawIdFor = (waveId: string, engine: string, jdId: string, promptId: string, index: number): string =>
  `${waveId.replace(/[^A-Za-z0-9_-]/g, "_")}-${engine}-${jdId}-${promptId}-${index}`;
