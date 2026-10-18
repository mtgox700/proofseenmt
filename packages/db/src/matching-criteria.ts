import { z } from "zod";
import { AVAILABILITY_FRESH_DAYS, isAvailabilityFresh } from "./availability";
import type { AvailabilityStatus, WorkMode } from "./generated/enums";

/*
 * Rapprochement expliqué (C22) : les critères, comparés un par un sur des faits enregistrés en base, et la règle d'ordre.
 *
 * Décision du founder (2026-10-18, AI Act) : aucun modèle d'apprentissage ni LLM ne calcule de note, de rang ou de
 * score sur une personne. Ce module est écrit à la main, il est pur (aucune base, aucun réseau) et chaque proposition
 * dit ce qui la rapproche (`matched`) et ce qui lui manque (`missing`). Aucun pourcentage de « compatibilité » n'existe
 * nulle part : on compte des critères remplis, on ne les pondère pas.
 *
 * Un critère sans objet (la ville d'une mission en télétravail, le TJM d'un profil qui ne l'affiche pas) n'est ni
 * rempli ni manquant : il n'apparaît pas.
 */

export const MATCH_CRITERIA = [
  "skills",
  "job_title",
  "city",
  "work_mode",
  "rate",
  "availability",
  "languages",
  "proven_address",
  "verified_missions",
  "registry_active",
  "vigilance_valid",
  "company_registry",
] as const;
export type MatchCriterion = (typeof MATCH_CRITERIA)[number];

/** Ce qui rapproche deux fiches, critère par critère, avec le fait qui le prouve. */
export type MatchReason =
  | { readonly kind: "skills"; readonly shared: readonly string[] }
  | { readonly kind: "job_title"; readonly families: readonly string[] }
  | { readonly kind: "city"; readonly city: string }
  | { readonly kind: "work_mode"; readonly mode: WorkMode }
  | { readonly kind: "rate" }
  | { readonly kind: "availability"; readonly from: Date | null }
  | { readonly kind: "languages"; readonly codes: readonly string[] }
  | { readonly kind: "proven_address" }
  | { readonly kind: "verified_missions"; readonly count: number }
  | { readonly kind: "registry_active" }
  | { readonly kind: "vigilance_valid" }
  | { readonly kind: "company_registry" };

export interface MatchExplanation {
  readonly matched: readonly MatchReason[];
  readonly missing: readonly MatchCriterion[];
}

/** Les faits d'une mission ouverte utiles au rapprochement. */
export interface MatchMission {
  readonly id: string;
  readonly skills: readonly { readonly key: string; readonly label: string }[];
  /** Familles d'intitulés (job-titles.ts) de l'intitulé. */
  readonly families: readonly string[];
  readonly city: string | null;
  readonly cityKey: string | null;
  readonly workMode: WorkMode;
  readonly rateMin: number | null;
  readonly rateMax: number | null;
  readonly companyRegistryActive: boolean;
  readonly publishedAt: Date;
}

/** Les faits d'un profil utiles au rapprochement. */
export interface MatchProfile {
  readonly id: string;
  readonly skills: readonly { readonly key: string; readonly label: string }[];
  /** Familles d'intitulés (job-titles.ts) du titre du profil. */
  readonly families: readonly string[];
  readonly city: string | null;
  readonly cityKey: string | null;
  readonly workMode: WorkMode;
  readonly rate: number | null;
  readonly availability: AvailabilityStatus;
  readonly availableFrom: Date | null;
  readonly availabilityAt: Date;
  readonly languages: readonly string[];
  readonly provenUrls: number;
  readonly verifiedMissions: number;
  readonly registryActive: boolean;
  readonly vigilanceValid: boolean;
  readonly updatedAt: Date;
}

const DAY_MS = 86_400_000;
/** Une disponibilité déclarée il y a plus de 30 jours n'est plus tenue pour vraie : la règle de `availability.ts`, la même que la recherche. */
export const MATCH_FRESH_DAYS = AVAILABILITY_FRESH_DAYS;
/**
 * Une mission n'a pas de date de début en base : elle est ouverte maintenant. Un profil est « disponible » pour elle
 * s'il l'est déjà, ou à partir d'une date dans les 30 jours.
 */
export const AVAILABILITY_WINDOW_DAYS = 30;
/** Deux TJM sont proches quand leur écart ne dépasse pas 20 % du plus élevé. */
export const CLOSE_RATE_SHARE = 0.2;

type Outcome = MatchReason | "missing" | "not_applicable";

const sharedSkills = (source: MatchMission["skills"], candidate: MatchMission["skills"]): readonly string[] => {
  const keys = new Set(source.map((s) => s.key));
  return candidate.filter((s) => keys.has(s.key)).map((s) => s.label).sort((a, b) => a.localeCompare(b, "fr"));
};

