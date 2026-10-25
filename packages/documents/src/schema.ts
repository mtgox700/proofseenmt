import { z } from "zod";
import { isIsoDate } from "./format";

/*
 * Schémas zod du format de gabarit (TEMPLATE_FORMAT.md §3 et §4). Toutes les clés sont strictes : une clé inconnue dans
 * un gabarit est une faute de frappe, pas une extension. Ce fichier ne dit que la forme ; la cohérence entre fichiers
 * (placeholder déclaré, source connue, variante couverte) vit dans lint.ts.
 */

const Scalar = z.union([z.string(), z.number(), z.boolean()]);
export type Scalar = z.infer<typeof Scalar>;

const IsoDate = z.string().refine(isIsoDate, "date AAAA-MM-JJ attendue");

export const VARIABLE_TYPES = ["string", "text", "enum", "boolean", "int", "money", "bp", "date", "datetime", "party", "list"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

/* Conditions (§3.4) : un opérateur par feuille, `all`, `any` et `not` pour composer. */
const Leaf = z
  .strictObject({
    var: z.string().min(1),
    eq: Scalar.optional(),
    neq: Scalar.optional(),
    in: z.array(Scalar).min(1).optional(),
    gte: z.number().optional(),
    lte: z.number().optional(),
    present: z.boolean().optional(),
  })
  .refine((leaf) => [leaf.eq, leaf.neq, leaf.in, leaf.gte, leaf.lte, leaf.present].filter((op) => op !== undefined).length === 1, "une condition a un opérateur et un seul");
export type LeafCondition = z.infer<typeof Leaf>;

export type Condition = LeafCondition | { readonly all: readonly Condition[] } | { readonly any: readonly Condition[] } | { readonly not: Condition };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([Leaf, z.strictObject({ all: z.array(ConditionSchema).min(1) }), z.strictObject({ any: z.array(ConditionSchema).min(1) }), z.strictObject({ not: ConditionSchema })]),
);

/** Les rôles qui saisissent une variable : vendeur et acheteur, ou freelance et entreprise pour le NDA. */
const Role = z.enum(["seller", "buyer", "freelance", "company"]);

const Source = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("db"), path: z.string().min(1) }),
  z.strictObject({ kind: z.literal("derived"), fn: z.string().min(1), from: z.array(z.string()) }),
  z.strictObject({ kind: z.literal("rule"), file: z.string().min(1), symbol: z.string().min(1) }),
  z.strictObject({ kind: z.literal("platform"), file: z.string().min(1), symbol: z.string().min(1) }),
  z.strictObject({ kind: z.literal("input"), editableBy: z.array(Role), stage: z.string() }),
  z.strictObject({ kind: z.literal("document"), field: z.string().min(1) }),
  z.strictObject({ kind: z.literal("pending"), request: z.string().min(1) }),
]);
export type VariableSource = z.infer<typeof Source>;

const Labels = z.strictObject({ fr: z.string().min(1), en: z.string().min(1).optional() });
const EnumLabels = z.strictObject({ fr: z.record(z.string(), z.string()), en: z.record(z.string(), z.string()).optional() });

const RequiredWhen = z.union([Leaf, z.strictObject({ clause: z.string().min(1), included: z.boolean() })]);

export const VariableSchema = z.strictObject({
  type: z.enum(VARIABLE_TYPES),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  maxItems: z.number().int().positive().optional(),
  itemMaxLength: z.number().int().positive().optional(),
  values: z.array(z.string()).min(1).optional(),
  labels: EnumLabels.optional(),
  currency: z.union([z.string(), z.strictObject({ literal: z.string().regex(/^[A-Z]{3}$/) })]).optional(),
  required: z.boolean(),
  requiredWhen: RequiredWhen.optional(),
  default: Scalar.optional(),
  defaultStatus: z.literal("HYPOTHESIS").optional(),
  defaultReason: z.string().optional(),
  source: Source,
  prefill: z.strictObject({ kind: z.string(), path: z.string() }).optional(),
  frozenAt: z.enum(["contract_creation", "signature", "input", "render_data"]),
  editableBy: z.array(Role).optional(),
  label: Labels,
  note: z.string().optional(),
});
export type VariableDecl = z.infer<typeof VariableSchema>;

