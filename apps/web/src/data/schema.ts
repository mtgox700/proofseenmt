import { z } from "zod";

/* Boundary check of the one snapshot file the landing reads: the answers of the founder's J0 wave. */

export const AnswersSnapshotSchema = z.object({
  waveId: z.string(),
  engines: z.array(z.enum(["openai", "anthropic", "perplexity"])).length(3),
  offers: z.record(z.string(), z.string()),
  answers: z.array(
    z.object({
      engine: z.number().int().min(0).max(2),
      offer: z.string(),
      control: z.boolean(),
      category: z.enum(["you", "malt", "linkedin", "code", "platform", "other", "none"]),
      // Platform domains only (REQ-M2-05): anything else is a count, never a value.
      domains: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)),
      other: z.number().int().nonnegative(),
    }),
  ),
});

export type AnswersSnapshot = z.infer<typeof AnswersSnapshotSchema>;
