import { z } from "zod";
import type { Db } from "./client";
import { containsContact, NO_CONTACT } from "./contact-detection";
import type { Prisma } from "./generated/client";
import type { JobPostStatus, WorkMode } from "./generated/enums";
import type { Actor } from "./messaging";
import { ensureSkills, skillKey } from "./skills";

/*
 * Missions publiées par les entreprises.
 *
 * Seuls les membres de l'entreprise créent, modifient, publient et clôturent ses missions ; la condition « membre » est
 * dans chaque requête d'écriture. Une mission d'une autre entreprise est « absente ».
 *
 * La recherche filtre, elle ne classe pas : l'ordre est celui que l'utilisateur choisit (plus récentes, TJM), jamais un
 * score de pertinence calculé. C'est la règle AI Act du projet, et c'est aussi ce qui rend la recherche explicable.
 */

const Uuid = z.uuid();
const CURRENCIES = ["EUR", "GBP", "CHF", "USD"] as const;
const MAX_RATE_CENTS = 10_000_000;
/** Un fichier de sitemap contient 50 000 adresses au plus ; chaque mission en compte deux (français, anglais). */
export const MAX_SITEMAP_MISSIONS = 25_000;

export const MissionInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(20_000),
    skills: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    durationMonths: z.number().int().min(1).max(600).nullable().default(null),
    dailyRateMinCents: z.number().int().min(0).max(MAX_RATE_CENTS).nullable().default(null),
    dailyRateMaxCents: z.number().int().min(0).max(MAX_RATE_CENTS).nullable().default(null),
    currency: z.enum(CURRENCIES).default("EUR"),
    city: z.string().trim().min(1).max(120).nullable().default(null),
    workMode: z.enum(["onsite", "hybrid", "remote"]),
  })
  .refine((m) => m.dailyRateMinCents === null || m.dailyRateMaxCents === null || m.dailyRateMinCents <= m.dailyRateMaxCents, {
    message: "le TJM minimum dépasse le maximum",
  })
  .refine((m) => m.workMode === "remote" || m.city !== null, { message: "une mission sur site ou hybride a une ville" })
  // Une mission est publique et lue par les moteurs : des coordonnées y ouvriraient un canal de candidature hors plateforme.
  .refine((m) => ![m.title, m.description, m.city, ...m.skills].some((field) => field !== null && containsContact(field)), { message: NO_CONTACT });

export type MissionInput = z.input<typeof MissionInputSchema>;

