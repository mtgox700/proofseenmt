import { createHash } from "node:crypto";
import { z } from "zod";
import { containsContact } from "./contact-detection";
import {
  CertificationInputSchema,
  EducationInputSchema,
  ExperienceInputSchema,
  LANGUAGE_CODES,
  LANGUAGE_LEVELS,
  type CertificationInput,
  type EducationInput,
  type ExperienceInput,
  type LanguageInput,
} from "./profile-section-schemas";
import { MAX_SKILLS, uniqueSkills } from "./skills";

/*
 * Le brouillon proposé par un modèle à partir du CV que le freelance a déposé. Ce que le modèle rend est une donnée non
 * fiable : seuls les champs des sections du profil sont gardés, chaque élément passe par le schéma de sa section (un
 * élément invalide ou porteur de coordonnées est écarté, sa description seule l'est d'abord), et tout autre champ — une
 * note, une ancienneté calculée, un niveau inventé — est jeté sans être lu (AI Act : aucune évaluation de la personne).
 *
 * Le brouillon n'est jamais publié : le freelance accepte chaque élément, un par un, et l'élément est revalidé à ce
 * moment-là par le dépôt de sa section.
 */

export const DRAFT_LIMITS = { experiences: 15, educations: 10, certifications: 15, languages: 10, skills: MAX_SKILLS } as const;

export type DraftSection = "experiences" | "educations" | "certifications" | "languages" | "skills";
export const DRAFT_SECTIONS: readonly DraftSection[] = ["experiences", "educations", "certifications", "languages", "skills"];

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const DraftExperienceSchema = z.object({
  title: z.string(),
  company: z.string().nullable(),
  startMonth: z.string().regex(MONTH),
  endMonth: z.string().regex(MONTH).nullable(),
  description: z.string().nullable(),
  skills: z.array(z.string()),
});
const DraftEducationSchema = z.object({ school: z.string(), degree: z.string().nullable(), startYear: z.number().int().nullable(), endYear: z.number().int().nullable() });
const DraftCertificationSchema = z.object({ name: z.string(), issuer: z.string().nullable(), year: z.number().int().nullable(), skills: z.array(z.string()) });
const DraftLanguageSchema = z.object({ code: z.enum(LANGUAGE_CODES), level: z.enum(LANGUAGE_LEVELS) });

/** Le brouillon tel que rangé en base ; relu à travers ce schéma, jamais tel quel. */
export const CvDraftSchema = z.object({
  experiences: z.array(DraftExperienceSchema).max(DRAFT_LIMITS.experiences).catch([]),
  educations: z.array(DraftEducationSchema).max(DRAFT_LIMITS.educations).catch([]),
  certifications: z.array(DraftCertificationSchema).max(DRAFT_LIMITS.certifications).catch([]),
  languages: z.array(DraftLanguageSchema).max(DRAFT_LIMITS.languages).catch([]),
  skills: z.array(z.string()).max(DRAFT_LIMITS.skills).catch([]),
});

export type CvDraft = z.output<typeof CvDraftSchema>;
export type DraftExperience = z.output<typeof DraftExperienceSchema>;
export type DraftEducation = z.output<typeof DraftEducationSchema>;
export type DraftCertification = z.output<typeof DraftCertificationSchema>;

export const EMPTY_DRAFT: CvDraft = { experiences: [], educations: [], certifications: [], languages: [], skills: [] };

export const isEmptyDraft = (d: CvDraft): boolean => DRAFT_SECTIONS.every((section) => d[section].length === 0);

/** Un mois « AAAA-MM » au premier jour, à minuit UTC. */
export const monthDate = (month: string): Date => new Date(`${month}-01T00:00:00Z`);

export const experienceInput = (e: DraftExperience): ExperienceInput => ({
  title: e.title,
  company: e.company,
  startMonth: monthDate(e.startMonth),
  endMonth: e.endMonth === null ? null : monthDate(e.endMonth),
  description: e.description,
  skills: e.skills,
});

export const educationInput = (e: DraftEducation): EducationInput => e;

export const certificationInput = (c: DraftCertification): CertificationInput => ({ ...c, credentialUrl: null });

export const languageInput = (l: LanguageInput): LanguageInput => l;

/** L'empreinte courte d'un élément : l'écran la renvoie, pour qu'un brouillon changé entre-temps ne fasse pas accepter un autre élément. */
export const draftItemKey = (item: unknown): string => createHash("sha256").update(JSON.stringify(item)).digest("hex").slice(0, 16);

