import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { LanguageLevel } from "./generated/enums";
import { jobTitleByKey } from "./job-titles";
import { LANGUAGE_CODES, LANGUAGE_LEVELS, levelsAtLeast, MAX_LANGUAGE_FILTERS } from "./profile-section-schemas";
import { intersect, jobTitleMatches, MAX_SCAN, ProfileTextSchema, PUBLISHED_PROFILE, textMatches, verifiedFactsOrder } from "./profile-search-ids";
import type { ProfileFacts } from "./profiles";
import { publicName } from "./public-profiles";
import { SETTLED_PAYMENT } from "./reviews";
import { skillKey } from "./skills";
import { sixMonthsBefore } from "./vigilance";

/*
 * Recherche de freelances par une entreprise : des filtres sur des faits publics, et un ordre que l'entreprise choisit
 * parmi des critères neutres et datés (mise à jour du profil, TJM, date de disponibilité, nombre de faits vérifiés),
 * affiché à l'écran. Jamais une pertinence, un score ni un rang de personne (AI Act). À ordre égal, l'identifiant
 * départage, de façon stable et sans signification.
 *
 * Seuls les profils publiés sortent. Un profil pseudonyme ne porte pas de nom ni de photo : la clé `displayName` est
 * absente, pas seulement vide, et `photoFileId` est nul, pour qu'aucun écran ne puisse les afficher par erreur.
 */

const MAX_RATE_CENTS = 10_000_000;

/**
 * Une disponibilité déclarée ou confirmée il y a plus de 30 jours n'est plus tenue pour vraie : les filtres de
 * disponibilité ne retiennent pas le profil (l'écran de recherche le dit). Le profil reste trouvable sans ces filtres.
 */
export const AVAILABILITY_FRESH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const availabilityFreshSince = (now: Date): Date => new Date(now.getTime() - AVAILABILITY_FRESH_DAYS * DAY_MS);

/** C22 : « nombre de faits vérifiés » s'ajoute, un compte de faits nommés que chaque carte affiche (voir profile-search-ids). */
export const PROFILE_SORTS = ["recent", "rate_asc", "rate_desc", "availability", "verified_facts"] as const;
export type ProfileSort = (typeof PROFILE_SORTS)[number];

const JobTitleKeySchema = z.string().refine((key) => jobTitleByKey(key) !== undefined, { message: "famille de poste inconnue" });

