import { z } from "zod";
import type { PrivateIdentity, PublicProfile } from "./identity";
import { LOCALES, profilePath } from "./render";

/*
 * Re-identification test and consent withdrawal (PIVOT_ANONYME §6.2 and §6.3) — both are blockers before publication.
 *
 * Two measurements, because one alone would lie:
 * - k-anonymity INSIDE our catalogue, on the quasi-identifiers §6.2 lists (stack, area, seniority, sectors, former
 *   clients, day rate). It says whether a company browsing Proofseen can single a person out. With a small catalogue
 *   every profile is unique, which says nothing about the real world: below MEANINGFUL_CATALOGUE_SIZE it is reported,
 *   not enforced.
 * - a SELF-SEARCH, run by the freelancer himself with queries built only from what the page shows. It is the only
 *   real-world test available without automating anything on LinkedIn or elsewhere (red line of the project).
 */

/** Below this size, within-catalogue k measures our smallness, not anybody's anonymity. HYPOTHÈSE. */
export const MEANINGFUL_CATALOGUE_SIZE = 50;
/** Once the catalogue is large enough, a profile must share its quasi-identifiers with at least this many. HYPOTHÈSE. */
export const K_MIN = 2;
/** A self-search goes stale: engines and the freelancer's own footprint change. HYPOTHÈSE. */
export const SELF_SEARCH_MAX_AGE_DAYS = 90;
/** PIVOT_ANONYME §6.3. */
export const WITHDRAWAL_DEADLINE_HOURS = 72;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const SelfSearchSchema = z.object({
  doneAt: z.iso.date(),
  /** "found" means the freelancer reached his own identity from the public facts: publication is refused. */
  outcome: z.enum(["not_found", "found"]),
  queriesRun: z.number().int().min(1).max(100),
});
export type SelfSearch = z.infer<typeof SelfSearchSchema>;

const areaKey = (area: string): string => area.split("/")[0]!.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const sorted = (values: readonly string[]): string => [...values].map((v) => v.toLowerCase()).sort().join("+");
/** Day rate generalised to a 100 € band: an exact rate is a fingerprint, a band is a market. */
const rateBand = (p: PublicProfile): string => (p.rate === null ? "none" : `${Math.floor(p.rate.min / 100) * 100}`);

/** The quasi-identifier tuple of §6.2. Two profiles with the same tuple are indistinguishable on those axes. */
export const quasiIdentifiers = (p: PublicProfile): string =>
  [areaKey(p.area), p.seniority.toLowerCase(), sorted(p.skills), sorted(p.sectors), sorted(p.missions.map((m) => m.clientKind)), rateBand(p)].join(" | ");

export interface KAnonymity {
  readonly id: string;
  readonly k: number;
}

export const kAnonymity = (profiles: readonly PublicProfile[]): KAnonymity[] => {
  const counts = new Map<string, number>();
  for (const p of profiles) counts.set(quasiIdentifiers(p), (counts.get(quasiIdentifiers(p)) ?? 0) + 1);
  return profiles.map((p) => ({ id: p.id, k: counts.get(quasiIdentifiers(p))! }));
};

/**
 * Queries the freelancer runs HIMSELF (search engine, LinkedIn logged in as himself, an AI assistant), built only from
 * what the public page shows. We generate them; we never run them.
 */
export const selfSearchQueries = (p: PublicProfile): string[] => {
  const area = p.area.split("/")[0]!.trim();
  const top = p.skills.slice(0, 3);
  const kinds = [...new Set(p.missions.map((m) => m.clientKind.replace("_", " ")))];
  return [
    `freelance ${top.join(" ")} ${area} ${p.seniority}`,
    `site:linkedin.com/in ${top.join(" ")} ${area} freelance`,
    `"${p.headline.fr}" ${area}`,
    ...(kinds.length === 0 ? [] : [`freelance ${top[0] ?? ""} ${area} ${kinds.join(" ")}`]),
    `Qui est le freelance ${p.headline.fr.toLowerCase()} à ${area}, ${p.seniority} d'expérience, ${p.sectors.join(", ") || "tous secteurs"} ?`,
  ];
};

export interface GateInput {
  readonly profiles: readonly PublicProfile[];
  readonly selfSearches: ReadonlyMap<string, SelfSearch | undefined>;
  readonly consentGivenAt: ReadonlyMap<string, string>;
  readonly now: Date;
}

const ageInDays = (isoDate: string, now: Date): number => Math.floor((now.getTime() - Date.parse(`${isoDate}T00:00:00Z`)) / DAY_MS);

const selfSearchBlocker = (id: string, search: SelfSearch | undefined, consentAt: string | undefined, now: Date): string | null => {
  if (search === undefined) return `${id} : aucune auto-recherche enregistrée — le test de ré-identification est obligatoire (§6.2)`;
  if (search.outcome === "found") return `${id} : l'auto-recherche a retrouvé l'identité réelle — généraliser le profil avant publication`;
  if (ageInDays(search.doneAt, now) > SELF_SEARCH_MAX_AGE_DAYS) return `${id} : auto-recherche du ${search.doneAt}, plus vieille que ${SELF_SEARCH_MAX_AGE_DAYS} jours`;
  if (consentAt !== undefined && search.doneAt < consentAt) return `${id} : auto-recherche antérieure au consentement du ${consentAt}`;
  return null;
};

/** Everything that forbids publishing today. Empty = the re-identification test is passed for every profile. */
export const publicationBlockers = ({ profiles, selfSearches, consentGivenAt, now }: GateInput): string[] => {
  const blockers = profiles
    .map((p) => selfSearchBlocker(p.id, selfSearches.get(p.id), consentGivenAt.get(p.id), now))
    .filter((b): b is string => b !== null);
  if (profiles.length >= MEANINGFUL_CATALOGUE_SIZE) {
    for (const { id, k } of kAnonymity(profiles)) {
      if (k < K_MIN) blockers.push(`${id} : k = ${k} — combinaison stack/zone/séniorité/secteurs/clients/TJM unique dans le catalogue`);
    }
  }
  return blockers;
};

export interface Takedown {
  readonly id: string;
  readonly withdrawnAt: string;
  readonly deadline: string;
  readonly overdue: boolean;
  readonly urls: readonly string[];
}

/** Withdrawn consents: the pages to take down, the 72 h deadline, and whether it is already missed. */
export const takedowns = (identities: readonly PrivateIdentity[], baseUrl: string, now: Date): Takedown[] =>
  identities
    .filter((identity) => identity.consent.withdrawnAt !== null)
    .map((identity) => {
      const withdrawnAt = identity.consent.withdrawnAt!;
      // withdrawnAt is a day: the 72 h start at the beginning of that day, the earliest reading, by caution.
      const deadline = new Date(Date.parse(`${withdrawnAt}T00:00:00Z`) + WITHDRAWAL_DEADLINE_HOURS * HOUR_MS);
      return {
        id: identity.profileId,
        withdrawnAt,
        deadline: deadline.toISOString(),
        overdue: now.getTime() > deadline.getTime(),
        urls: LOCALES.map((locale) => `${baseUrl}${profilePath(locale, identity.profileId)}`),
      };
    });
