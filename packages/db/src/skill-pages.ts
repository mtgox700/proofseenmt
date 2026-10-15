import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { WorkMode } from "./generated/enums";
import { publicName } from "./public-profiles";
import { skillKey } from "./skills";
import { LISTED_MISSION, LISTED_PROFILE } from "./public-visibility";

/*
 * Pages métiers (une par compétence) : les missions ouvertes et les profils publiés qui la portent. Une page n'existe
 * que si du contenu réel la remplit — au moins MIN_REAL_ITEMS éléments, missions et profils confondus. En deçà, ce
 * serait une page vide générée pour le référencement : elle répond « absente », et n'entre pas dans le sitemap.
 *
 * L'ordre des profils est celui de leur dernière mise à jour de disponibilité : un fait daté, jamais un classement.
 *
 * Les faits de la page (nombres, villes, fourchette de TJM) sont comptés dans la base au moment du rendu. Une
 * statistique — la fourchette de TJM — ne sort jamais sous MIN_STAT_SAMPLE valeurs connues : sur quatre profils, elle
 * désignerait presque des personnes, et elle ne décrirait rien.
 */

export const MIN_REAL_ITEMS = 2;
export const MIN_STAT_SAMPLE = 5;
const MAX_ITEMS = 20;
const MAX_FACT_ROWS = 5000;

export interface SkillPageFacts {
  /** Profils publiés qui portent la compétence (tous, pas seulement ceux affichés). */
  readonly profileCount: number;
  /** Missions ouvertes qui la demandent. */
  readonly missionCount: number;
  /** TJM affichés par les profils publiés, en euros ; `null` sous MIN_STAT_SAMPLE valeurs. */
  readonly dailyRate: { readonly n: number; readonly minCents: number; readonly maxCents: number; readonly currency: "EUR" } | null;
  /** Villes des profils publiés et des missions ouvertes, sans doublon, par ordre alphabétique. */
  readonly cities: readonly string[];
}

export interface SkillPage {
  readonly key: string;
  readonly label: string;
  readonly missions: readonly { readonly id: string; readonly title: string; readonly organisationName: string; readonly workMode: WorkMode; readonly city: string | null }[];
  readonly profiles: readonly { readonly slug: string; readonly reference: string; readonly displayName: string | null; readonly headline: string; readonly city: string }[];
  readonly facts: SkillPageFacts;
  readonly generatedAt: Date;
}

export interface SkillIndexEntry {
  readonly key: string;
  readonly label: string;
  readonly missions: number;
  readonly profiles: number;
}

export interface SkillPages {
  page(key: string, now?: Date): Promise<SkillPage | null>;
  /** Les compétences qui ont une page, avec leurs nombres : pour le sitemap et l'index des métiers. */
  listForSitemap(): Promise<readonly SkillIndexEntry[]>;
}

const KEY = /^[a-z0-9+#-]{1,60}$/;

const publishedWith = (skillId: string): Prisma.FreelanceProfileWhereInput => ({
  visibility: { not: "private" },
  ...LISTED_PROFILE,
  slug: { not: null },
  headline: { not: null },
  city: { not: null },
  skills: { some: { skillId } },
});

const openWith = (skillId: string): Prisma.JobPostWhereInput => ({ status: "open", ...LISTED_MISSION, skills: { some: { skillId } } });

/** Une ville par clé normalisée : « Paris » et « paris » ne font qu'une. */
const distinctCities = (rows: readonly { readonly city: string | null; readonly cityKey: string | null }[]): readonly string[] => {
  const byKey = new Map<string, string>();
  for (const { city, cityKey } of rows) {
    if (city !== null && cityKey !== null && !byKey.has(cityKey)) byKey.set(cityKey, city);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "fr"));
};

const rateRange = (rates: readonly number[]): SkillPageFacts["dailyRate"] =>
  rates.length < MIN_STAT_SAMPLE ? null : { n: rates.length, minCents: Math.min(...rates), maxCents: Math.max(...rates), currency: "EUR" };

const factsFor = async (db: Db, skillId: string): Promise<SkillPageFacts> => {
  const [profileCount, missionCount, rated, profileCities, missionCities] = await Promise.all([
    db.freelanceProfile.count({ where: publishedWith(skillId) }),
    db.jobPost.count({ where: openWith(skillId) }),
    db.freelanceProfile.findMany({ where: { ...publishedWith(skillId), dailyRateCents: { not: null }, currency: "EUR" }, take: MAX_FACT_ROWS, select: { dailyRateCents: true } }),
    db.freelanceProfile.findMany({ where: publishedWith(skillId), distinct: ["cityKey"], take: MAX_FACT_ROWS, select: { city: true, cityKey: true } }),
    db.jobPost.findMany({ where: { ...openWith(skillId), cityKey: { not: null } }, distinct: ["cityKey"], take: MAX_FACT_ROWS, select: { city: true, cityKey: true } }),
  ]);
  const rates = rated.flatMap((r) => (r.dailyRateCents === null ? [] : [r.dailyRateCents]));
  return { profileCount, missionCount, dailyRate: rateRange(rates), cities: distinctCities([...profileCities, ...missionCities]) };
};

export const skillPages = (db: Db): SkillPages => ({
  async page(raw, now = new Date()) {
    const key = skillKey(raw);
    if (!KEY.test(key) || key !== raw) return null;
    const skill = await db.skill.findUnique({ where: { key }, select: { id: true, label: true } });
    if (skill === null) return null;
    const [jobs, people] = await Promise.all([
      db.jobPost.findMany({
        where: openWith(skill.id),
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: MAX_ITEMS,
        select: { id: true, title: true, workMode: true, city: true, organisation: { select: { name: true } } },
      }),
      db.freelanceProfile.findMany({
        where: publishedWith(skill.id),
        orderBy: [{ availabilityAt: "desc" }, { id: "desc" }],
        take: MAX_ITEMS,
        select: { slug: true, reference: true, visibility: true, headline: true, city: true, user: { select: { displayName: true } } },
      }),
    ]);
    const missions = jobs.map((j) => ({ id: j.id, title: j.title, organisationName: j.organisation.name, workMode: j.workMode, city: j.city }));
    const profiles = people.flatMap((p) =>
      p.slug === null || p.headline === null || p.city === null
        ? []
        : [{ slug: p.slug, reference: p.reference, displayName: publicName(p.visibility, p.user.displayName), headline: p.headline, city: p.city }],
    );
    if (missions.length + profiles.length < MIN_REAL_ITEMS) return null;
    return { key, label: skill.label, missions, profiles, facts: await factsFor(db, skill.id), generatedAt: now };
  },

  async listForSitemap() {
    const skills = await db.skill.findMany({
      select: {
        key: true,
        label: true,
        _count: {
          select: {
            jobPosts: { where: { jobPost: { status: "open", ...LISTED_MISSION } } },
            freelancers: { where: { profile: { visibility: { not: "private" }, ...LISTED_PROFILE, slug: { not: null } } } },
          },
        },
      },
      orderBy: { key: "asc" },
      take: 5000,
    });
    return skills
      .filter((s) => s._count.jobPosts + s._count.freelancers >= MIN_REAL_ITEMS)
      .map((s) => ({ key: s.key, label: s.label, missions: s._count.jobPosts, profiles: s._count.freelancers }));
  },
});
