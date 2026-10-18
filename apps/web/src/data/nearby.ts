import { getDb, matching } from "@proofseen/db";
import type { NearbyMission, NearbyProfile } from "@proofseen/hub";
import type { Lang } from "../i18n/types";
import { logError } from "../lib/log";
import { toNearbyMissions, toNearbyProfiles } from "../lib/matching";

/*
 * "Similar missions" and "Similar profiles" for the public pages (C22). The page is the same for every visitor and
 * every bot, so the lists are too: no viewer, no cookie, only the facts of the page's own mission or profile. A failure
 * here never takes the page down: the page renders without the section, and the error is logged.
 */

/** Suggestions shown on a public page. */
const PUBLIC_LIMIT = 6;

export const nearbyMissionsFor = async (missionId: string, lang: Lang): Promise<readonly NearbyMission[]> => {
  try {
    return toNearbyMissions(await matching(getDb()).similarMissions(missionId, { limit: PUBLIC_LIMIT }), lang);
  } catch (error) {
    logError("mission page: similar missions not computed", error);
    return [];
  }
};

export const nearbyProfilesFor = async (slug: string, lang: Lang): Promise<readonly NearbyProfile[]> => {
  try {
    return toNearbyProfiles(await matching(getDb()).similarProfiles(slug, { limit: PUBLIC_LIMIT }), lang);
  } catch (error) {
    logError("profile page: similar profiles not computed", error);
    return [];
  }
};