const skillsOutcome = (source: MatchMission["skills"], candidate: MatchMission["skills"]): Outcome => {
  if (source.length === 0) return "not_applicable";
  const shared = sharedSkills(source, candidate);
  return shared.length === 0 ? "missing" : { kind: "skills", shared };
};

const familiesOutcome = (source: readonly string[], candidate: readonly string[]): Outcome => {
  if (source.length === 0) return "not_applicable";
  const families = candidate.filter((key) => source.includes(key));
  return families.length === 0 ? "missing" : { kind: "job_title", families };
};

const cityOutcome = (sourceKey: string | null, candidateKey: string | null, candidateCity: string | null): Outcome => {
  if (sourceKey === null) return "not_applicable";
  return candidateKey === sourceKey && candidateCity !== null ? { kind: "city", city: candidateCity } : "missing";
};

/** Seul le couple sur site / télétravail est incompatible : l'hybride mêle les deux. */
export const workModesCompatible = (a: WorkMode, b: WorkMode): boolean => !((a === "onsite" && b === "remote") || (a === "remote" && b === "onsite"));

const workModeOutcome = (source: WorkMode, candidate: WorkMode): Outcome =>
  workModesCompatible(source, candidate) ? { kind: "work_mode", mode: candidate } : "missing";

/** Le TJM du profil tient dans le budget de la mission : au plus son maximum (ou son seul montant donné). */
const rateInBudget = (rate: number | null, min: number | null, max: number | null): Outcome => {
  const ceiling = max ?? min;
  if (rate === null || ceiling === null) return "not_applicable";
  return rate <= ceiling ? { kind: "rate" } : "missing";
};

const rangesOverlap = (a: MatchMission, b: MatchMission): Outcome => {
  const lowA = a.rateMin ?? a.rateMax;
  const lowB = b.rateMin ?? b.rateMax;
  if (lowA === null || lowB === null) return "not_applicable";
  const highA = a.rateMax ?? lowA;
  const highB = b.rateMax ?? lowB;
  return lowA <= highB && lowB <= highA ? { kind: "rate" } : "missing";
};

const ratesClose = (a: number | null, b: number | null): Outcome => {
  if (a === null || b === null) return "not_applicable";
  return Math.abs(a - b) <= CLOSE_RATE_SHARE * Math.max(a, b) ? { kind: "rate" } : "missing";
};

const availabilityOutcome = (p: MatchProfile, now: Date): Outcome => {
  if (!isAvailabilityFresh(p.availabilityAt, now) || p.availability === "unavailable") return "missing";
  if (p.availability === "available") return { kind: "availability", from: null };
  if (p.availableFrom === null || p.availableFrom.getTime() > now.getTime() + AVAILABILITY_WINDOW_DAYS * DAY_MS) return "missing";
  return { kind: "availability", from: p.availableFrom };
};

const languagesOutcome = (source: readonly string[], candidate: readonly string[]): Outcome => {
  if (source.length === 0) return "not_applicable";
  const codes = candidate.filter((code) => source.includes(code)).sort();
  return codes.length === 0 ? "missing" : { kind: "languages", codes };
};

const fact = (holds: boolean, reason: MatchReason): Outcome => (holds ? reason : "missing");

/** Les faits vérifiés d'un profil, chacun un critère explicite. */
const profileFacts = (p: MatchProfile): readonly [MatchCriterion, Outcome][] => [
  ["proven_address", fact(p.provenUrls > 0, { kind: "proven_address" })],
  ["verified_missions", fact(p.verifiedMissions > 0, { kind: "verified_missions", count: p.verifiedMissions })],
  ["registry_active", fact(p.registryActive, { kind: "registry_active" })],
  ["vigilance_valid", fact(p.vigilanceValid, { kind: "vigilance_valid" })],
];

const explain = (outcomes: readonly (readonly [MatchCriterion, Outcome])[]): MatchExplanation => ({
  matched: outcomes.flatMap(([, o]) => (typeof o === "string" ? [] : [o])),
  missing: outcomes.flatMap(([criterion, o]) => (o === "missing" ? [criterion] : [])),
});

/** Une mission vue par un freelance (« Missions pour vous ») : ses faits comparés au profil du freelance. */
export const explainMissionForProfile = (profile: MatchProfile, mission: MatchMission): MatchExplanation =>
  explain([
    ["skills", skillsOutcome(profile.skills, mission.skills)],
    ["job_title", familiesOutcome(profile.families, mission.families)],
    ["city", mission.workMode === "remote" ? "not_applicable" : cityOutcome(profile.cityKey, mission.cityKey, mission.city)],
    ["work_mode", workModeOutcome(profile.workMode, mission.workMode)],
    ["rate", rateInBudget(profile.rate, mission.rateMin, mission.rateMax)],
    ["company_registry", fact(mission.companyRegistryActive, { kind: "company_registry" })],
  ]);

