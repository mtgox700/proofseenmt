import { getDb, matching } from "@proofseen/db";
import type { NearbyMission, NearbyProfile } from "@proofseen/hub";
import type { Lang } from "../i18n/types";
import { logError } from "../lib/log";
import { toNearbyMissions, toNearbyProfiles } from "../lib/matching";

/*
 * "Similar missions" and "Similar profiles" for the public pages (C22). The page is the same for every visitor and
 * every bot, so the lists are too: no viewer, no cookie, only the facts of the page's own mission or profile. A failure
 * here never takes the page down: the page renders without the section, and the error is logged.
 *
 * Each list reads up to 500 candidates, so it is kept in memory for a short while, keyed by the page itself: a crawler
 * or an attacker adding a random query string to a public URL no longer costs a fresh computation per request, and
 * concurrent requests for the same page share one (security review C22, matching M1).
 */

/** Suggestions shown on a public page. */
const PUBLIC_LIMIT = 6;
/** How long a computed list is reused: a profile made private leaves the lists of other pages within this delay. */
export const NEARBY_TTL_MS = 120_000;
/** Most lists kept at once; the oldest entry goes first. */
export const NEARBY_MAX_ENTRIES = 1000;

interface Entry<T> {
  readonly at: number;
  readonly value: Promise<readonly T[]>;
}

/** Lists computed by `compute`, reused for `NEARBY_TTL_MS`; exported for its tests. */
export const memoByPage = <T>(compute: (key: string) => Promise<readonly T[] | null>): ((key: string, now?: number) => Promise<readonly T[]>) => {
  const entries = new Map<string, Entry<T>>();
  return (key: string, now = Date.now()): Promise<readonly T[]> => {
    const known = entries.get(key);
    if (known !== undefined && now - known.at < NEARBY_TTL_MS) return known.value;
    entries.delete(key);
    // A failed computation is not kept: the next request tries again.
    const value = compute(key).then((list) => {
      if (list === null) entries.delete(key);
      return list ?? [];
    });
    entries.set(key, { at: now, value });
    while (entries.size > NEARBY_MAX_ENTRIES) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    return value;
  };
};

const missionsMemo = memoByPage<NearbyMission>(async (key) => {
  const [lang, missionId] = key.split(" ") as [Lang, string];
  try {
    return toNearbyMissions(await matching(getDb()).similarMissions(missionId, { limit: PUBLIC_LIMIT }), lang);
  } catch (error) {
    logError("mission page: similar missions not computed", error);
    return null;
  }
});

const profilesMemo = memoByPage<NearbyProfile>(async (key) => {
  const [lang, slug] = key.split(" ") as [Lang, string];
  try {
    return toNearbyProfiles(await matching(getDb()).similarProfiles(slug, { limit: PUBLIC_LIMIT }), lang);
  } catch (error) {
    logError("profile page: similar profiles not computed", error);
    return null;
  }
});

export const nearbyMissionsFor = (missionId: string, lang: Lang): Promise<readonly NearbyMission[]> => missionsMemo(`${lang} ${missionId}`);

export const nearbyProfilesFor = (slug: string, lang: Lang): Promise<readonly NearbyProfile[]> => profilesMemo(`${lang} ${slug}`);
