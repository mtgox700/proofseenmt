import { z } from "zod";

/** Every public text exists in French and English (hreflang pages). */
export const LocalizedSchema = z.object({ fr: z.string().min(1).max(2_000), en: z.string().min(1).max(2_000) });
export type Localized = z.infer<typeof LocalizedSchema>;

const httpsUrl = z.url({ protocol: /^https$/ });
const isoDate = z.iso.date();

/**
 * A verifiable fact shown on a mission page. `source` says where it can be checked (repository, public page,
 * client reference…) — the truth lock of the project: no figure without a source.
 */
export const FactSchema = z.object({
  label: LocalizedSchema,
  value: z.string().min(1).max(80),
  source: z.string().min(3).max(200),
});

export const LinkSchema = z.object({ label: z.string().min(1).max(60), url: httpsUrl });

export const MissionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  title: LocalizedSchema,
  /** Public client name, or an anonymised description ("Scale-up SaaS B2B"); never a confidential name. */
  client: LocalizedSchema,
  period: z.object({ from: z.string().regex(/^\d{4}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}$/).nullable() }),
  role: LocalizedSchema,
  summary: LocalizedSchema,
  facts: z.array(FactSchema).max(8),
  stack: z.array(z.string().min(1).max(40)).max(20),
  links: z.array(LinkSchema).max(5),
});
export type Mission = z.infer<typeof MissionSchema>;

export const HubProfileSchema = z
  .object({
    version: z.literal(1),
    baseUrl: httpsUrl.refine((u) => !u.endsWith("/"), "baseUrl must not end with /"),
    person: z.object({
      name: z.string().min(2).max(80),
      headline: LocalizedSchema,
      city: z.string().min(1).max(80),
      workMode: LocalizedSchema,
      summary: LocalizedSchema,
      stack: z.array(z.string().min(1).max(40)).min(1).max(30),
      links: z.array(LinkSchema).max(10),
      contactEmail: z.email().nullable(),
    }),
    availability: z.object({
      status: z.enum(["available", "available_from", "unavailable"]),
      from: isoDate.nullable(),
      updatedAt: isoDate,
    }),
    rate: z.object({ min: z.number().int().positive(), max: z.number().int().positive(), currency: z.literal("EUR"), unit: z.literal("day") }).nullable(),
    missions: z.array(MissionSchema).max(12),
    /** Optional US-F00 token, published at /.well-known/proofseen-verification.txt. */
    verificationToken: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/).nullable(),
  })
  .refine((p) => p.availability.status !== "available_from" || p.availability.from !== null, {
    message: "availability.from is required when status is available_from",
  })
  .refine((p) => p.rate === null || p.rate.min <= p.rate.max, { message: "rate.min must be <= rate.max" })
  .refine((p) => new Set(p.missions.map((m) => m.slug)).size === p.missions.length, { message: "duplicate mission slug" });
export type HubProfile = z.infer<typeof HubProfileSchema>;

export type Locale = "fr" | "en";
