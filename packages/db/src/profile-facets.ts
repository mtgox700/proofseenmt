import type { Db } from "./client";
import type { WorkMode } from "./generated/enums";
import { JOB_TITLES, matchesFoldedJobTitle } from "./job-titles";
import { availabilityFreshSince, fullWhere, ProfileSearchSchema, restrictedIds, type ProfileSearch, type ProfileSearchFilters } from "./profile-search";
import { scanHeadlines, type HeadlineRow } from "./profile-search-ids";
import { foldText } from "./search-text";
import { sixMonthsBefore } from "./vigilance";

/*
 * Facettes de la recherche de freelances : à côté de chaque option, le nombre de profils publiés qui répondraient si on
 * la cochait. Des effectifs de profils, jamais une note de personne.
 *
 * Calcul borné : les identifiants des profils retenus (au plus MAX_SCAN, les plus récemment mis à jour), puis un GROUP BY
 * par facette sur ces identifiants. Au-delà, `capped` est vrai et l'écran dit « au moins ». Pour la ville, le mode de
 * travail et la famille de poste — un seul choix ou un choix parmi plusieurs —, l'effectif est compté sans le filtre de
 * cette dimension, pour que les autres options gardent leur nombre ; les autres facettes s'ajoutent aux filtres posés.
 */

const MAX_SKILL_VALUES = 20;
const MAX_CITY_VALUES = 12;

