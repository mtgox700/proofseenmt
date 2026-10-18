import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { AvailabilityStatus, WorkMode } from "./generated/enums";
import { jobTitlesOf } from "./job-titles";
import {
  explainMissionForProfile,
  explainProfileForMission,
  explainSimilarMission,
  explainSimilarProfile,
  orderExplained,
  type Explained,
  type MatchExplanation,
  type MatchMission,
  type MatchOptions,
  type MatchProfile,
} from "./matching-criteria";
import type { Actor } from "./messaging";
import { publicName } from "./public-profiles";
import { LISTED_MISSION, LISTED_PROFILE } from "./public-visibility";
import { sixMonthsBefore } from "./vigilance";

/*
 * Rapprochement expliqué (C22) : « Missions pour vous », « Missions proches », « Profils qui correspondent », « Profils
 * proches ». Aucun modèle d'IA, aucune note sur une personne : la base présélectionne les fiches qui partagent au moins
 * une compétence (requête bornée), puis matching-criteria.ts compare les faits un par un et dit pourquoi.
 *
 * Règles de visibilité, dans la requête : seulement des missions ouvertes et publiées, des profils publiés, ni masqués
 * ni suspendus (public-visibility.ts). Un profil pseudonyme ne montre que sa référence : la clé `displayName` est
 * absente. « Profils qui correspondent » n'existe que pour les membres de l'entreprise de la mission : une autre
 * entreprise reçoit `null`, comme une mission inconnue. Rien n'est gardé d'une requête à l'autre.
 */

/** Au plus 500 fiches lues par requête, les plus récentes d'abord ; la présélection le dit à l'écran quand elle est pleine. */
export const MAX_MATCH_CANDIDATES = 500;

const Uuid = z.uuid();
const Slug = z.string().trim().min(1).max(200);

export interface SuggestedMission {
  readonly id: string;
  readonly title: string;
  readonly organisationName: string;
  readonly city: string | null;
  readonly workMode: WorkMode;
  readonly dailyRateMinCents: number | null;
  readonly dailyRateMaxCents: number | null;
  readonly currency: string;
  readonly skills: readonly string[];
  readonly publishedAt: Date;
}

export interface SuggestedProfile {
  readonly id: string;
  readonly reference: string;
  readonly slug: string;
  /** Présent pour un profil nominatif seulement. */
  readonly displayName?: string;
  readonly headline: string;
  readonly city: string;
  readonly workMode: WorkMode;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  readonly availability: AvailabilityStatus;
  readonly availableFrom: Date | null;
  readonly skills: readonly string[];
  readonly updatedAt: Date;
}

export interface ProfileForMission extends SuggestedProfile {
  /** Déjà invité à postuler à cette mission. */
  readonly invited: boolean;
}

export interface Suggestions<T> {
  readonly items: readonly Explained<T>[];
  /** Fiches présélectionnées (au moins une compétence en commun), avant les critères exigés. */
  readonly considered: number;
  /** La présélection a atteint MAX_MATCH_CANDIDATES : les fiches plus anciennes n'ont pas été lues. */
  readonly capped: boolean;
}

export interface Matching {
  /** Les missions ouvertes proches du profil du freelance ; `null` s'il n'a pas de profil. */
  missionsForProfile(actor: Actor, options?: MatchOptions): Promise<Suggestions<SuggestedMission> | null>;
  /** Les missions ouvertes proches d'une mission publique ; `null` si elle n'est pas publique. */
  similarMissions(missionId: string, options?: MatchOptions): Promise<Suggestions<SuggestedMission> | null>;
  /** Les profils publiés qui correspondent à une mission, pour les membres de son entreprise ; `null` pour les autres. */
  profilesForMission(actor: Actor, missionId: string, options?: MatchOptions, now?: Date): Promise<Suggestions<ProfileForMission> | null>;
  /** Les profils publiés proches d'un profil publié ; `null` si celui-ci n'est pas public. */
  similarProfiles(slug: string, options?: MatchOptions): Promise<Suggestions<SuggestedProfile> | null>;
}

const SKILLS = { select: { skill: { select: { id: true, key: true, label: true } } } } as const;

const MISSION_SELECT = {
  id: true,
  organisationId: true,
  title: true,
  city: true,
  cityKey: true,
  workMode: true,
  dailyRateMinCents: true,
  dailyRateMaxCents: true,
  currency: true,
  publishedAt: true,
  createdAt: true,
  skills: SKILLS,
  organisation: { select: { name: true, registryStatus: true } },
} as const;