export const ProfileSearchSchema = z.object({
  /** Mots-clés, en plein texte sur le titre, le résumé, les compétences et les intitulés d'expérience (sans accents). */
  text: ProfileTextSchema.optional(),
  /** Une famille de poste de la taxonomie (job-titles.ts), reconnue dans le titre du profil. */
  jobTitle: JobTitleKeySchema.optional(),
  workModes: z.array(z.enum(["onsite", "hybrid", "remote"])).max(3).default([]),
  city: z.string().trim().min(1).max(120).optional(),
  /** Toutes les compétences demandées doivent figurer au profil. */
  skills: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  /** Toutes les langues demandées, chacune au moins au niveau indiqué (C21) : un filtre sur le niveau déclaré. */
  languages: z.array(z.object({ code: z.enum(LANGUAGE_CODES), minLevel: z.enum(LANGUAGE_LEVELS) })).max(MAX_LANGUAGE_FILTERS).default([]),
  minDailyRateCents: z.number().int().min(0).max(MAX_RATE_CENTS).optional(),
  maxDailyRateCents: z.number().int().min(0).max(MAX_RATE_CENTS).optional(),
  availableOnly: z.boolean().default(false),
  /** Disponible tout de suite, d'après une disponibilité confirmée depuis 30 jours au plus. */
  availableNow: z.boolean().default(false),
  /** Disponible au plus tard à cette date : tout de suite, ou à partir d'une date antérieure ou égale. */
  availableBy: z.date().optional(),
  /** Seulement les profils qui ont prouvé posséder au moins une adresse. */
  provenOnly: z.boolean().default(false),
  /** Seulement les profils qui ont au moins une mission vérifiée sur pièce. */
  verifiedMissionsOnly: z.boolean().default(false),
  /** Seulement les profils dont l'entreprise est active au répertoire officiel (SIRET contrôlé). */
  registryActiveOnly: z.boolean().default(false),
  /** Seulement les profils dont l'attestation de vigilance URSSAF est vérifiée et en cours de validité. */
  vigilanceValidOnly: z.boolean().default(false),
  /** Seulement les profils qui montrent une photo : un profil nominatif, puisqu'un pseudonyme n'en montre jamais. */
  photoOnly: z.boolean().default(false),
  /** Seulement les profils qui présentent au moins une réalisation. */
  portfolioOnly: z.boolean().default(false),
  sort: z.enum(PROFILE_SORTS).default("recent"),
  page: z.number().int().min(1).max(50).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export type ProfileSearch = z.input<typeof ProfileSearchSchema>;
export type ProfileSearchFilters = z.output<typeof ProfileSearchSchema>;

/** Une carte de résultat : les faits du profil publié, plus les faits vérifiés que la page publique montre aussi. */
export interface ProfileCard extends ProfileFacts {
  /** Présent pour un profil nominatif seulement. */
  readonly displayName?: string;
  /** Photo publiée : profil nominatif seulement, `null` sinon. */
  readonly photoFileId: string | null;
  readonly registryActive: boolean;
  readonly vigilanceValid: boolean;
  /** Le prestataire de paiement a vérifié l'identité du titulaire (versements ouverts). */
  readonly identityVerified: boolean;
  /** Entreprises distinctes qui ont payé au moins une mission sur Proofseen. */
  readonly payingClients: number;
  readonly hasPortfolio: boolean;
  /**
   * Faits vérifiés, comptés un par un : missions vérifiées, adresses prouvées, SIRET actif, attestation URSSAF en cours.
   * Le critère de l'ordre « nombre de faits vérifiés », affiché sur la carte.
   */
  readonly verifiedFacts: number;
  /** Dernière déclaration ou confirmation de la disponibilité par le freelance. */
  readonly availabilityAt: Date;
  readonly updatedAt: Date;
  /** Les langues déclarées et leur niveau, déjà publiées sur la page du profil. */
  readonly languages: readonly { readonly code: string; readonly level: LanguageLevel }[];
}

export interface ProfileSearchPage {
  readonly items: readonly ProfileCard[];
  readonly hasMore: boolean;
}

type PrismaSort = Exclude<ProfileSort, "verified_facts">;

const ORDER: Readonly<Record<PrismaSort, Prisma.FreelanceProfileOrderByWithRelationInput[]>> = {
  recent: [{ updatedAt: "desc" }, { id: "desc" }],
  rate_asc: [{ dailyRateCents: { sort: "asc", nulls: "last" } }, { id: "desc" }],
  rate_desc: [{ dailyRateCents: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  // Ordre de l'énumération : disponible, disponible à partir d'une date, indisponible ; puis la date la plus proche.
  availability: [{ availability: "asc" }, { availableFrom: { sort: "asc", nulls: "first" } }, { id: "desc" }],
};

const SELECT = {
  id: true,
  reference: true,
  slug: true,
  visibility: true,
  headline: true,
  summary: true,
  city: true,
  workMode: true,
  dailyRateCents: true,
  currency: true,
  availability: true,
  availableFrom: true,
  availabilityAt: true,
  photoFileId: true,
  updatedAt: true,
  user: { select: { displayName: true } },
  skills: { select: { skill: { select: { label: true } } } },
  languages: { orderBy: { code: "asc" }, select: { code: true, level: true } },
  billing: { select: { registryStatus: true, payoutsEnabledAt: true } },
  vigilance: { select: { issuedOn: true, verifiedAt: true } },
  // Des entreprises distinctes, pas des contrats : dix micro-contrats avec la même entreprise ne font pas dix clients.
  contracts: { where: { payments: { some: SETTLED_PAYMENT }, organisationId: { not: null } }, select: { organisationId: true }, distinct: ["organisationId"] },
  _count: { select: { ownedUrls: { where: { verifiedAt: { not: null } } }, missions: true, portfolio: true } },
} as const satisfies Prisma.FreelanceProfileSelect;

type Row = Prisma.FreelanceProfileGetPayload<{ select: typeof SELECT }>;

const vigilanceValid = (since: Date): Prisma.VigilanceAttestationWhereInput => ({ verifiedAt: { not: null }, issuedOn: { gt: since } });

const rateFilter = (f: ProfileSearchFilters): Prisma.FreelanceProfileWhereInput =>
  f.minDailyRateCents === undefined && f.maxDailyRateCents === undefined
    ? {}
    : {
        dailyRateCents: {
          ...(f.minDailyRateCents === undefined ? {} : { gte: f.minDailyRateCents }),
          ...(f.maxDailyRateCents === undefined ? {} : { lte: f.maxDailyRateCents }),
        },
      };

/** Les conditions de disponibilité, chacune dans la liste AND : plusieurs peuvent porter sur la même colonne. */
const availabilityConditions = (f: ProfileSearchFilters, now: Date): Prisma.FreelanceProfileWhereInput[] => {
  const fresh = f.availableOnly || f.availableNow || f.availableBy !== undefined;
  return [
    ...(f.availableBy === undefined ? [] : [{ OR: [{ availability: "available" as const }, { availability: "available_from" as const, availableFrom: { lte: f.availableBy } }] }]),
    ...(f.availableOnly ? [{ availability: { not: "unavailable" as const } }] : []),
    ...(f.availableNow ? [{ availability: "available" as const }] : []),
    ...(fresh ? [{ availabilityAt: { gte: availabilityFreshSince(now) } }] : []),
  ];
};

/** Les faits vérifiés demandés, et la photo ou les réalisations. */
const factConditions = (f: ProfileSearchFilters, now: Date): Prisma.FreelanceProfileWhereInput => ({
  ...(f.provenOnly ? { ownedUrls: { some: { verifiedAt: { not: null } } } } : {}),
  ...(f.verifiedMissionsOnly ? { missions: { some: {} } } : {}),
  ...(f.registryActiveOnly ? { billing: { registryStatus: "active" } } : {}),
  ...(f.vigilanceValidOnly ? { vigilance: vigilanceValid(sixMonthsBefore(now)) } : {}),
  ...(f.photoOnly ? { visibility: "named", photoFileId: { not: null } } : {}),
  ...(f.portfolioOnly ? { portfolio: { some: {} } } : {}),
});

/**
 * Les conditions Prisma de la recherche ; seulement des profils publiés et complets. Les mots-clés et la famille de
 * poste n'y sont pas : ils passent par `restrictedIds`, puis par `id IN …`.
 */
export const searchWhere = (f: ProfileSearchFilters, now: Date): Prisma.FreelanceProfileWhereInput => {
  const skillKeys = [...new Set(f.skills.map(skillKey).filter((key) => key !== ""))];
  const and: Prisma.FreelanceProfileWhereInput[] = [
    ...skillKeys.map((key) => ({ skills: { some: { skill: { key } } } })),
    ...f.languages.map((l) => ({ languages: { some: { code: l.code, level: { in: [...levelsAtLeast(l.minLevel)] } } } })),
    ...availabilityConditions(f, now),
  ];
  return {
    ...PUBLISHED_PROFILE,
    ...(f.workModes.length === 0 ? {} : { workMode: { in: f.workModes } }),
    ...(f.city === undefined ? {} : { cityKey: skillKey(f.city) }),
    ...rateFilter(f),
    // Après PUBLISHED_PROFILE : « photo » resserre la visibilité à un profil nominatif, toujours publié.
    ...factConditions(f, now),
    ...(and.length === 0 ? {} : { AND: and }),
  };
};

/** Les profils que les mots-clés et la famille de poste laissent passer ; `null` quand aucun des deux n'est demandé. */
export const restrictedIds = async (db: Db, f: Pick<ProfileSearchFilters, "text" | "jobTitle">): Promise<readonly string[] | null> => {
  const byText = f.text === undefined ? null : await textMatches(db, f.text);
  if (byText !== null && byText.length === 0) return byText;
  const byTitle = f.jobTitle === undefined ? null : await jobTitleMatches(db, f.jobTitle);
  return intersect(byText, byTitle);
};

/** Les conditions complètes : celles de Prisma, et la liste d'identifiants des mots-clés et du poste. */
export const fullWhere = async (db: Db, f: ProfileSearchFilters, now: Date): Promise<Prisma.FreelanceProfileWhereInput> => {
  const ids = await restrictedIds(db, f);
  const where = searchWhere(f, now);
  return ids === null ? where : { AND: [where, { id: { in: [...ids] } }] };
};

const toCard = (row: Row, since: Date): ProfileCard => {
  const { user, skills, billing, vigilance, contracts, _count, photoFileId, ...facts } = row;
  const name = publicName(row.visibility, user.displayName);
  const registryActive = billing?.registryStatus === "active";
  const vigilanceOk = vigilance !== null && vigilance.verifiedAt !== null && vigilance.issuedOn.getTime() > since.getTime();
  return {
    ...facts,
    ...(name === null ? {} : { displayName: name }),
    // La photo suit le nom : un profil pseudonyme, ou dont le nom n'est pas publiable, ne montre jamais de visage.
    photoFileId: name === null ? null : photoFileId,
    skills: skills.map((s) => s.skill.label).sort((a, b) => a.localeCompare(b, "fr")),
    verifiedUrls: _count.ownedUrls,
    verifiedMissions: _count.missions,
    registryActive,
    vigilanceValid: vigilanceOk,
    identityVerified: billing?.payoutsEnabledAt != null,
    payingClients: contracts.length,
    hasPortfolio: _count.portfolio > 0,
    verifiedFacts: _count.ownedUrls + _count.missions + (registryActive ? 1 : 0) + (vigilanceOk ? 1 : 0),
  };
};

/** Les cartes de ces profils, dans l'ordre des identifiants reçus. */
const cardsInOrder = async (db: Db, ids: readonly string[], since: Date): Promise<readonly ProfileCard[]> => {
  const rows = await db.freelanceProfile.findMany({ where: { id: { in: [...ids] } }, select: SELECT });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [toCard(row, since)];
  });
};

export const searchProfiles = async (db: Db, raw: ProfileSearch, now: Date): Promise<ProfileSearchPage> => {
  const f = ProfileSearchSchema.parse(raw);
  const where = await fullWhere(db, f, now);
  const since = sixMonthsBefore(now);
  const skip = (f.page - 1) * f.pageSize;
  if (f.sort === "verified_facts") {
    // L'ordre se calcule sur les profils les plus récemment mis à jour qui répondent aux filtres, au plus MAX_SCAN.
    const candidates = await db.freelanceProfile.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: MAX_SCAN, select: { id: true } });
    const ids = await verifiedFactsOrder(db, candidates.map((c) => c.id), since, skip, f.pageSize + 1);
    const items = await cardsInOrder(db, ids.slice(0, f.pageSize), since);
    return { items, hasMore: ids.length > f.pageSize };
  }
  const rows = await db.freelanceProfile.findMany({ where, orderBy: ORDER[f.sort], skip, take: f.pageSize + 1, select: SELECT });
  return { items: rows.slice(0, f.pageSize).map((row) => toCard(row, since)), hasMore: rows.length > f.pageSize };
};
