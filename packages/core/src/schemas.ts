import { z } from "zod";

/** Engines whose terms allow automated analysis of answers (CONFORMITE §5). Gemini, Vertex and Bing are excluded on purpose. */
export const EngineIdSchema = z.enum(["openai", "anthropic", "perplexity"]);
export type EngineId = z.infer<typeof EngineIdSchema>;

const isoDate = z.iso.datetime({ offset: true });

export const OwnedUrlSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  proofMethod: z.enum(["well_known_file", "meta_tag", "dns_txt", "profile_token"]),
  verifiedAt: isoDate.nullable(),
});
export type OwnedUrl = z.infer<typeof OwnedUrlSchema>;

export const IdentitySchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(2).max(120),
  nameVariants: z.array(z.string().min(2).max(120)).min(1).max(10),
  city: z.string().min(1).max(80),
  stack: z.array(z.string().min(1).max(40)).max(30),
  ownedUrls: z.array(OwnedUrlSchema).min(1).max(20),
});
export type Identity = z.infer<typeof IdentitySchema>;

export const verifiedUrls = (identity: Identity): readonly OwnedUrl[] =>
  identity.ownedUrls.filter((u) => u.verifiedAt !== null);

export const JobDescriptionSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Z0-9_-]{1,31}$/),
  lang: z.enum(["fr", "en"]),
  role: z.enum(["target", "control"]),
  source: z.enum(["market", "client"]),
  text: z.string().min(20).max(20_000),
  /** Short recruiter-style summary (role, stack, city, availability) used by templates with {{BRIEF}} (P2). */
  brief: z.string().min(10).max(300).optional(),
});
export type JobDescription = z.infer<typeof JobDescriptionSchema>;

export const ClusterSchema = z.object({
  id: z.string().min(1).max(64),
  role: z.string().min(1),
  stack: z.string().min(1),
  seniority: z.string().min(1),
  location: z.string().min(1),
  mode: z.enum(["remote", "hybrid", "onsite"]),
  lang: z.enum(["fr", "en"]),
});
export type Cluster = z.infer<typeof ClusterSchema>;

export const JD_PLACEHOLDER = "{{JD}}";
export const BRIEF_PLACEHOLDER = "{{BRIEF}}";

export const PromptTemplateSchema = z.object({
  id: z.string().regex(/^P\d{1,2}$/),
  version: z.number().int().positive(),
  lang: z.enum(["fr", "en"]),
  text: z
    .string()
    .min(10)
    .max(4_000)
    .refine((t) => t.includes(JD_PLACEHOLDER) || t.includes(BRIEF_PLACEHOLDER), {
      message: `template must contain ${JD_PLACEHOLDER} or ${BRIEF_PLACEHOLDER}`,
    }),
});
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

const uniqueBy = <T>(key: (item: T) => string) => (items: readonly T[]) =>
  new Set(items.map(key)).size === items.length;

export const ManifestSchema = z
  .object({
    version: z.literal(1),
    waveId: z.string().regex(/^[A-Za-z0-9+_-]{1,32}$/),
    frozenAt: isoDate.nullable(),
    engines: z.array(EngineIdSchema).min(1).refine(uniqueBy((e: EngineId) => e), "duplicate engine"),
    models: z.partialRecord(EngineIdSchema, z.string().min(1).max(80)),
    drawsPerCell: z.number().int().min(1).max(20),
    costCapUsd: z.number().positive().max(500),
    jobDescriptions: z.array(JobDescriptionSchema).min(1).max(50).refine(uniqueBy((j: JobDescription) => j.id), "duplicate job description id"),
    prompts: z.array(PromptTemplateSchema).min(1).max(10).refine(uniqueBy((p: PromptTemplate) => p.id), "duplicate prompt id"),
  })
  .refine((m) => m.engines.every((e) => m.models[e] !== undefined), { message: "every selected engine needs a model" })
  .refine(
    (m) => !m.prompts.some((p) => p.text.includes(BRIEF_PLACEHOLDER)) || m.jobDescriptions.every((j) => j.brief !== undefined),
    { message: "a template uses {{BRIEF}}: every job description needs a brief" },
  );
export type Manifest = z.infer<typeof ManifestSchema>;

/** What every engine adapter returns for one draw (in memory only — never persisted as is). */
export const EngineAnswerSchema = z.object({
  engine: EngineIdSchema,
  model: z.string().min(1),
  text: z.string(),
  citations: z.array(z.object({ url: z.string(), title: z.string().optional() })),
  searchResults: z.array(z.object({ url: z.string(), title: z.string().optional() })),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    searches: z.number().int().nonnegative(),
  }),
  costUsd: z.number().nonnegative(),
});
export type EngineAnswer = z.infer<typeof EngineAnswerSchema>;

/** Domain tally kept per draw: whitelisted platform domains, the client's own domains, and an anonymous "other" bucket. */
export const CitedDomainsSchema = z.object({
  platform: z.record(z.string(), z.number().int().nonnegative()),
  client: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
});
export type CitedDomains = z.infer<typeof CitedDomainsSchema>;

export const DrawRecordSchema = z.object({
  id: z.string().min(1),
  waveId: z.string().min(1),
  engine: EngineIdSchema,
  model: z.string().min(1),
  promptId: z.string().min(1),
  jdId: z.string().min(1),
  drawIndex: z.number().int().nonnegative(),
  timestamp: isoDate,
  costUsd: z.number().nonnegative(),
  status: z.enum(["ok", "error"]),
  errorCode: z.string().max(80).nullable(),
  responseHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  retrieved: z.boolean(),
  citedDomains: CitedDomainsSchema,
});
export type DrawRecord = z.infer<typeof DrawRecordSchema>;

export const MatchSchema = z.object({
  drawId: z.string().min(1),
  identityId: z.string().min(1),
  type: z.enum(["certain", "probable"]),
  rank: z.number().int().positive().nullable(),
  clientUrlCited: z.boolean(),
  needsReview: z.boolean(),
});
export type Match = z.infer<typeof MatchSchema>;
