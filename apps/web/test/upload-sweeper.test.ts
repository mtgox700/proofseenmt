import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import { sweepOrphanUploads } from "../src/data/upload-sweeper";
import { storedPath, writeStored } from "../src/data/uploads";

/*
 * Files left on disk without their database row (wave-2 review, L1): an erasure racing an upload, a crash between the
 * write and the row. A scheduled sweep removes them once they are an hour old, a bounded number per run, and never
 * touches a file whose row exists or a file still being written.
 */

let t: TestDatabase;
let root: string;

beforeAll(async () => {
  t = await openTestDatabase();
  root = await mkdtemp(join(tmpdir(), "proofseen-sweep-test-"));
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
  await rm(root, { recursive: true, force: true });
});

const NOW = new Date("2026-10-15T12:00:00Z");
const TWO_HOURS_AGO = new Date(NOW.getTime() - 2 * 60 * 60_000);
const TEN_MINUTES_AGO = new Date(NOW.getTime() - 10 * 60_000);

const onDisk = async (id: string, modifiedAt: Date): Promise<string> => {
  await writeStored(id, new Uint8Array([1, 2, 3]), root);
  const path = storedPath(id, root) ?? "";
  await utimes(path, modifiedAt, modifiedAt);
  return path;
};

const recorded = async (): Promise<string> => {
  const ownerId = await createUser(t.db);
  await createProfile(t.db, ownerId);
  const { id } = await t.db.storedFile.create({ data: { ownerId, kind: "photo", contentType: "image/webp", size: 3, sha256: "e".repeat(64) }, select: { id: true } });
  return id;
};

describe("sweeping orphan uploads", () => {
  it("removes old files without a row, keeps recent ones and those with a row", async () => {
    const orphan = await onDisk(randomUUID(), TWO_HOURS_AGO);
    const young = await onDisk(randomUUID(), TEN_MINUTES_AGO);
    const kept = await onDisk(await recorded(), TWO_HOURS_AGO);
    const shard = join(root, "ab");
    await mkdir(shard, { recursive: true });
    const leftover = join(shard, `ab${randomUUID().slice(2)}.${randomUUID()}.part`);
    await writeFile(leftover, "x");
    await utimes(leftover, TWO_HOURS_AGO, TWO_HOURS_AGO);
    const stranger = join(shard, "notes.txt");
    await writeFile(stranger, "x");
    await utimes(stranger, TWO_HOURS_AGO, TWO_HOURS_AGO);

    const report = await sweepOrphanUploads(t.db, NOW, { root });
    expect(report.deleted).toBe(2);
    expect(existsSync(orphan)).toBe(false);
    expect(existsSync(leftover)).toBe(false);
    expect(existsSync(young)).toBe(true);
    expect(existsSync(kept)).toBe(true);
    // Anything the application did not name is left alone: the sweep only removes what it can recognise.
    expect(existsSync(stranger)).toBe(true);
  });

  it("deletes a bounded number of files per run", async () => {
    const orphans = await Promise.all(Array.from({ length: 5 }, () => onDisk(randomUUID(), TWO_HOURS_AGO)));
    expect((await sweepOrphanUploads(t.db, NOW, { root, maxDeleted: 2 })).deleted).toBe(2);
    expect(orphans.filter((path) => existsSync(path))).toHaveLength(3);
    expect((await sweepOrphanUploads(t.db, NOW, { root, maxDeleted: 10 })).deleted).toBe(3);
  });

  it("does nothing on a missing folder", async () => {
    expect(await sweepOrphanUploads(t.db, NOW, { root: join(root, "absent") })).toEqual({ scanned: 0, deleted: 0 });
  });
});
