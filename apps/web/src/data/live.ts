import { getDb, liveAudience, type LiveCounts } from "@proofseen/db";
import { pgLiveListener } from "@proofseen/db/live-listener";
import { createLiveHub, type LiveHub } from "../lib/live/hub";
import { logError } from "../lib/log";

/*
 * The live hub of this container: one Postgres listener (a dedicated connection, not one of the pool) and the
 * browsers connected to it. Kept on `globalThis` so that every route bundle of the server shares the same one, and a
 * development reload does not open a second listener.
 */

/** Tabs per person: beyond, the oldest tabs still work, the new one falls back to reloading. */
export const MAX_STREAMS_PER_USER = 5;
/** Streams per container: each holds a socket and a few kilobytes, far below what the VPS allows. */
export const MAX_STREAMS_TOTAL = 2_000;

const KEY = "__proofseenLiveHub";

type WithHub = typeof globalThis & { [KEY]?: LiveHub };

export const liveHub = (): LiveHub => {
  const store = globalThis as WithHub;
  const existing = store[KEY];
  if (existing !== undefined) return existing;
  const hub = createLiveHub(pgLiveListener(process.env.DATABASE_URL ?? "", { log: logError }), liveAudience(getDb()), {
    maxPerUser: MAX_STREAMS_PER_USER,
    maxTotal: MAX_STREAMS_TOTAL,
    countsDelayMs: 250,
    resyncJitterMs: 5_000,
    log: logError,
  });
  store[KEY] = hub;
  return hub;
};

/** Counters of one person, read from the database. */
export const liveCounts = (userId: string): Promise<LiveCounts> => liveAudience(getDb()).counts(userId);
