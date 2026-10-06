import { PublicProfileSchema } from "@proofseen/profiles";
import { z } from "zod";

/*
 * Boundary check of the snapshot files. The shapes mirror `@proofseen/deliverable` and `@proofseen/stats`; the
 * `satisfies` clauses in file-source.ts make TypeScript fail the build the day one of them drifts from its source.
 */

const IntervalSchema = z.object({ p: z.number().min(0).max(1), low: z.number().min(0).max(1), high: z.number().min(0).max(1) });
const StageCountSchema = z.object({ successes: z.number().int().nonnegative(), interval: IntervalSchema.nullable() });
const EngineSchema = z.enum(["openai", "anthropic", "perplexity"]);
const StageSchema = z.enum(["E1", "E2", "E3", "E4", "E5"]);

export const EngineFunnelSchema = z.object({
  engine: EngineSchema,
  draws: z.number().int().positive(),
  retrieved: StageCountSchema,
  named: StageCountSchema,
  top5: StageCountSchema,
  cited: StageCountSchema,
});

const ActionSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  stage: StageSchema,
  title: z.string(),
  why: z.string(),
  where: z.string(),
  effort: z.enum(["faible", "moyen", "élevé"]),
  evidence: z.string(),
});

const ComparisonSchema = z.object({
  stages: z.array(
    z.object({
      stage: z.enum(["retrieved", "named", "top5", "cited"]),
      before: z.object({ successes: z.number().int(), draws: z.number().int() }),
      after: z.object({ successes: z.number().int(), draws: z.number().int() }),
      delta: z.number(),
    }),
  ),
  controlDrift: z.object({ delta: z.number(), flagged: z.boolean() }).nullable(),
  verdict: z.enum(["attributable", "confounded", "flat", "unknown"]),
});

export const ReportSchema = z.object({
  client: z.object({ displayName: z.string(), reference: z.string() }),
  wave: z.object({
    id: z.string(),
    measuredAt: z.string(),
    models: z.record(z.string(), z.string()),
    draws: z.number().int().positive(),
    manifestDigest: z.string(),
  }),
  jobDescriptions: z.array(
    z.object({ id: z.string(), label: z.string(), provenance: z.enum(["client", "proofseen"]), role: z.enum(["target", "control"]) }),
  ),
  funnel: z.array(EngineFunnelSchema).min(1),
  sourceShare: z.record(z.string(), z.number()),
  indexation: z.object({ pagesDeclared: z.number().int(), pagesIndexed: z.number().int(), checkedAt: z.string() }).nullable(),
  controlRetrieval: IntervalSchema.nullable(),
  comparison: ComparisonSchema.optional(),
  plan: z.object({
    blockingStage: StageSchema.nullable(),
    actions: z.array(ActionSchema).max(8),
    dropped: z.number().int().nonnegative(),
    notActionable: z.array(z.string()),
  }),
  caveats: z.array(z.string()),
  simulated: z.boolean(),
});

export const FreelanceWorkspaceSchema = z.object({
  reference: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{5}$/),
  displayName: z.string(),
  report: ReportSchema,
  surface: z.object({
    readableWithoutJs: z.boolean(),
    robotsTxt: z.boolean(),
    sitemap: z.boolean(),
    structuredData: z.boolean(),
    verifiedPlatforms: z.array(z.string()),
  }),
  costUsd: z.number().nonnegative(),
  sourceCounts: z.object({ platform: z.record(z.string(), z.number().int().nonnegative()), client: z.number().int(), other: z.number().int() }),
  possession: z.array(
    z.object({
      host: z.string(),
      method: z.enum(["well_known_file", "meta_tag", "dns_txt", "profile_token"]),
      verifiedAt: z.string().nullable(),
    }),
  ),
  /** Later waves of the same design, compared to the first one. Empty until a re-measure exists. */
  remeasures: z.array(z.object({ waveId: z.string(), measuredAt: z.string(), comparison: ComparisonSchema })),
});

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

export const ProfilesSnapshotSchema = z.object({ updatedAt: z.string(), profiles: z.array(PublicProfileSchema) });

export type FreelanceWorkspace = z.infer<typeof FreelanceWorkspaceSchema>;
export type ProfilesSnapshot = z.infer<typeof ProfilesSnapshotSchema>;
export type AnswersSnapshot = z.infer<typeof AnswersSnapshotSchema>;
