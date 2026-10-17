import { z } from "zod";
import { LANGUAGE_CODES, LANGUAGE_LEVELS, MAX_LANGUAGE_FILTERS, type LanguageCode, type LanguageLevelValue } from "./profile-section-schemas";

/*
 * Ce qu'on garde d'une proposition de filtres faite par un modèle à partir d'une phrase : uniquement des filtres, bornés
 * et revalidés. Tout autre champ — un ordre de tri, un score, une liste de personnes — est jeté sans être lu : la liste
 * reste triée par le critère que la personne choisit (AI Act). Les filtres sont rendus à la personne, qui les voit et
 * les corrige avant toute recherche.
 */

const MAX_RATE_EUROS = 100_000;
const WORK_MODES = ["onsite", "hybrid", "remote"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const skills = z.array(z.unknown()).transform((items) => [...new Set(items.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 60))].slice(0, 10));
const workModes = z.array(z.unknown()).transform((items) => [...new Set(items.filter((m): m is (typeof WORK_MODES)[number] => (WORK_MODES as readonly unknown[]).includes(m)))]);
const euros = z.number().finite().min(0).max(MAX_RATE_EUROS).nullable().optional().catch(null);
const city = text(120).nullable().optional().catch(null);

/** Une langue demandée : un code de la liste fermée et un niveau minimal ; sans niveau lisible, tout niveau convient. */
const LanguageItem = z.object({
  code: z.string().transform((c) => c.trim().toLowerCase()).pipe(z.enum(LANGUAGE_CODES)),
  minLevel: z
    .string()
    .transform((l) => l.trim().toLowerCase())
    .pipe(z.enum(LANGUAGE_LEVELS))
    .nullable()
    .optional()
    .catch(null),
});
const languages = z.array(z.unknown()).transform((items) => {
  const kept = new Map<LanguageCode, LanguageLevelValue>();
  for (const item of items) {
    const parsed = LanguageItem.safeParse(item);
    if (parsed.success && !kept.has(parsed.data.code)) kept.set(parsed.data.code, parsed.data.minLevel ?? "a1");
  }
  return [...kept].slice(0, MAX_LANGUAGE_FILTERS).map(([code, minLevel]) => ({ code, minLevel }));
});

const ProfileCandidate = z.object({
  skills: skills.catch([]),
  city,
  workModes: workModes.catch([]),
  maxDailyRateEuros: euros,
  availableOnly: z.boolean().optional().catch(false),
  languages: languages.optional().catch([]),
});

const MissionCandidate = z.object({
  skills: skills.catch([]),
  city,
  workModes: workModes.catch([]),
  minDailyRateEuros: euros,
  maxDurationMonths: z.number().int().min(1).max(600).nullable().optional().catch(null),
});

export interface ProfileBriefFilters {
  readonly skills: readonly string[];
  readonly city?: string;
  readonly workModes: readonly ("onsite" | "hybrid" | "remote")[];
  readonly maxDailyRateCents?: number;
  readonly availableOnly: boolean;
  /** Présent seulement si la phrase demande au moins une langue. */
  readonly languages?: readonly { readonly code: LanguageCode; readonly minLevel: LanguageLevelValue }[];
}

export interface MissionBriefFilters {
  readonly skills: readonly string[];
  readonly city?: string;
  readonly workModes: readonly ("onsite" | "hybrid" | "remote")[];
  readonly minDailyRateCents?: number;
  readonly maxDurationMonths?: number;
}

const cents = (eurosValue: number | null | undefined): number | undefined => (eurosValue == null ? undefined : Math.round(eurosValue * 100));

/** Filtres de recherche de freelances tirés d'une proposition ; `null` si elle n'en est pas une. */
export const profileFiltersFromBrief = (candidate: unknown): ProfileBriefFilters | null => {
  const parsed = ProfileCandidate.safeParse(candidate);
  if (!parsed.success) return null;
  const c = parsed.data;
  const rate = cents(c.maxDailyRateEuros);
  return {
    skills: c.skills,
    ...(c.city == null ? {} : { city: c.city }),
    workModes: c.workModes,
    ...(rate === undefined ? {} : { maxDailyRateCents: rate }),
    availableOnly: c.availableOnly ?? false,
    ...(c.languages === undefined || c.languages.length === 0 ? {} : { languages: c.languages }),
  };
};

/** Filtres de recherche de missions tirés d'une proposition ; `null` si elle n'en est pas une. */
export const missionFiltersFromBrief = (candidate: unknown): MissionBriefFilters | null => {
  const parsed = MissionCandidate.safeParse(candidate);
  if (!parsed.success) return null;
  const c = parsed.data;
  const rate = cents(c.minDailyRateEuros);
  return {
    skills: c.skills,
    ...(c.city == null ? {} : { city: c.city }),
    workModes: c.workModes,
    ...(rate === undefined ? {} : { minDailyRateCents: rate }),
    ...(c.maxDurationMonths == null ? {} : { maxDurationMonths: c.maxDurationMonths }),
  };
};