// ─── Lecture de la proposition du modèle ─────────────────────────────────────────────────────────────────────────────

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed === "" ? null : trimmed.slice(0, max);
};

const year = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) ? value : typeof value === "string" && /^\d{4}$/.test(value.trim()) ? Number(value.trim()) : null);

/** « 2021-03 », ou une année seule lue comme janvier. */
const month = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (MONTH.test(raw)) return raw;
  return /^\d{4}$/.test(raw) ? `${raw}-01` : null;
};

const labels = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 60) : [];

const record = (value: unknown): Readonly<Record<string, unknown>> => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const items = (candidate: Readonly<Record<string, unknown>>, key: string, max: number): readonly Readonly<Record<string, unknown>>[] => {
  const value = candidate[key];
  return Array.isArray(value) ? value.slice(0, max * 2).map(record) : [];
};

/** Garde l'élément s'il passe le schéma de sa section ; sinon essaie sans sa description ; sinon l'écarte. */
const keepValid = <T extends { readonly description?: string | null }>(item: T, valid: (candidate: T) => boolean): T | null => {
  if (valid(item)) return item;
  if (item.description !== undefined && item.description !== null) {
    const without = { ...item, description: null };
    if (valid(without)) return without;
  }
  return null;
};

const experiencesOf = (candidate: Readonly<Record<string, unknown>>): DraftExperience[] =>
  items(candidate, "experiences", DRAFT_LIMITS.experiences)
    .flatMap((e): DraftExperience[] => {
      const title = text(e.title, 120);
      const startMonth = month(e.start ?? e.startMonth);
      if (title === null || startMonth === null) return [];
      const draft: DraftExperience = {
        title,
        company: text(e.company, 120),
        startMonth,
        endMonth: month(e.end ?? e.endMonth),
        description: text(e.description, 2000),
        skills: uniqueSkills(labels(e.skills)).slice(0, 15).map((s) => s.label),
      };
      const kept = keepValid(draft, (d) => ExperienceInputSchema.safeParse(experienceInput(d)).success);
      return kept === null ? [] : [kept];
    })
    .slice(0, DRAFT_LIMITS.experiences);

const educationsOf = (candidate: Readonly<Record<string, unknown>>): DraftEducation[] =>
  items(candidate, "educations", DRAFT_LIMITS.educations)
    .flatMap((e): DraftEducation[] => {
      const school = text(e.school, 160);
      if (school === null) return [];
      const draft: DraftEducation = { school, degree: text(e.degree, 160), startYear: year(e.startYear), endYear: year(e.endYear) };
      return EducationInputSchema.safeParse(draft).success ? [draft] : [];
    })
    .slice(0, DRAFT_LIMITS.educations);

const certificationsOf = (candidate: Readonly<Record<string, unknown>>): DraftCertification[] =>
  items(candidate, "certifications", DRAFT_LIMITS.certifications)
    .flatMap((c): DraftCertification[] => {
      const name = text(c.name, 160);
      if (name === null) return [];
      const draft: DraftCertification = { name, issuer: text(c.issuer, 160), year: year(c.year), skills: uniqueSkills(labels(c.skills)).slice(0, 15).map((s) => s.label) };
      return CertificationInputSchema.safeParse(certificationInput(draft)).success ? [draft] : [];
    })
    .slice(0, DRAFT_LIMITS.certifications);

const languagesOf = (candidate: Readonly<Record<string, unknown>>): LanguageInput[] => {
  const seen = new Set<string>();
  return items(candidate, "languages", DRAFT_LIMITS.languages).flatMap((l): LanguageInput[] => {
    const parsed = DraftLanguageSchema.safeParse({ code: typeof l.code === "string" ? l.code.trim().toLowerCase() : l.code, level: typeof l.level === "string" ? l.level.trim().toLowerCase() : l.level });
    if (!parsed.success || seen.has(parsed.data.code) || seen.size >= DRAFT_LIMITS.languages) return [];
    seen.add(parsed.data.code);
    return [parsed.data];
  });
};

/** La proposition du modèle, réduite à un brouillon valide ; un brouillon vide si rien n'est exploitable. */
export const draftFromCandidate = (raw: unknown): CvDraft => {
  const candidate = record(raw);
  return {
    experiences: experiencesOf(candidate),
    educations: educationsOf(candidate),
    certifications: certificationsOf(candidate),
    languages: languagesOf(candidate),
    skills: uniqueSkills(labels(candidate.skills).filter((s) => !containsContact(s)))
      .slice(0, DRAFT_LIMITS.skills)
      .map((s) => s.label),
  };
};