const Gate = z.strictObject({ variant: z.string(), decision: z.string().min(1), error: z.literal("decision_pending") });

export const ClauseSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "identifiant de clause en kebab-case"),
  kind: z.enum(["locked", "optional", "conditional"]),
  sources: z.array(z.string()).default([]),
  basis: z.literal("practice").optional(),
  variantBy: z.string().optional(),
  variantRequires: z.record(z.string(), z.array(z.string())).optional(),
  when: ConditionSchema.optional(),
  gates: z.array(Gate).optional(),
  requires: z.array(z.string()).optional(),
  default: z.enum(["included", "excluded"]).optional(),
  toggledBy: z.enum(["seller", "buyer", "both"]).optional(),
  note: z.string().optional(),
});
export type ClauseDecl = z.infer<typeof ClauseSchema>;

const Retention = z.strictObject({
  active: z.string(),
  archive: z.strictObject({ years: z.number().int().positive(), from: z.string(), when: z.string().optional(), sources: z.array(z.string()) }).optional(),
  accounting: z.strictObject({ years: z.number().int().positive(), from: z.string(), sources: z.array(z.string()), status: z.literal("HYPOTHESIS").optional() }).optional(),
  onPartyErasure: z.enum(["archive", "delete", "archive_if_accepted"]),
  draftsOnPartyErasure: z.enum(["archive", "delete"]),
});

const Review = z.strictObject({
  status: z.enum(["draft", "reviewed"]),
  reviewedBy: z.string().nullable(),
  reviewedOn: IsoDate.nullable(),
  reviewedDigest: z.string().nullable(),
  points: z.array(z.strictObject({ id: z.string(), clause: z.string().optional(), question: z.string() })),
});

export const TemplateSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  version: z.number().int().positive(),
  status: z.enum(["draft", "published", "retired"]),
  effectiveFrom: IsoDate,
  documentType: z.enum(["contract", "quote", "acceptance_report", "nda", "amendment"]),
  languages: z.array(z.enum(["fr", "en"])).min(1),
  prevailingLanguage: z.enum(["fr", "en"]),
  attachTo: z.string(),
  variables: z.record(z.string(), VariableSchema),
  clauses: z.array(ClauseSchema).min(1),
  signature: z.strictObject({
    level: z.literal("simple"),
    order: z.enum(["parallel", "sequential"]),
    signatories: z.array(z.strictObject({ role: z.string(), rule: z.string(), mode: z.enum(["issuance", "acceptance", "acknowledgement"]).optional() })).min(1),
  }),
  retention: Retention,
  review: Review,
});
export type TemplateDecl = z.infer<typeof TemplateSchema>;

const ClauseText = z.strictObject({
  heading: z.string().min(1),
  body: z.string().optional(),
  variants: z.record(z.string(), z.string()).optional(),
});

export const LanguageSchema = z.strictObject({
  language: z.enum(["fr", "en"]),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  reviewNotice: z.string().min(1),
  reviewFooter: z.string().min(1),
  clauses: z.record(z.string(), ClauseText),
});
export type LanguageText = z.infer<typeof LanguageSchema>;
export type ClauseText = z.infer<typeof ClauseText>;

export const SOURCE_READ = ["official", "official-search", "official-by-research", "not-read"] as const;

export const SourceSchema = z.strictObject({
  title: z.string().min(1),
  url: z.string().min(1),
  readOn: IsoDate,
  read: z.enum(SOURCE_READ),
  validFrom: IsoDate.nullable().optional(),
  validUntil: IsoDate.nullable(),
  note: z.string().optional(),
});
export type SourceEntry = z.infer<typeof SourceSchema>;

export const SourcesFileSchema = z.strictObject({ sources: z.record(z.string(), SourceSchema) });