export const SEARCH_SORTS = ["recent", "rate_desc", "rate_asc"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const MissionSearchSchema = z.object({
  workModes: z.array(z.enum(["onsite", "hybrid", "remote"])).max(3).default([]),
  city: z.string().trim().min(1).max(120).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  /** Missions dont le TJM maximum atteint au moins ce montant. */
  minDailyRateCents: z.number().int().min(0).max(MAX_RATE_CENTS).optional(),
  maxDurationMonths: z.number().int().min(1).max(600).optional(),
  /** Usage interne (alertes) : seulement les missions publiées après cette date. */
  publishedAfter: z.date().optional(),
  sort: z.enum(SEARCH_SORTS).default("recent"),
  page: z.number().int().min(1).max(50).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export type MissionSearch = z.input<typeof MissionSearchSchema>;

export interface MissionRecord {
  readonly id: string;
  readonly organisationId: string;
  readonly organisationName: string;
  /** L'entreprise est active au répertoire officiel, à cette date ; `null` si ce n'est pas établi. */
  readonly organisationRegistryActiveCheckedAt: Date | null;
  /**
   * Délai médian, en jours, entre une candidature et la décision de l'entreprise, sur les six derniers mois ; `null`
   * sous RESPONSE_MIN_DECIDED décisions. Un fait sur une entreprise, pas une note de personne. Rempli par la page publique
   * d'une mission seulement.
   */
  readonly organisationResponse?: { readonly medianDays: number; readonly decided: number } | null;
  readonly title: string;
  readonly description: string;
  readonly skills: readonly string[];
  readonly durationMonths: number | null;
  readonly dailyRateMinCents: number | null;
  readonly dailyRateMaxCents: number | null;
  readonly currency: string;
  readonly city: string | null;
  readonly workMode: WorkMode;
  readonly status: JobPostStatus;
  readonly publishedAt: Date | null;
  readonly closedAt: Date | null;
}

export type MissionUpdateResult =
  | { readonly kind: "ok"; readonly mission: MissionRecord }
  /** Des freelances ont déjà postulé : la clôturer et en publier une nouvelle. */
  | { readonly kind: "locked" }
  | { readonly kind: "absent" };

export interface Missions {
  /** Brouillon créé par un membre de l'entreprise ; `null` si l'acteur n'en est pas membre. */
  create(actor: Actor, organisationId: string, input: MissionInput): Promise<MissionRecord | null>;
  /** Modifie un brouillon ou une mission ouverte ; `null` si elle n'est pas modifiable par l'acteur. */
  update(actor: Actor, missionId: string, input: MissionInput): Promise<MissionUpdateResult>;
  publish(actor: Actor, missionId: string, now: Date): Promise<boolean>;
  close(actor: Actor, missionId: string, now: Date): Promise<boolean>;
  /** Une mission ouverte, visible de tous ; `null` sinon. */
  findPublic(missionId: string, now?: Date): Promise<MissionRecord | null>;
  /** Toutes les missions de l'entreprise, brouillons compris, pour ses membres ; `null` pour les autres. */
  listForOrganisation(actor: Actor, organisationId: string): Promise<readonly MissionRecord[] | null>;
  search(filters: MissionSearch): Promise<{ readonly items: readonly MissionRecord[]; readonly hasMore: boolean }>;
  /** Les missions ouvertes pour le sitemap, les plus récentes d'abord, dans la limite d'un fichier de sitemap. */
  listOpenForSitemap(): Promise<readonly { readonly id: string; readonly publishedAt: Date }[]>;
}

const SELECT = {
  id: true,
  organisationId: true,
  title: true,
  description: true,
  durationMonths: true,
  dailyRateMinCents: true,
  dailyRateMaxCents: true,
  currency: true,
  city: true,
  workMode: true,
  status: true,
  publishedAt: true,
  closedAt: true,
  skills: { select: { skill: { select: { label: true } } } },
  organisation: { select: { name: true, registryStatus: true, registryCheckedAt: true } },
} as const;

type Row = Prisma.JobPostGetPayload<{ select: typeof SELECT }>;

const toRecord = ({ skills, organisation, ...row }: Row): MissionRecord => ({
  ...row,
  organisationName: organisation.name,
  organisationRegistryActiveCheckedAt: organisation.registryStatus === "active" ? organisation.registryCheckedAt : null,
  skills: skills.map((s) => s.skill.label),
});

const memberOf = (userId: string): Prisma.JobPostWhereInput => ({ organisation: { members: { some: { userId } } } });

export const RESPONSE_MIN_DECIDED = 3;
const RESPONSE_WINDOW_MS = 183 * 86_400_000;
const DAY_MS = 86_400_000;

/** Délai médian de décision d'une entreprise sur ses candidatures récentes (décisions de l'entreprise seulement). */
const responseOf = async (db: Db, organisationId: string, now: Date): Promise<{ readonly medianDays: number; readonly decided: number } | null> => {
  const rows = await db.application.findMany({
    where: { jobPost: { organisationId }, status: { in: ["shortlisted", "declined", "hired"] }, createdAt: { gte: new Date(now.getTime() - RESPONSE_WINDOW_MS) } },
    select: { createdAt: true, updatedAt: true },
    take: 500,
  });
  if (rows.length < RESPONSE_MIN_DECIDED) return null;
  const days = rows.map((r) => (r.updatedAt.getTime() - r.createdAt.getTime()) / DAY_MS).sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  const median = days.length % 2 === 1 ? (days[mid] ?? 0) : ((days[mid - 1] ?? 0) + (days[mid] ?? 0)) / 2;
  return { medianDays: Math.max(1, Math.round(median)), decided: rows.length };
};

const ORDER: Record<SearchSort, Prisma.JobPostOrderByWithRelationInput[]> = {
  recent: [{ publishedAt: "desc" }, { id: "desc" }],
  rate_desc: [{ dailyRateMaxCents: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  rate_asc: [{ dailyRateMinCents: { sort: "asc", nulls: "last" } }, { id: "desc" }],
};

/** Les colonnes de la mission ; les compétences, elles, vont dans leur table de liaison. */
const fields = (input: z.output<typeof MissionInputSchema>) => ({
  title: input.title,
  description: input.description,
  durationMonths: input.durationMonths,
  dailyRateMinCents: input.dailyRateMinCents,
  dailyRateMaxCents: input.dailyRateMaxCents,
  currency: input.currency,
  city: input.city,
  cityKey: input.city === null ? null : skillKey(input.city),
  workMode: input.workMode,
});

export const missions = (db: Db): Missions => ({
  async create(actor, organisationId, raw) {
    if (!Uuid.safeParse(organisationId).success) return null;
    const input = MissionInputSchema.parse(raw);
    const member = await db.membership.count({ where: { organisationId, userId: actor.userId } });
    if (member === 0) return null;
    return db.$transaction(async (tx) => {
      const skillIds = await ensureSkills(tx, input.skills);
      const row = await tx.jobPost.create({
        data: { ...fields(input), organisationId, authorUserId: actor.userId, skills: { create: skillIds.map((skillId) => ({ skillId })) } },
        select: SELECT,
      });
      return toRecord(row);
    });
  },

  async update(actor, missionId, raw) {
    if (!Uuid.safeParse(missionId).success) return { kind: "absent" };
    const input = MissionInputSchema.parse(raw);
    return db.$transaction(async (tx): Promise<MissionUpdateResult> => {
      const editable = { id: missionId, status: { in: ["draft" as const, "open" as const] }, ...memberOf(actor.userId) };
      // Une fois qu'un freelance a postulé, la mission ne change plus : il a postulé à ce TJM, ce lieu, cette durée.
      const { count } = await tx.jobPost.updateMany({ where: { ...editable, applications: { none: {} } }, data: fields(input) });
      if (count === 0) return (await tx.jobPost.count({ where: editable })) === 0 ? { kind: "absent" } : { kind: "locked" };
      const skillIds = await ensureSkills(tx, input.skills);
      await tx.jobPostSkill.deleteMany({ where: { jobPostId: missionId } });
      await tx.jobPostSkill.createMany({ data: skillIds.map((skillId) => ({ jobPostId: missionId, skillId })) });
      return { kind: "ok", mission: toRecord(await tx.jobPost.findUniqueOrThrow({ where: { id: missionId }, select: SELECT })) };
    });
  },

  async publish(actor, missionId, now) {
    if (!Uuid.safeParse(missionId).success) return false;
    const { count } = await db.jobPost.updateMany({
      where: { id: missionId, status: "draft", ...memberOf(actor.userId) },
      data: { status: "open", publishedAt: now },
    });
    return count === 1;
  },

  async close(actor, missionId, now) {
    if (!Uuid.safeParse(missionId).success) return false;
    const { count } = await db.jobPost.updateMany({
      where: { id: missionId, status: { in: ["draft", "open"] }, ...memberOf(actor.userId) },
      data: { status: "closed", closedAt: now },
    });
    return count === 1;
  },

  async findPublic(missionId, now = new Date()) {
    if (!Uuid.safeParse(missionId).success) return null;
    const row = await db.jobPost.findFirst({ where: { id: missionId, status: "open" }, select: SELECT });
    if (row === null) return null;
    return { ...toRecord(row), organisationResponse: await responseOf(db, row.organisationId, now) };
  },

  async listForOrganisation(actor, organisationId) {
    if (!Uuid.safeParse(organisationId).success) return null;
    const member = await db.membership.count({ where: { organisationId, userId: actor.userId } });
    if (member === 0) return null;
    const rows = await db.jobPost.findMany({ where: { organisationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: SELECT });
    return rows.map(toRecord);
  },

  async listOpenForSitemap() {
    const rows = await db.jobPost.findMany({
      where: { status: "open", publishedAt: { not: null } },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: MAX_SITEMAP_MISSIONS,
      select: { id: true, publishedAt: true },
    });
    return rows.flatMap((row) => (row.publishedAt === null ? [] : [{ id: row.id, publishedAt: row.publishedAt }]));
  },

  async search(raw) {
    const f = MissionSearchSchema.parse(raw);
    const skillKeys = [...new Set(f.skills.map(skillKey).filter((key) => key !== ""))];
    const where: Prisma.JobPostWhereInput = {
      status: "open",
      ...(f.workModes.length === 0 ? {} : { workMode: { in: f.workModes } }),
      ...(f.city === undefined ? {} : { cityKey: skillKey(f.city) }),
      ...(f.minDailyRateCents === undefined ? {} : { dailyRateMaxCents: { gte: f.minDailyRateCents } }),
      ...(f.maxDurationMonths === undefined ? {} : { durationMonths: { lte: f.maxDurationMonths } }),
      ...(f.publishedAfter === undefined ? {} : { publishedAt: { gt: f.publishedAfter } }),
      // Toutes les compétences demandées, pas l'une d'elles : un filtre se resserre, il ne s'élargit pas en douce.
      ...(skillKeys.length === 0 ? {} : { AND: skillKeys.map((key) => ({ skills: { some: { skill: { key } } } })) }),
    };
    const rows = await db.jobPost.findMany({
      where,
      orderBy: ORDER[f.sort],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize + 1,
      select: SELECT,
    });
    return { items: rows.slice(0, f.pageSize).map(toRecord), hasMore: rows.length > f.pageSize };
  },
});
