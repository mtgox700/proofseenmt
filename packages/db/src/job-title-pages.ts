import { cappedByPublisher, MIN_DISTINCT_PUBLISHERS, missionRate } from "./barometer-stats";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { WorkMode } from "./generated/enums";
import { JOB_TITLES, jobTitleByKey, matchesFoldedJobTitle } from "./job-titles";
import { publicName } from "./public-profiles";
import { LISTED_MISSION, LISTED_PROFILE } from "./public-visibility";
import { foldText } from "./search-text";
import { MIN_REAL_ITEMS, MIN_STAT_SAMPLE } from "./skill-pages";

/*
 * Pages par poste (intitulé) : les missions ouvertes dont l'intitulé, et les profils publiés dont le titre, entrent
 * dans une famille de la taxonomie (job-titles.ts). Mêmes règles que les pages par compétence (skill-pages.ts) :
 *  - une page n'existe qu'à partir de MIN_REAL_ITEMS éléments réels, missions et profils confondus ;
 *  - une fourchette de TJM ne sort qu'à partir de MIN_STAT_SAMPLE valeurs, avec son n ;
 *  - côté missions, la fourchette suit en plus la règle des entreprises distinctes des baromètres (barometer-stats.ts) :
 *    au moins MIN_DISTINCT_PUBLISHERS entreprises, au plus trois missions de chacune, ses plus récentes ;
 *  - ce qu'un opérateur a retiré du public (LISTED_MISSION, LISTED_PROFILE) n'y entre jamais.
 *
 * La correspondance se fait dans l'application, sur le texte plié : on lit au plus MAX_SCAN missions ouvertes et
 * MAX_SCAN profils publiés, les plus récents. Les nombres sont donc des minimums au-delà de ce volume.
 * L'ordre des profils est celui de leur dernière mise à jour de disponibilité : un fait daté, jamais un classement.
 */

const MAX_ITEMS = 20;
const MAX_SCAN = 5000;

export interface RateRange {
  readonly n: number;
  readonly minCents: number;
  readonly maxCents: number;
  readonly currency: "EUR";
}

export interface JobTitlePageFacts {
  readonly profileCount: number;
  readonly missionCount: number;
  /** TJM affichés par les profils, `null` sous MIN_STAT_SAMPLE valeurs. */
  readonly profileRate: RateRange | null;
  /** TJM proposés par les missions (milieu de fourchette), `null` sous la règle des entreprises distinctes ou sous MIN_STAT_SAMPLE. */
  readonly missionRate: (RateRange & { readonly publishers: number }) | null;
  readonly cities: readonly string[];
}

export interface JobTitlePage {
  readonly key: string;
  readonly label: { readonly fr: string; readonly en: string };
  readonly missions: readonly { readonly id: string; readonly title: string; readonly organisationName: string; readonly workMode: WorkMode; readonly city: string | null }[];
  readonly profiles: readonly { readonly slug: string; readonly reference: string; readonly displayName: string | null; readonly headline: string; readonly city: string }[];
  readonly facts: JobTitlePageFacts;
  readonly generatedAt: Date;
}

export interface JobTitleIndexEntry {
  readonly key: string;
  readonly label: { readonly fr: string; readonly en: string };
  readonly missions: number;
  readonly profiles: number;
}

export interface JobTitlePages {
  page(key: string, now?: Date): Promise<JobTitlePage | null>;
  /** Les postes qui ont une page, avec leurs nombres : pour le sitemap, l'index et llms.txt. */
  listForSitemap(): Promise<readonly JobTitleIndexEntry[]>;
}

const OPEN: Prisma.JobPostWhereInput = { status: "open", ...LISTED_MISSION };
const PUBLISHED: Prisma.FreelanceProfileWhereInput = { visibility: { not: "private" }, ...LISTED_PROFILE, slug: { not: null }, headline: { not: null }, city: { not: null } };

const scanMissions = (db: Db) =>
  db.jobPost.findMany({
    where: OPEN,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: MAX_SCAN,
    select: {
      id: true,
      title: true,
      workMode: true,
      city: true,
      cityKey: true,
      currency: true,
      dailyRateMinCents: true,
      dailyRateMaxCents: true,
      organisationId: true,
      publishedAt: true,
      createdAt: true,
      organisation: { select: { name: true } },
    },
  });

