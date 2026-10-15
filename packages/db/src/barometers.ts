import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import { groupStats, MIN_BAROMETER_SAMPLE, missionRate, rateStat, type Observation, type RateStat } from "./barometer-stats";

/*
 * Baromètres publics, calculés dans la base au moment de la demande, à partir de données réelles de la plateforme :
 *
 * - TJM : ceux qu'affichent les profils publiés, et ceux que proposent les missions ouvertes ou publiées depuis moins de
 *   RECENT_MISSION_DAYS jours (milieu de la fourchette, ou la seule borne donnée). Les deux séries restent séparées :
 *   un TJM demandé et un TJM proposé ne mesurent pas la même chose. En euros seulement.
 * - Compétences : combien de missions publiées depuis moins de DEMAND_WINDOW_DAYS jours demandent chaque compétence.
 *
 * Aucun groupe ne sort sous son seuil d'effectif (MIN_BAROMETER_SAMPLE pour un TJM, MIN_SKILL_DEMAND pour une
 * compétence). Les totaux, eux, sont des comptes et sortent toujours : ils disent combien de données existent.
 */

export const RECENT_MISSION_DAYS = 90;
export const DEMAND_WINDOW_DAYS = 90;
export const MIN_SKILL_DEMAND = 5;
const MAX_ROWS = 20_000;
const DAY_MS = 86_400_000;

export interface RateSeries {
  /** Valeurs connues, tous groupes confondus (un compte, publié même sous le seuil). */
  readonly total: number;
  /** Toutes compétences et villes confondues, ou `null` sous le seuil. */
  readonly overall: RateStat | null;
  readonly bySkill: readonly RateStat[];
  readonly byCity: readonly RateStat[];
}

export interface RateBarometer {
  readonly computedAt: Date;
  readonly currency: "EUR";
  readonly minSample: number;
  /** Début de la fenêtre des missions récentes. */
  readonly missionsSince: Date;
  readonly profiles: RateSeries;
  readonly missions: RateSeries;
}

export interface SkillDemand {
  readonly key: string;
  readonly label: string;
  readonly missions: number;
}

export interface SkillBarometer {
  readonly computedAt: Date;
  readonly since: Date;
  readonly minCount: number;
  /** Missions publiées dans la fenêtre (un compte). */
  readonly totalMissions: number;
  /** Compétences demandées par au moins MIN_SKILL_DEMAND missions, de la plus demandée à la moins demandée. */
  readonly skills: readonly SkillDemand[];
}

export interface Barometers {
  rates(now?: Date): Promise<RateBarometer>;
  skills(now?: Date): Promise<SkillBarometer>;
}

interface Rated {
  readonly value: number;
  readonly city: string | null;
  readonly cityKey: string | null;
  readonly skills: readonly { readonly skill: { readonly key: string; readonly label: string } }[];
}

const SKILLS = { select: { skill: { select: { key: true, label: true } } } } as const;

const series = (rows: readonly Rated[]): RateSeries => {
  const bySkill: Observation[] = rows.flatMap((r) => r.skills.map(({ skill }) => ({ key: skill.key, label: skill.label, value: r.value })));
  const byCity: Observation[] = rows.flatMap((r) => (r.city === null || r.cityKey === null ? [] : [{ key: r.cityKey, label: r.city, value: r.value }]));
  return {
    total: rows.length,
    overall: rateStat("all", "all", rows.map((r) => r.value)),
    bySkill: groupStats(bySkill),
    byCity: groupStats(byCity),
  };
};

const publishedProfiles: Prisma.FreelanceProfileWhereInput = { visibility: { not: "private" }, slug: { not: null }, dailyRateCents: { not: null }, currency: "EUR" };

export const barometers = (db: Db): Barometers => ({
  async rates(now = new Date()) {
    const missionsSince = new Date(now.getTime() - RECENT_MISSION_DAYS * DAY_MS);
    const [profileRows, missionRows] = await Promise.all([
      db.freelanceProfile.findMany({ where: publishedProfiles, take: MAX_ROWS, select: { dailyRateCents: true, city: true, cityKey: true, skills: SKILLS } }),
      db.jobPost.findMany({
        where: {
          currency: "EUR",
          OR: [{ status: "open" }, { status: "closed", publishedAt: { gte: missionsSince } }],
          AND: [{ OR: [{ dailyRateMinCents: { not: null } }, { dailyRateMaxCents: { not: null } }] }],
        },
        take: MAX_ROWS,
        select: { dailyRateMinCents: true, dailyRateMaxCents: true, city: true, cityKey: true, skills: SKILLS },
      }),
    ]);
    const profiles = profileRows.flatMap((p) => (p.dailyRateCents === null ? [] : [{ value: p.dailyRateCents, city: p.city, cityKey: p.cityKey, skills: p.skills }]));
    const missions = missionRows.flatMap((m) => {
      const value = missionRate(m.dailyRateMinCents, m.dailyRateMaxCents);
      return value === null ? [] : [{ value, city: m.city, cityKey: m.cityKey, skills: m.skills }];
    });
    return { computedAt: now, currency: "EUR", minSample: MIN_BAROMETER_SAMPLE, missionsSince, profiles: series(profiles), missions: series(missions) };
  },

  async skills(now = new Date()) {
    const since = new Date(now.getTime() - DEMAND_WINDOW_DAYS * DAY_MS);
    const window: Prisma.JobPostWhereInput = { status: { in: ["open", "closed"] }, publishedAt: { gte: since, lte: now } };
    const [totalMissions, rows] = await Promise.all([
      db.jobPost.count({ where: window }),
      db.jobPostSkill.groupBy({ by: ["skillId"], where: { jobPost: window }, _count: { _all: true } }),
    ]);
    const kept = rows.filter((r) => r._count._all >= MIN_SKILL_DEMAND);
    const labels = kept.length === 0 ? [] : await db.skill.findMany({ where: { id: { in: kept.map((r) => r.skillId) } }, select: { id: true, key: true, label: true } });
    const byId = new Map(labels.map((s) => [s.id, s]));
    const skills = kept
      .flatMap((r) => {
        const skill = byId.get(r.skillId);
        return skill === undefined ? [] : [{ key: skill.key, label: skill.label, missions: r._count._all }];
      })
      .sort((a, b) => b.missions - a.missions || a.label.localeCompare(b.label, "fr"));
    return { computedAt: now, since, minCount: MIN_SKILL_DEMAND, totalMissions, skills };
  },
});
