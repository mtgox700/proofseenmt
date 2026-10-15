import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { storedFiles, type Db } from "@proofseen/db";
import { logError } from "../lib/log";
import { uploadsRoot } from "./uploads";

/*
 * Scheduled removal of files left on disk without their database row: an erasure racing an upload from another tab, a
 * crash between the write and the row, a half-written `.part` file. Called by the notifications cron, it is a small,
 * bounded step: it scans at most `maxScanned` entries and removes at most `maxDeleted` files per run, starting from a
 * shard that changes every hour, so a large volume is covered over successive runs. A file is touched only when it is
 * older than ORPHAN_MIN_AGE_MS (an upload in progress writes its file before its row) and only when its name is one
 * the application gives: anything else in the folder is left alone.
 */

export const ORPHAN_MIN_AGE_MS = 60 * 60_000;
const MAX_SCANNED = 2_000;
const MAX_DELETED = 200;
const SHARD = /^[0-9a-f]{2}$/;
const STORED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PARTIAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f-]{36}\.part$/;
const HOUR_MS = 60 * 60_000;

export interface SweepOptions {
  readonly root?: string;
  readonly maxScanned?: number;
  readonly maxDeleted?: number;
}

export interface SweepReport {
  readonly scanned: number;
  readonly deleted: number;
}

interface Candidate {
  readonly path: string;
  readonly name: string;
}

const entries = async (folder: string): Promise<readonly string[]> => {
  try {
    return (await readdir(folder)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") logError("uploads sweep: folder not readable", error);
    return [];
  }
};

/** The application's file names older than the minimum age, from at most `limit` entries, shards in hourly rotation. */
const oldCandidates = async (root: string, now: Date, limit: number): Promise<{ readonly scanned: number; readonly found: readonly Candidate[] }> => {
  const shards = (await entries(root)).filter((name) => SHARD.test(name));
  const start = shards.length === 0 ? 0 : Math.floor(now.getTime() / HOUR_MS) % shards.length;
  const ordered = [...shards.slice(start), ...shards.slice(0, start)];
  const found: Candidate[] = [];
  let scanned = 0;
  for (const shard of ordered) {
    for (const name of await entries(join(root, shard))) {
      if (scanned >= limit) return { scanned, found };
      scanned += 1;
      if (!STORED.test(name) && !PARTIAL.test(name)) continue;
      const path = join(root, shard, name);
      const info = await stat(path).catch(() => null);
      if (info !== null && info.isFile() && now.getTime() - info.mtimeMs >= ORPHAN_MIN_AGE_MS) found.push({ path, name });
    }
  }
  return { scanned, found };
};

export const sweepOrphanUploads = async (db: Db, now: Date, options: SweepOptions = {}): Promise<SweepReport> => {
  const { scanned, found } = await oldCandidates(options.root ?? uploadsRoot(), now, options.maxScanned ?? MAX_SCANNED);
  const recorded = await storedFiles(db).existing(found.filter((c) => STORED.test(c.name)).map((c) => c.name));
  const orphans = found.filter((c) => !recorded.has(c.name)).slice(0, options.maxDeleted ?? MAX_DELETED);
  let deleted = 0;
  for (const orphan of orphans) {
    try {
      await rm(orphan.path, { force: true });
      deleted += 1;
    } catch (error) {
      logError("uploads sweep: delete failed", error);
    }
  }
  return { scanned, deleted };
};