/** Un profil vu par l'entreprise qui a écrit la mission : ses faits comparés à la mission, et ses faits vérifiés. */
export const explainProfileForMission = (mission: MatchMission, profile: MatchProfile, now: Date): MatchExplanation =>
  explain([
    ["skills", skillsOutcome(mission.skills, profile.skills)],
    ["job_title", familiesOutcome(mission.families, profile.families)],
    ["city", mission.workMode === "remote" ? "not_applicable" : cityOutcome(mission.cityKey, profile.cityKey, profile.city)],
    ["work_mode", workModeOutcome(mission.workMode, profile.workMode)],
    ["rate", rateInBudget(profile.rate, mission.rateMin, mission.rateMax)],
    ["availability", availabilityOutcome(profile, now)],
    ...profileFacts(profile),
  ]);

/** Deux missions ouvertes proches l'une de l'autre. */
export const explainSimilarMission = (source: MatchMission, candidate: MatchMission): MatchExplanation =>
  explain([
    ["skills", skillsOutcome(source.skills, candidate.skills)],
    ["job_title", familiesOutcome(source.families, candidate.families)],
    ["city", source.workMode === "remote" || candidate.workMode === "remote" ? "not_applicable" : cityOutcome(source.cityKey, candidate.cityKey, candidate.city)],
    ["work_mode", workModeOutcome(source.workMode, candidate.workMode)],
    ["rate", rangesOverlap(source, candidate)],
  ]);

/** Deux profils publiés proches l'un de l'autre : la similitude, pas les preuves (elles restent sur chaque page). */
export const explainSimilarProfile = (source: MatchProfile, candidate: MatchProfile): MatchExplanation =>
  explain([
    ["skills", skillsOutcome(source.skills, candidate.skills)],
    ["job_title", familiesOutcome(source.families, candidate.families)],
    ["city", cityOutcome(source.cityKey, candidate.cityKey, candidate.city)],
    ["work_mode", workModeOutcome(source.workMode, candidate.workMode)],
    ["rate", ratesClose(source.rate, candidate.rate)],
    ["languages", languagesOutcome(source.languages, candidate.languages)],
  ]);

export const DEFAULT_SUGGESTIONS = 12;
export const MAX_SUGGESTIONS = 50;

/**
 * Ce que la personne qui regarde choisit : les critères comptés pour l'ordre (tous par défaut), ceux qu'elle exige (une
 * proposition qui ne remplit pas un critère exigé sort ; un critère sans objet ne la fait pas sortir), le nombre affiché.
 */
export const MatchOptionsSchema = z.object({
  counted: z.array(z.enum(MATCH_CRITERIA)).max(MATCH_CRITERIA.length).optional(),
  required: z.array(z.enum(MATCH_CRITERIA)).max(MATCH_CRITERIA.length).default([]),
  limit: z.number().int().min(1).max(MAX_SUGGESTIONS).default(DEFAULT_SUGGESTIONS),
});
export type MatchOptions = z.input<typeof MatchOptionsSchema>;
type Options = z.output<typeof MatchOptionsSchema>;

export interface Explained<T> extends MatchExplanation {
  readonly item: T;
}

interface Rankable extends MatchExplanation {
  readonly id: string;
  /** Le critère neutre qui départage : publication (mission) ou mise à jour (profil), la plus récente d'abord. */
  readonly date: Date;
}

const sharedCount = (e: MatchExplanation): number => e.matched.reduce((n, r) => (r.kind === "skills" ? n + r.shared.length : n), 0);

/**
 * La règle d'ordre, la même partout et affichée à l'écran : le nombre de critères remplis parmi ceux que la personne
 * compte, puis le nombre de compétences en commun, puis la date la plus récente, puis l'identifiant (stable, sans sens).
 */
export const orderExplained = <T extends Rankable>(items: readonly T[], raw: MatchOptions = {}): readonly T[] => {
  const o: Options = MatchOptionsSchema.parse(raw);
  const counted = new Set<MatchCriterion>(o.counted ?? MATCH_CRITERIA);
  const keeps = (item: T): boolean => o.required.every((criterion) => !item.missing.includes(criterion));
  const count = (item: T): number => item.matched.filter((r) => counted.has(r.kind)).length;
  return items
    .filter(keeps)
    .map((item) => ({ item, count: count(item), shared: sharedCount(item) }))
    .sort((a, b) => b.count - a.count || b.shared - a.shared || b.item.date.getTime() - a.item.date.getTime() || (a.item.id < b.item.id ? 1 : a.item.id > b.item.id ? -1 : 0))
    .slice(0, o.limit)
    .map(({ item }) => item);
};