const scanProfiles = (db: Db) =>
  db.freelanceProfile.findMany({
    where: PUBLISHED,
    orderBy: [{ availabilityAt: "desc" }, { id: "desc" }],
    take: MAX_SCAN,
    select: { slug: true, reference: true, visibility: true, headline: true, city: true, cityKey: true, dailyRateCents: true, currency: true, user: { select: { displayName: true } } },
  });

type MissionRow = Awaited<ReturnType<typeof scanMissions>>[number];
type ProfileRow = Awaited<ReturnType<typeof scanProfiles>>[number];

/** Les lignes lues, chacune avec son texte plié une seule fois. */
const scan = async (db: Db) => {
  const [missions, profiles] = await Promise.all([scanMissions(db), scanProfiles(db)]);
  return {
    missions: missions.map((row) => ({ row, folded: foldText(row.title) })),
    profiles: profiles.map((row) => ({ row, folded: foldText(row.headline ?? "") })),
  };
};

const matching = <T>(key: string, rows: readonly { readonly row: T; readonly folded: string }[]): readonly T[] =>
  rows.filter((r) => r.folded !== "" && matchesFoldedJobTitle(key, r.folded)).map((r) => r.row);

const range = (values: readonly number[]): RateRange | null =>
  values.length < MIN_STAT_SAMPLE ? null : { n: values.length, minCents: Math.min(...values), maxCents: Math.max(...values), currency: "EUR" };

const profileRate = (rows: readonly ProfileRow[]): RateRange | null =>
  range(rows.flatMap((p) => (p.currency === "EUR" && p.dailyRateCents !== null ? [p.dailyRateCents] : [])));

const missionRateRange = (rows: readonly MissionRow[]): JobTitlePageFacts["missionRate"] => {
  const rated = rows.flatMap((m) => {
    const value = m.currency === "EUR" ? missionRate(m.dailyRateMinCents, m.dailyRateMaxCents) : null;
    return value === null ? [] : [{ value, publisher: m.organisationId, at: m.publishedAt ?? m.createdAt }];
  });
  const kept = cappedByPublisher(rated);
  if (kept === null) return null;
  const r = range(kept.map((k) => k.value));
  const publishers = new Set(kept.map((k) => k.publisher)).size;
  return r === null || publishers < MIN_DISTINCT_PUBLISHERS ? null : { ...r, publishers };
};

/** Une ville par clé normalisée, par ordre alphabétique. */
const distinctCities = (rows: readonly { readonly city: string | null; readonly cityKey: string | null }[]): readonly string[] => {
  const byKey = new Map<string, string>();
  for (const { city, cityKey } of rows) {
    if (city !== null && cityKey !== null && !byKey.has(cityKey)) byKey.set(cityKey, city);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "fr"));
};

const KEY = /^[a-z0-9-]{1,60}$/;

export const jobTitlePages = (db: Db): JobTitlePages => ({
  async page(key, now = new Date()) {
    if (!KEY.test(key)) return null;
    const title = jobTitleByKey(key);
    if (title === undefined) return null;
    const scanned = await scan(db);
    const missions = matching(key, scanned.missions);
    const profiles = matching(key, scanned.profiles);
    if (missions.length + profiles.length < MIN_REAL_ITEMS) return null;
    return {
      key,
      label: title.label,
      missions: missions.slice(0, MAX_ITEMS).map((m) => ({ id: m.id, title: m.title, organisationName: m.organisation.name, workMode: m.workMode, city: m.city })),
      profiles: profiles.slice(0, MAX_ITEMS).flatMap((p) =>
        p.slug === null || p.headline === null || p.city === null
          ? []
          : [{ slug: p.slug, reference: p.reference, displayName: publicName(p.visibility, p.user.displayName), headline: p.headline, city: p.city }],
      ),
      facts: {
        profileCount: profiles.length,
        missionCount: missions.length,
        profileRate: profileRate(profiles),
        missionRate: missionRateRange(missions),
        cities: distinctCities([...profiles, ...missions.filter((m) => m.cityKey !== null)]),
      },
      generatedAt: now,
    };
  },

  async listForSitemap() {
    const scanned = await scan(db);
    return JOB_TITLES.flatMap((t) => {
      const m = matching(t.key, scanned.missions).length;
      const p = matching(t.key, scanned.profiles).length;
      return m + p >= MIN_REAL_ITEMS ? [{ key: t.key, label: t.label, missions: m, profiles: p }] : [];
    });
  },
});
