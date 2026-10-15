import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { ProfileFacts } from "./profiles";
import { publicName } from "./public-profiles";
import { skillKey } from "./skills";
import { sixMonthsBefore } from "./vigilance";

/*
 * Recherche de freelances par une entreprise : des filtres sur des faits publics, et un ordre que l'entreprise choisit
 * parmi des critères neutres et datés (mise à jour du profil, TJM, date de disponibilité), affiché à l'écran. Jamais
 * une pertinence, un score ni un rang de personne (AI Act). À ordre égal, l'identifiant départage, de façon stable et
 * sans signification.
 *
 * Seuls les profils publiés sortent. Un profil pseudonyme ne porte pas de nom : la clé `displayName` est absente, pas
 * seulement vide, pour qu'aucun écran ne puisse l'afficher par erreur.
 */

const MAX_RATE_CENTS = 10_000_000;

/**
 * Une disponibilité déclarée ou confirmée il y a plus de 30 jours n'est plus tenue pour vraie : les filtres de
 * disponibilité ne retiennent pas le profil (l'écran de recherche le dit). Le profil reste trouvable sans ces filtres.
 */
export const AVAILABILITY_FRESH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const availabilityFreshSince = (now: Date): Date => new Date(now.getTime() - AVAILABILITY_FRESH_DAYS * DAY_MS);

export const PROFILE_SORTS = ["recent", "rate_asc", "rate_desc", "availability"] as const;
export type ProfileSort = (typeof PROFILE_SORTS)[number];

export const ProfileSearchSchema = z.object({
  workModes: z.array(z.enum(["onsite", "hybrid", "remote"])).max(3).default([]),
  city: z.string().trim().min(1).max(120).optional(),
  /** Toutes les compétences demandées doivent figurer au profil. */
  skills: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  minDailyRateCents: z.number().int().min(0).max(MAX_RATE_CENTS).optional(),
  maxDailyRateCents: z.number().int().min(0).max(MAX_RATE_CENTS).optional(),
  availableOnly: z.boolean().default(false),
  /** Disponible au plus tard à cette date : tout de suite, ou à partir d'une date antérieure ou égale. */
  availableBy: z.date().optional(),
  /** Seulement les profils qui ont prouvé posséder au moins une adresse. */
  provenOnly: z.boolean().default(false),
  /** Seulement les profils dont l'entreprise est active au répertoire officiel (SIRET contrôlé). */
  registryActiveOnly: z.boolean().default(false),
  /** Seulement les profils dont l'attestation de vigilance URSSAF est vérifiée et en cours de validité. */
  vigilanceValidOnly: z.boolean().default(false),
  sort: z.enum(PROFILE_SORTS).default("recent"),
  page: z.number().int().min(1).max(50).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export type ProfileSearch = z.input<typeof ProfileSearchSchema>;
type Filters = z.output<typeof ProfileSearchSchema>;

/** Une carte de résultat : les faits du profil publié, plus les faits vérifiés que la page publique montre aussi. */
export interface ProfileCard extends ProfileFacts {
  /** Présent pour un profil nominatif seulement. */
  readonly displayName?: string;
  readonly registryActive: boolean;
  readonly vigilanceValid: boolean;
  readonly updatedAt: Date;
}

export interface ProfileSearchPage {
  readonly items: readonly ProfileCard[];
  readonly hasMore: boolean;
}

const ORDER: Readonly<Record<ProfileSort, Prisma.FreelanceProfileOrderByWithRelationInput[]>> = {
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
  updatedAt: true,
  user: { select: { displayName: true } },
  skills: { select: { skill: { select: { label: true } } } },
  billing: { select: { registryStatus: true } },
  vigilance: { select: { issuedOn: true, verifiedAt: true } },
  _count: { select: { ownedUrls: { where: { verifiedAt: { not: null } } }, missions: true } },
} as const;

type Row = Prisma.FreelanceProfileGetPayload<{ select: typeof SELECT }>;

const vigilanceValid = (since: Date): Prisma.VigilanceAttestationWhereInput => ({ verifiedAt: { not: null }, issuedOn: { gt: since } });

const rateFilter = (f: Filters): Prisma.FreelanceProfileWhereInput =>
  f.minDailyRateCents === undefined && f.maxDailyRateCents === undefined
    ? {}
    : {
        dailyRateCents: {
          ...(f.minDailyRateCents === undefined ? {} : { gte: f.minDailyRateCents }),
          ...(f.maxDailyRateCents === undefined ? {} : { lte: f.maxDailyRateCents }),
        },
      };

/** Les conditions de la recherche ; seulement des profils publiés et complets. */
export const searchWhere = (f: Filters, now: Date): Prisma.FreelanceProfileWhereInput => {
  const skillKeys = [...new Set(f.skills.map(skillKey).filter((key) => key !== ""))];
  const and: Prisma.FreelanceProfileWhereInput[] = [
    ...skillKeys.map((key) => ({ skills: { some: { skill: { key } } } })),
    ...(f.availableBy === undefined ? [] : [{ OR: [{ availability: "available" as const }, { availability: "available_from" as const, availableFrom: { lte: f.availableBy } }] }]),
  ];
  return {
    visibility: { not: "private" },
    slug: { not: null },
    headline: { not: null },
    city: { not: null },
    ...(f.workModes.length === 0 ? {} : { workMode: { in: f.workModes } }),
    ...(f.city === undefined ? {} : { cityKey: skillKey(f.city) }),
    ...rateFilter(f),
    ...(f.availableOnly ? { availability: { not: "unavailable" } } : {}),
    ...(f.availableOnly || f.availableBy !== undefined ? { availabilityAt: { gte: availabilityFreshSince(now) } } : {}),
    ...(f.provenOnly ? { ownedUrls: { some: { verifiedAt: { not: null } } } } : {}),
    ...(f.registryActiveOnly ? { billing: { registryStatus: "active" } } : {}),
    ...(f.vigilanceValidOnly ? { vigilance: vigilanceValid(sixMonthsBefore(now)) } : {}),
    ...(and.length === 0 ? {} : { AND: and }),
  };
};

const toCard = (row: Row, since: Date): ProfileCard => {
  const { user, skills, billing, vigilance, _count, ...facts } = row;
  const name = publicName(row.visibility, user.displayName);
  return {
    ...facts,
    ...(name === null ? {} : { displayName: name }),
    skills: skills.map((s) => s.skill.label).sort((a, b) => a.localeCompare(b, "fr")),
    verifiedUrls: _count.ownedUrls,
    verifiedMissions: _count.missions,
    registryActive: billing?.registryStatus === "active",
    vigilanceValid: vigilance !== null && vigilance.verifiedAt !== null && vigilance.issuedOn.getTime() > since.getTime(),
  };
};

export const searchProfiles = async (db: Db, raw: ProfileSearch, now: Date): Promise<ProfileSearchPage> => {
  const f = ProfileSearchSchema.parse(raw);
  const rows = await db.freelanceProfile.findMany({
    where: searchWhere(f, now),
    orderBy: ORDER[f.sort],
    skip: (f.page - 1) * f.pageSize,
    take: f.pageSize + 1,
    select: SELECT,
  });
  const since = sixMonthsBefore(now);
  return { items: rows.slice(0, f.pageSize).map((row) => toCard(row, since)), hasMore: rows.length > f.pageSize };
};
