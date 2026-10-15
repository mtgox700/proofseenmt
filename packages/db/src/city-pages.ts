import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { WorkMode } from "./generated/enums";
import { skillKey } from "./skills";

/*
 * Pages par ville : les missions ouvertes d'une ville. Comme les pages métiers, une page n'existe que remplie de
 * contenu réel — au moins MIN_CITY_MISSIONS missions ouvertes ; en deçà, elle répond « absente » et n'entre pas dans le
 * sitemap. L'ordre est celui des publications, les plus récentes d'abord : un fait daté, jamais un classement.
 *
 * Les faits de la page sont comptés au moment du rendu. La fourchette de TJM n'est écrite qu'à partir de
 * MIN_CITY_RATE_SAMPLE missions qui affichent un TJM, avec son n.
 */

export const MIN_CITY_MISSIONS = 2;
export const MIN_CITY_RATE_SAMPLE = 5;
const MAX_ITEMS = 50;
const MAX_SKILLS_LISTED = 30;
const MAX_SITEMAP_CITIES = 5000;
const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface CityMission {
  readonly id: string;
  readonly title: string;
  readonly organisationName: string;
  readonly workMode: WorkMode;
  readonly city: string | null;
  readonly skills: readonly string[];
  readonly dailyRateMinCents: number | null;
  readonly dailyRateMaxCents: number | null;
  readonly currency: string;
  readonly publishedAt: Date;
}

export interface CityPage {
  readonly key: string;
  /** La ville telle que l'a écrite l'entreprise de la mission la plus récente. */
  readonly label: string;
  readonly missions: readonly CityMission[];
  readonly facts: {
    readonly missionCount: number;
    /** Compétences demandées par ces missions, par ordre alphabétique. */
    readonly skills: readonly string[];
    /** TJM affichés par ces missions, en euros ; `null` sous MIN_CITY_RATE_SAMPLE missions qui l'affichent. */
    readonly dailyRate: { readonly n: number; readonly minCents: number; readonly maxCents: number; readonly currency: "EUR" } | null;
  };
  readonly generatedAt: Date;
}

export interface CityIndexEntry {
  readonly key: string;
  readonly label: string;
  readonly missions: number;
}

export interface CityPages {
  page(key: string, now?: Date): Promise<CityPage | null>;
  /** Les villes qui ont une page : pour le sitemap des missions. */
  listForSitemap(): Promise<readonly CityIndexEntry[]>;
}

const openIn = (cityKey: string): Prisma.JobPostWhereInput => ({ status: "open", cityKey, publishedAt: { not: null } });

const rateRange = (rows: readonly { dailyRateMinCents: number | null; dailyRateMaxCents: number | null; currency: string }[]): CityPage["facts"]["dailyRate"] => {
  const euros = rows.filter((r) => r.currency === "EUR" && (r.dailyRateMinCents !== null || r.dailyRateMaxCents !== null));
  if (euros.length < MIN_CITY_RATE_SAMPLE) return null;
  const lows = euros.map((r) => r.dailyRateMinCents ?? r.dailyRateMaxCents ?? 0);
  const highs = euros.map((r) => r.dailyRateMaxCents ?? r.dailyRateMinCents ?? 0);
  return { n: euros.length, minCents: Math.min(...lows), maxCents: Math.max(...highs), currency: "EUR" };
};

export const cityPages = (db: Db): CityPages => ({
  async page(raw, now = new Date()) {
    const key = skillKey(raw);
    if (!KEY.test(key) || key !== raw || key.length > 120) return null;
    const [count, rows] = await Promise.all([
      db.jobPost.count({ where: openIn(key) }),
      db.jobPost.findMany({
        where: openIn(key),
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: MAX_ITEMS,
        select: {
          id: true,
          title: true,
          workMode: true,
          city: true,
          dailyRateMinCents: true,
          dailyRateMaxCents: true,
          currency: true,
          publishedAt: true,
          organisation: { select: { name: true } },
          skills: { select: { skill: { select: { label: true } } } },
        },
      }),
    ]);
    if (count < MIN_CITY_MISSIONS) return null;
    const missions = rows.flatMap((r) =>
      r.publishedAt === null
        ? []
        : [
            {
              id: r.id,
              title: r.title,
              organisationName: r.organisation.name,
              workMode: r.workMode,
              city: r.city,
              skills: r.skills.map((s) => s.skill.label),
              dailyRateMinCents: r.dailyRateMinCents,
              dailyRateMaxCents: r.dailyRateMaxCents,
              currency: r.currency,
              publishedAt: r.publishedAt,
            },
          ],
    );
    const skills = [...new Set(missions.flatMap((m) => m.skills))].sort((a, b) => a.localeCompare(b, "fr")).slice(0, MAX_SKILLS_LISTED);
    return {
      key,
      label: missions[0]?.city ?? key,
      missions,
      facts: { missionCount: count, skills, dailyRate: rateRange(missions) },
      generatedAt: now,
    };
  },

  async listForSitemap() {
    const groups = await db.jobPost.groupBy({
      by: ["cityKey"],
      where: { status: "open", publishedAt: { not: null }, cityKey: { not: null } },
      _count: { _all: true },
      having: { cityKey: { _count: { gte: MIN_CITY_MISSIONS } } },
      orderBy: { cityKey: "asc" },
      take: MAX_SITEMAP_CITIES,
    });
    // Seules les clés qu'une page accepte : le sitemap ne promet jamais une adresse qui répondrait « absente ».
    const listed = groups.filter((g): g is typeof g & { cityKey: string } => g.cityKey !== null && KEY.test(g.cityKey) && g.cityKey.length <= 120);
    const keys = listed.map((g) => g.cityKey);
    if (keys.length === 0) return [];
    const labels = await db.jobPost.findMany({
      where: { status: "open", cityKey: { in: keys } },
      distinct: ["cityKey"],
      orderBy: [{ cityKey: "asc" }, { publishedAt: "desc" }],
      select: { cityKey: true, city: true },
    });
    const labelOf = new Map(labels.map((l) => [l.cityKey, l.city]));
    return listed.map((g) => ({ key: g.cityKey, label: labelOf.get(g.cityKey) ?? g.cityKey, missions: g._count._all }));
  },
});