const PROFILE_SELECT = {
  id: true,
  reference: true,
  slug: true,
  visibility: true,
  headline: true,
  city: true,
  cityKey: true,
  workMode: true,
  dailyRateCents: true,
  currency: true,
  availability: true,
  availableFrom: true,
  availabilityAt: true,
  updatedAt: true,
  user: { select: { displayName: true } },
  skills: SKILLS,
  languages: { select: { code: true } },
  billing: { select: { registryStatus: true } },
  vigilance: { select: { issuedOn: true, verifiedAt: true } },
  _count: { select: { ownedUrls: { where: { verifiedAt: { not: null } } }, missions: true } },
} as const;

type MissionRow = Prisma.JobPostGetPayload<{ select: typeof MISSION_SELECT }>;
type ProfileRow = Prisma.FreelanceProfileGetPayload<{ select: typeof PROFILE_SELECT }>;

/** Une mission que tout le monde peut voir. */
const OPEN_MISSION = { status: "open", publishedAt: { not: null }, ...LISTED_MISSION } satisfies Prisma.JobPostWhereInput;

/** Un profil publié, complet, que personne n'a retiré du public (mêmes conditions que la recherche). */
const PUBLISHED_PROFILE = {
  visibility: { not: "private" },
  ...LISTED_PROFILE,
  slug: { not: null },
  headline: { not: null },
  city: { not: null },
} satisfies Prisma.FreelanceProfileWhereInput;

const skillsOf = (row: { readonly skills: readonly { readonly skill: { readonly id: string; readonly key: string; readonly label: string } }[] }) =>
  row.skills.map((s) => s.skill);

const sharingSkills = (skillIds: readonly string[]) => ({ skills: { some: { skillId: { in: [...skillIds] } } } });

const missionFacts = (row: MissionRow): MatchMission => ({
  id: row.id,
  skills: skillsOf(row),
  families: jobTitlesOf(row.title),
  city: row.city,
  cityKey: row.cityKey,
  workMode: row.workMode,
  rateMin: row.dailyRateMinCents,
  rateMax: row.dailyRateMaxCents,
  companyRegistryActive: row.organisation.registryStatus === "active",
  publishedAt: row.publishedAt ?? row.createdAt,
});

const profileFacts = (row: ProfileRow, now: Date): MatchProfile => ({
  id: row.id,
  skills: skillsOf(row),
  families: row.headline === null ? [] : jobTitlesOf(row.headline),
  city: row.city,
  cityKey: row.cityKey,
  workMode: row.workMode,
  rate: row.dailyRateCents,
  availability: row.availability,
  availableFrom: row.availableFrom,
  availabilityAt: row.availabilityAt,
  languages: row.languages.map((l) => l.code),
  provenUrls: row._count.ownedUrls,
  verifiedMissions: row._count.missions,
  registryActive: row.billing?.registryStatus === "active",
  vigilanceValid: row.vigilance !== null && row.vigilance.verifiedAt !== null && row.vigilance.issuedOn.getTime() > sixMonthsBefore(now).getTime(),
  updatedAt: row.updatedAt,
});

const labels = (row: { readonly skills: readonly { readonly skill: { readonly label: string } }[] }): readonly string[] =>
  row.skills.map((s) => s.skill.label).sort((a, b) => a.localeCompare(b, "fr"));

const suggestedMission = (row: MissionRow): SuggestedMission => ({
  id: row.id,
  title: row.title,
  organisationName: row.organisation.name,
  city: row.city,
  workMode: row.workMode,
  dailyRateMinCents: row.dailyRateMinCents,
  dailyRateMaxCents: row.dailyRateMaxCents,
  currency: row.currency,
  skills: labels(row),
  publishedAt: row.publishedAt ?? row.createdAt,
});

const suggestedProfile = (row: ProfileRow): SuggestedProfile => {
  const name = publicName(row.visibility, row.user.displayName);
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug ?? "",
    ...(name === null ? {} : { displayName: name }),
    headline: row.headline ?? "",
    city: row.city ?? "",
    workMode: row.workMode,
    dailyRateCents: row.dailyRateCents,
    currency: row.currency,
    availability: row.availability,
    availableFrom: row.availableFrom,
    skills: labels(row),
    updatedAt: row.updatedAt,
  };
};

const findMissions = (db: Db, where: Prisma.JobPostWhereInput): Promise<MissionRow[]> =>
  db.jobPost.findMany({ where: { ...OPEN_MISSION, ...where }, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: MAX_MATCH_CANDIDATES + 1, select: MISSION_SELECT });

const findProfiles = (db: Db, where: Prisma.FreelanceProfileWhereInput): Promise<ProfileRow[]> =>
  db.freelanceProfile.findMany({ where: { ...PUBLISHED_PROFILE, ...where }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: MAX_MATCH_CANDIDATES + 1, select: PROFILE_SELECT });