export interface FacetValue {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface ProfileFacets {
  /** Profils publiés qui répondent à tous les filtres, comptés jusqu'à MAX_SCAN. */
  readonly total: number;
  /** Plus de MAX_SCAN profils répondent : les effectifs sont des minimums. */
  readonly capped: boolean;
  readonly skills: readonly FacetValue[];
  readonly cities: readonly FacetValue[];
  readonly workModes: Readonly<Record<WorkMode, number>>;
  /** Familles de poste, dans l'ordre de la taxonomie, avec au moins un profil. */
  readonly jobTitles: readonly { readonly key: string; readonly count: number }[];
  readonly languages: readonly { readonly code: string; readonly count: number }[];
  readonly facts: {
    readonly proven: number;
    readonly verifiedMissions: number;
    readonly registryActive: number;
    readonly vigilanceValid: number;
    readonly photo: number;
    readonly portfolio: number;
    readonly availableNow: number;
  };
}

type Dimension = "city" | "workModes" | "jobTitle";

/** Les filtres sans ceux d'une dimension, pour compter ses options. */
const without = (f: ProfileSearchFilters, dimension: Dimension): ProfileSearchFilters => {
  if (dimension === "workModes") return { ...f, workModes: [] };
  const kept = Object.entries(f).filter(([key]) => key !== (dimension === "city" ? "city" : "jobTitle"));
  return ProfileSearchSchema.parse(Object.fromEntries(kept));
};

const isActive = (f: ProfileSearchFilters, dimension: Dimension): boolean =>
  dimension === "city" ? f.city !== undefined : dimension === "workModes" ? f.workModes.length > 0 : f.jobTitle !== undefined;

/** Les profils retenus par ces filtres, bornés ; `known` : la restriction des mots-clés et du poste, déjà calculée. */
const matching = async (db: Db, f: ProfileSearchFilters, now: Date, known?: readonly string[] | null): Promise<{ readonly rows: readonly HeadlineRow[]; readonly capped: boolean }> =>
  scanHeadlines(db, await fullWhere(db, f, now, known));

const idsOf = (rows: readonly HeadlineRow[]): string[] => rows.map((row) => row.id);

const skillFacet = async (db: Db, ids: readonly string[]): Promise<readonly FacetValue[]> => {
  if (ids.length === 0) return [];
  const rows = await db.$queryRaw<{ key: string; label: string; n: number }[]>`
    SELECT s."key" AS "key", min(s."label") AS "label", count(*)::int AS "n"
    FROM "FreelanceSkill" fs JOIN "Skill" s ON s."id" = fs."skillId"
    WHERE fs."profileId" = ANY(${[...ids]}::uuid[])
    GROUP BY s."key" ORDER BY "n" DESC, s."key" ASC LIMIT ${MAX_SKILL_VALUES}`;
  return rows.map((r) => ({ key: r.key, label: r.label, count: r.n }));
};

const cityFacet = async (db: Db, ids: readonly string[]): Promise<readonly FacetValue[]> => {
  if (ids.length === 0) return [];
  const rows = await db.$queryRaw<{ key: string; label: string; n: number }[]>`
    SELECT "cityKey" AS "key", min("city") AS "label", count(*)::int AS "n"
    FROM "FreelanceProfile" WHERE "id" = ANY(${[...ids]}::uuid[]) AND "cityKey" IS NOT NULL AND "city" IS NOT NULL
    GROUP BY "cityKey" ORDER BY "n" DESC, "cityKey" ASC LIMIT ${MAX_CITY_VALUES}`;
  return rows.map((r) => ({ key: r.key, label: r.label, count: r.n }));
};

const workModeFacet = async (db: Db, ids: readonly string[]): Promise<Readonly<Record<WorkMode, number>>> => {
  const counts: Record<WorkMode, number> = { remote: 0, hybrid: 0, onsite: 0 };
  if (ids.length === 0) return counts;
  const rows = await db.$queryRaw<{ mode: WorkMode; n: number }[]>`
    SELECT "workMode"::text AS "mode", count(*)::int AS "n" FROM "FreelanceProfile" WHERE "id" = ANY(${[...ids]}::uuid[]) GROUP BY "workMode"`;
  return rows.reduce((acc, r) => ({ ...acc, [r.mode]: r.n }), counts);
};

const languageFacet = async (db: Db, ids: readonly string[]): Promise<readonly { readonly code: string; readonly count: number }[]> => {
  if (ids.length === 0) return [];
  const rows = await db.$queryRaw<{ code: string; n: number }[]>`
    SELECT trim("code") AS "code", count(*)::int AS "n" FROM "ProfileLanguage" WHERE "profileId" = ANY(${[...ids]}::uuid[])
    GROUP BY "code" ORDER BY "n" DESC, "code" ASC`;
  return rows.map((r) => ({ code: r.code, count: r.n }));
};

const NO_FACTS: ProfileFacets["facts"] = { proven: 0, verifiedMissions: 0, registryActive: 0, vigilanceValid: 0, photo: 0, portfolio: 0, availableNow: 0 };

const factFacet = async (db: Db, ids: readonly string[], now: Date): Promise<ProfileFacets["facts"]> => {
  if (ids.length === 0) return NO_FACTS;
  const rows = await db.$queryRaw<{ proven: number; missions: number; registry: number; vigilance: number; photo: number; portfolio: number; now: number }[]>`
    SELECT
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "OwnedUrl" o WHERE o."profileId" = p."id" AND o."verifiedAt" IS NOT NULL))::int AS "proven",
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "VerifiedMission" m WHERE m."profileId" = p."id"))::int AS "missions",
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "BillingIdentity" b WHERE b."profileId" = p."id" AND b."registryStatus" = 'active'))::int AS "registry",
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "VigilanceAttestation" v WHERE v."profileId" = p."id" AND v."verifiedAt" IS NOT NULL AND v."issuedOn" > ${sixMonthsBefore(now)}))::int AS "vigilance",
      count(*) FILTER (WHERE p."visibility" = 'named' AND p."photoFileId" IS NOT NULL)::int AS "photo",
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PortfolioItem" i WHERE i."profileId" = p."id"))::int AS "portfolio",
      count(*) FILTER (WHERE p."availability" = 'available' AND p."availabilityAt" >= ${availabilityFreshSince(now)})::int AS "now"
    FROM "FreelanceProfile" p WHERE p."id" = ANY(${[...ids]}::uuid[])`;
  const r = rows[0];
  return r === undefined
    ? NO_FACTS
    : { proven: r.proven, verifiedMissions: r.missions, registryActive: r.registry, vigilanceValid: r.vigilance, photo: r.photo, portfolio: r.portfolio, availableNow: r.now };
};

/** Chaque titre est replié une fois, puis comparé à chaque famille : pas une fois par famille. */
const jobTitleFacet = (rows: readonly HeadlineRow[]): ProfileFacets["jobTitles"] => {
  const folded = rows.flatMap((row) => (row.headline === null ? [] : [foldText(row.headline)]));
  return JOB_TITLES.map((t) => ({ key: t.key, count: folded.filter((title) => matchesFoldedJobTitle(t.key, title)).length })).filter((t) => t.count > 0);
};

/**
 * Les profils d'une dimension : sans son filtre s'il est posé, sinon l'ensemble déjà retenu. Retirer la ville ou le mode
 * garde les mots-clés et le poste : la restriction déjà calculée resservira.
 */
const forDimension = async (db: Db, f: ProfileSearchFilters, dimension: Dimension, base: readonly HeadlineRow[], restricted: readonly string[] | null, now: Date): Promise<readonly HeadlineRow[]> => {
  if (!isActive(f, dimension)) return base;
  return (await matching(db, without(f, dimension), now, dimension === "jobTitle" ? undefined : restricted)).rows;
};

export const profileFacets = async (db: Db, raw: ProfileSearch, now: Date): Promise<ProfileFacets> => {
  const f = ProfileSearchSchema.parse(raw);
  const restricted = await restrictedIds(db, f);
  const base = await matching(db, f, now, restricted);
  const ids = idsOf(base.rows);
  const cityRows = await forDimension(db, f, "city", base.rows, restricted, now);
  const modeRows = await forDimension(db, f, "workModes", base.rows, restricted, now);
  const titleRows = await forDimension(db, f, "jobTitle", base.rows, restricted, now);
  const [skills, cities, workModes, languages, facts] = await Promise.all([
    skillFacet(db, ids),
    cityFacet(db, idsOf(cityRows)),
    workModeFacet(db, idsOf(modeRows)),
    languageFacet(db, ids),
    factFacet(db, ids, now),
  ]);
  return { total: ids.length, capped: base.capped, skills, cities, workModes, jobTitles: jobTitleFacet(titleRows), languages, facts };
};
