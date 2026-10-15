import { auth } from "@clerk/nextjs/server";
import { audienceStats, getDb, parisDay, type Actor, type AppearanceScope, type Sighting, type StatKeyword } from "@proofseen/db";
import { hasDatabase } from "./intake-sink";
import { addressFromHeaders } from "./throttle";
import { audienceSecret, isAutomatedAgent, isSpeculative, viewerHash } from "../lib/audience";
import { authConfigured } from "../lib/auth-config";
import { logError } from "../lib/log";

/*
 * Counting profile views and appearances. Always called from `after()`: the page is already sent when this runs, it
 * never changes a byte of what was served, and a failure is logged, never shown. The database receives totals and a
 * one-day fingerprint, never the address or the browser string.
 */

const PURGE_PROBABILITY = 0.01;

/** The only request headers counting reads: copied while the request is live, for an `after()` callback. */
const COUNTED_HEADERS = ["user-agent", "x-real-ip", "x-forwarded-for", "sec-purpose", "purpose", "x-purpose", "x-moz"] as const;

export const countedHeaders = (source: Pick<Headers, "get">): Headers => {
  const copy = new Headers();
  for (const name of COUNTED_HEADERS) {
    const value = source.get(name);
    if (value !== null) copy.set(name, value);
  }
  return copy;
};

let warnedAboutSecret = false;

/** The visitor of this request, or `null` when it must not count (crawler, prefetch, no secret, no database). */
const sightingOf = (headers: Pick<Headers, "get">, viewerClerkId: string | null, now: Date): Sighting | null => {
  if (!hasDatabase() || isSpeculative(headers)) return null;
  const agent = headers.get("user-agent");
  if (isAutomatedAgent(agent)) return null;
  const secret = audienceSecret();
  if (secret === null) {
    if (!warnedAboutSecret) {
      logError("audience: PROOFSEEN_ACCESS_SECRET missing or too short, counting disabled");
      warnedAboutSecret = true;
    }
    return null;
  }
  const day = parisDay(now);
  return { day, viewerHash: viewerHash(secret, day, addressFromHeaders(headers) ?? "", agent ?? ""), viewerClerkId };
};

/** The signed-in person's Clerk id, so that their own profile does not count; `null` when signed out. */
const signedInClerkId = async (): Promise<string | null> => {
  if (!authConfigured()) return null;
  try {
    return (await auth()).userId;
  } catch {
    return null;
  }
};

/** Yesterday's fingerprints are removed by the daily purge; a small share of requests also does it, in case it lags. */
const maybePurge = async (day: string): Promise<void> => {
  if (Math.random() >= PURGE_PROBABILITY) return;
  await audienceStats(getDb()).purgeSightings(day);
};

/** A view of a public profile page. For route handlers, where the session can still be read after the response. */
export const countProfileView = async (headers: Headers, reference: string, now: Date = new Date()): Promise<void> => {
  try {
    const sighting = sightingOf(headers, await signedInClerkId(), now);
    if (sighting === null) return;
    await audienceStats(getDb()).recordView(reference, sighting);
    await maybePurge(sighting.day);
  } catch (error) {
    logError("audience: profile view not counted", error);
  }
};

/** Profiles shown by the public directory (route handler). */
export const countDirectoryAppearances = async (headers: Headers, references: readonly string[], now: Date = new Date()): Promise<void> => {
  if (references.length === 0) return;
  try {
    const sighting = sightingOf(headers, await signedInClerkId(), now);
    if (sighting === null) return;
    await audienceStats(getDb()).recordAppearances("directory", references, sighting);
  } catch (error) {
    logError("audience: directory appearances not counted", error);
  }
};

interface SearchCount {
  readonly headers: Pick<Headers, "get">;
  readonly actor: Actor;
  readonly clerkId: string;
  readonly organisationId: string;
  readonly references: readonly string[];
  readonly keywords: readonly StatKeyword[];
  /** Only the first page of results counts as a search launched by the team. */
  readonly firstPage: boolean;
}

/** A company search results page: the profiles it showed, the filters that led there, and the team's search count. */
export const countSearch = async (search: SearchCount, now: Date = new Date()): Promise<void> => {
  try {
    const stats = audienceStats(getDb());
    if (search.firstPage) await stats.recordSearch(search.actor, search.organisationId, parisDay(now));
    const sighting = sightingOf(search.headers, search.clerkId, now);
    if (sighting === null || search.references.length === 0) return;
    const scope: AppearanceScope = "search";
    await stats.recordAppearances(scope, search.references, sighting, search.keywords);
  } catch (error) {
    logError("audience: search appearances not counted", error);
  }
};