/** Compare chaque fiche lue, puis applique la règle d'ordre affichée. */
const rank = <R, T>(
  rows: readonly R[],
  explainRow: (row: R) => MatchExplanation & { readonly id: string; readonly date: Date },
  toItem: (row: R) => T,
  options: MatchOptions | undefined,
): Suggestions<T> => {
  const read = rows.slice(0, MAX_MATCH_CANDIDATES);
  const ordered = orderExplained(read.map((row) => ({ ...explainRow(row), row })), options);
  return {
    items: ordered.map(({ row, matched, missing }) => ({ item: toItem(row), matched, missing })),
    considered: read.length,
    capped: rows.length > MAX_MATCH_CANDIDATES,
  };
};

/** Une mission comparée, avec sa date de publication pour départager. */
const explainedMission = (explainFor: (m: MatchMission) => MatchExplanation) => (row: MissionRow) => {
  const facts = missionFacts(row);
  return { id: facts.id, date: facts.publishedAt, ...explainFor(facts) };
};

const EMPTY = { items: [], considered: 0, capped: false } as const;

export const matching = (db: Db): Matching => ({
  async missionsForProfile(actor, options) {
    const row = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: PROFILE_SELECT });
    if (row === null) return null;
    const profile = profileFacts(row, new Date());
    if (profile.skills.length === 0) return EMPTY;
    const rows = await findMissions(db, {
      ...sharingSkills(skillsOf(row).map((s) => s.id)),
      // Ni ses propres missions (membre de l'entreprise), ni celles où il a déjà postulé.
      organisation: { members: { none: { userId: actor.userId } } },
      applications: { none: { profileId: profile.id } },
    });
    return rank(rows, explainedMission((m) => explainMissionForProfile(profile, m)), suggestedMission, options);
  },

  async similarMissions(missionId, options) {
    if (!Uuid.safeParse(missionId).success) return null;
    const row = await db.jobPost.findFirst({ where: { ...OPEN_MISSION, id: missionId }, select: MISSION_SELECT });
    if (row === null) return null;
    const source = missionFacts(row);
    if (source.skills.length === 0) return EMPTY;
    const rows = await findMissions(db, { id: { not: source.id }, ...sharingSkills(skillsOf(row).map((s) => s.id)) });
    return rank(rows, explainedMission((m) => explainSimilarMission(source, m)), suggestedMission, options);
  },

  async profilesForMission(actor, missionId, options, now = new Date()) {
    if (!Uuid.safeParse(missionId).success) return null;
    const row = await db.jobPost.findFirst({
      // Une entreprise suspendue par l’opérateur n’a plus de missions en service : pas de suggestions non plus (relecture C22, B3).
      where: { id: missionId, status: { in: ["draft", "open"] }, organisation: { suspendedAt: null, members: { some: { userId: actor.userId } } } },
      select: MISSION_SELECT,
    });
    if (row === null) return null;
    const mission = missionFacts(row);
    if (mission.skills.length === 0) return EMPTY;
    const rows = await findProfiles(db, {
      ...sharingSkills(skillsOf(row).map((s) => s.id)),
      // Jamais un membre de l'entreprise ; un candidat est déjà dans la liste des candidatures.
      user: { suspendedAt: null, memberships: { none: { organisationId: row.organisationId } } },
      applications: { none: { jobPostId: missionId } },
    });
    const ranked = rank(rows, (r) => ({ id: r.id, date: r.updatedAt, ...explainProfileForMission(mission, profileFacts(r, now), now) }), suggestedProfile, options);
    const invited = await db.missionInvitation.findMany({
      where: { jobPostId: missionId, profileId: { in: ranked.items.map((s) => s.item.id) } },
      select: { profileId: true },
    });
    const invitedIds = new Set(invited.map((i) => i.profileId));
    return { ...ranked, items: ranked.items.map((s) => ({ ...s, item: { ...s.item, invited: invitedIds.has(s.item.id) } })) };
  },

  async similarProfiles(slug, options) {
    const parsed = Slug.safeParse(slug);
    if (!parsed.success) return null;
    const now = new Date();
    const row = await db.freelanceProfile.findFirst({ where: { ...PUBLISHED_PROFILE, slug: parsed.data }, select: PROFILE_SELECT });
    if (row === null) return null;
    const source = profileFacts(row, now);
    if (source.skills.length === 0) return EMPTY;
    const rows = await findProfiles(db, { id: { not: source.id }, ...sharingSkills(skillsOf(row).map((s) => s.id)) });
    return rank(rows, (r) => ({ id: r.id, date: r.updatedAt, ...explainSimilarProfile(source, profileFacts(r, now)) }), suggestedProfile, options);
  },
});
