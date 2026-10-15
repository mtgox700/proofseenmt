import { barometers, getDb, type RateBarometer, type SkillBarometer } from "@proofseen/db";
import { memoize } from "../lib/memo";

/*
 * The barometers are computed in the database, then kept for an hour in this instance's memory: every page, dataset and
 * crawler within the hour reads the same figures with the same date, and the database computes them once. The CDN
 * caches the responses for the same hour (`s-maxage`).
 */

export const BAROMETER_TTL_MS = 60 * 60 * 1000;
export const BAROMETER_CACHE_CONTROL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=600";

export const rateBarometer: () => Promise<RateBarometer> = memoize(() => barometers(getDb()).rates(new Date()), BAROMETER_TTL_MS);
export const skillBarometer: () => Promise<SkillBarometer> = memoize(() => barometers(getDb()).skills(new Date()), BAROMETER_TTL_MS);
