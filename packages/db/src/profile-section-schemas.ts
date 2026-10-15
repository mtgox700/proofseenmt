import { z } from "zod";
import { containsContact, NO_CONTACT } from "./contact-detection";
import { uniqueSkills } from "./skills";

/*
 * Les sections du profil enrichi (expériences, formations, certifications, langues, portfolio) : ce que le freelance
 * déclare, validé ici avec les mêmes bornes que les contraintes de la base (migration `20261015120000_rich_profiles`).
 *
 * Tout ce qui est publié est lu par les moteurs : aucun texte ne peut porter de coordonnées (même règle que le profil).
 * Une adresse web est toujours en https, sans identifiant ni mot de passe, et n'est publiée que sur un profil nominatif.
 * Rien ici n'est un niveau calculé ou une note : ce sont des déclarations, montrées comme telles.
 */

/** Plafonds par section, tenus par le dépôt sous verrou du profil. */
export const SECTION_LIMITS = { experiences: 30, educations: 15, certifications: 30, languages: 12, portfolio: 20 } as const;

export const MAX_ITEM_SKILLS = 15;
export const MIN_YEAR = 1950;
export const MAX_YEAR = 2100;

/** Échelle du CECRL, puis langue maternelle. */
export const LANGUAGE_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "native"] as const;
export type LanguageLevelValue = (typeof LANGUAGE_LEVELS)[number];

/**
 * Langues proposées (codes ISO 639-1) : une liste fermée, pour que chaque code ait un nom lisible dans les deux langues
 * du site et qu'une saisie libre ne devienne jamais un filtre fantôme.
 */
export const LANGUAGE_CODES = [
  "fr", "en", "de", "es", "it", "pt", "nl", "ar", "zh", "ja", "ko", "ru", "pl", "ro", "tr", "sv", "da", "no", "fi", "cs",
  "el", "he", "hi", "hu", "uk", "vi", "id", "ms", "th", "fa", "bg", "hr", "sk", "sl", "sr", "lt", "lv", "et", "ca", "eu",
  "br", "co", "oc", "wo", "ln", "sw", "am", "bn", "ur", "ta",
] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Une adresse https publiable : sans identifiants, avec un nom d'hôte ; rendue sous sa forme normalisée. */
export const isHttpsUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.hostname.includes(".");
  } catch {
    return false;
  }
};

const HttpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine(isHttpsUrl, { message: "adresse https attendue" })
  .transform((raw) => new URL(raw).toString())
  // La forme normalisée peut s'allonger (caractères encodés) : la borne de la base est revérifiée après.
  .refine((url) => url.length <= 500, { message: "adresse trop longue" });

const Year = z.number().int().min(MIN_YEAR).max(MAX_YEAR);

/** Un mois : le premier jour du mois, à minuit UTC (la forme rangée en base). */
const Month = z
  .date()
  .refine((d) => !Number.isNaN(d.getTime()) && d.getUTCDate() === 1 && d.getUTCHours() === 0 && d.getUTCMinutes() === 0, { message: "mois attendu" })
  .refine((d) => d.getUTCFullYear() >= MIN_YEAR && d.getUTCFullYear() <= MAX_YEAR, { message: "mois hors bornes" });

/** Des compétences rattachées à un élément : dédoublonnées par clé, 15 au plus. */
const ItemSkills = z
  .array(z.string().trim().min(1).max(60))
  .max(MAX_ITEM_SKILLS * 2)
  .default([])
  .transform((labels) => uniqueSkills(labels).slice(0, MAX_ITEM_SKILLS).map((s) => s.label));

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().default(null);

const noContact = (fields: readonly (string | null)[]): boolean => !fields.some((field) => field !== null && containsContact(field));

export const ExperienceInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    company: optionalText(120),
    companyHidden: z.boolean().default(false),
    startMonth: Month,
    endMonth: Month.nullable().default(null),
    description: optionalText(2000),
    skills: ItemSkills,
  })
  .refine((e) => e.endMonth === null || e.endMonth.getTime() >= e.startMonth.getTime(), { message: "la fin précède le début" })
  .refine((e) => noContact([e.title, e.company, e.description, ...e.skills]), { message: NO_CONTACT });

export const EducationInputSchema = z
  .object({
    school: z.string().trim().min(2).max(160),
    degree: optionalText(160),
    startYear: Year.nullable().default(null),
    endYear: Year.nullable().default(null),
  })
  .refine((e) => e.startYear === null || e.endYear === null || e.endYear >= e.startYear, { message: "la fin précède le début" })
  .refine((e) => noContact([e.school, e.degree]), { message: NO_CONTACT });

export const CertificationInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    issuer: optionalText(160),
    year: Year.nullable().default(null),
    credentialUrl: HttpsUrl.nullable().default(null),
    skills: ItemSkills,
  })
  .refine((c) => noContact([c.name, c.issuer, ...c.skills]), { message: NO_CONTACT });

export const LanguageInputSchema = z.object({
  code: z.enum(LANGUAGE_CODES),
  level: z.enum(LANGUAGE_LEVELS),
});

export const PortfolioInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    url: HttpsUrl,
    description: optionalText(1000),
  })
  .refine((p) => noContact([p.title, p.description]), { message: NO_CONTACT });

export type ExperienceInput = z.input<typeof ExperienceInputSchema>;
export type EducationInput = z.input<typeof EducationInputSchema>;
export type CertificationInput = z.input<typeof CertificationInputSchema>;
export type LanguageInput = z.input<typeof LanguageInputSchema>;
export type PortfolioInput = z.input<typeof PortfolioInputSchema>;
