import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import { reencodeImage } from "../src/data/image-processing";
import { deleteStored, readStored, saveUpload, storedPath, uploadsCapBytes, writeStored } from "../src/data/uploads";

/*
 * File storage on disk and in the database, against a real Postgres (PGlite) and a temporary folder: what is stored is
 * what the server produced, under a random name, inside the root, counted against the quota, and gone when refused.
 */

let t: TestDatabase;
let root: string;

beforeAll(async () => {
  t = await openTestDatabase();
  root = await mkdtemp(join(tmpdir(), "proofseen-uploads-test-"));
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
  await rm(root, { recursive: true, force: true });
});

const photoWithExif = (): Promise<Buffer> =>
  sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#204060" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "SECRET-EXIF-OWNER", Artist: "Camille Martin" } })
    .toBuffer();

const asFile = (bytes: Uint8Array, name: string, type: string): File => new File([new Uint8Array(bytes)], name, { type });

const freelancer = async () => {
  const userId = await createUser(t.db);
  await createProfile(t.db, userId);
  return { userId };
};

const filesOnDisk = async (): Promise<number> => {
  const shards = await readdir(root).catch(() => []);
  let count = 0;
  for (const shard of shards) count += (await readdir(join(root, shard))).length;
  return count;
};

describe("paths on disk", () => {
  it("builds a path only from a lowercase uuid, never from anything that could leave the root", () => {
    const id = randomUUID();
    expect(storedPath(id, root)).toBe(join(root, id.slice(0, 2), id));
    for (const hostile of ["../../etc/passwd", "..", "", "photo.jpg", id.toUpperCase(), `${id}/../x`, `${id}\u0000`]) expect(storedPath(hostile, root)).toBeNull();
  });

  it("writes, reads back and deletes; a missing file reads as null", async () => {
    const id = randomUUID();
    await writeStored(id, new Uint8Array([1, 2, 3]), root);
    expect([...((await readStored(id, root)) ?? [])]).toEqual([1, 2, 3]);
    await deleteStored([id, "not-a-uuid"], root);
    expect(await readStored(id, root)).toBeNull();
    await expect(writeStored("../escape", new Uint8Array([1]), root)).rejects.toThrow();
  });
});

describe("image re-encoding", () => {
  it("drops EXIF, resizes and produces WebP", async () => {
    const out = await reencodeImage(await photoWithExif(), "photo");
    expect(out.contentType).toBe("image/webp");
    expect(Math.max(out.width, out.height)).toBe(800);
    const meta = await sharp(out.bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(out.bytes.toString("latin1")).not.toContain("SECRET-EXIF-OWNER");
  });
});

describe("saving an upload", () => {
  it("stores a re-encoded photo under a random id, with its row, and nothing of the original metadata", async () => {
    const actor = await freelancer();
    const saved = await saveUpload(t.db, actor, "photo", asFile(await photoWithExif(), "../../me.jpg", "image/jpeg"), root);
    expect(saved.kind).toBe("stored");
    if (saved.kind !== "stored") return;
    const row = await t.db.storedFile.findUniqueOrThrow({ where: { id: saved.id } });
    expect(row).toMatchObject({ ownerId: actor.userId, kind: "photo", contentType: "image/webp", width: 800, height: 600 });
    const bytes = await readStored(saved.id, root);
    expect(bytes?.length).toBe(row.size);
    expect(bytes?.toString("latin1")).not.toContain("SECRET-EXIF-OWNER");
    expect(existsSync(join(root, "..", "me.jpg"))).toBe(false);
  });

  it("refuses what is not what it claims, before anything is written", async () => {
    const actor = await freelancer();
    const before = await filesOnDisk();
    const svg = asFile(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "photo.jpg", "image/jpeg");
    expect(await saveUpload(t.db, actor, "photo", svg, root)).toEqual({ kind: "type" });
    expect(await saveUpload(t.db, actor, "cv", asFile(await photoWithExif(), "cv.pdf", "application/pdf"), root)).toEqual({ kind: "type" });
    expect(await saveUpload(t.db, actor, "photo", null, root)).toEqual({ kind: "missing" });
    expect(await saveUpload(t.db, actor, "photo", "a string", root)).toEqual({ kind: "missing" });
    expect(await saveUpload(t.db, actor, "photo", asFile(new Uint8Array(2 * 1024 * 1024 + 1), "big.jpg", "image/jpeg"), root)).toEqual({ kind: "too_large" });
    // A JPEG header followed by garbage: the header passes, the decoder refuses, nothing is stored.
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x80, 0x00, 0x80, 0x03]), Buffer.alloc(200, 7)]);
    expect(await saveUpload(t.db, actor, "photo", asFile(broken, "x.jpg", "image/jpeg"), root)).toEqual({ kind: "unreadable" });
    expect(await filesOnDisk()).toBe(before);
    expect(await t.db.storedFile.count({ where: { ownerId: actor.userId } })).toBe(0);
  });

  it("refuses any new upload once the volume holds more than PROOFSEEN_UPLOADS_MAX_GB, before writing anything", async () => {
    const actor = await freelancer();
    // About 1 KB: the rows already recorded by this file's tests are above it.
    vi.stubEnv("PROOFSEEN_UPLOADS_MAX_GB", "0.000001");
    try {
      const before = await filesOnDisk();
      expect(await saveUpload(t.db, actor, "photo", asFile(await photoWithExif(), "p.jpg", "image/jpeg"), root)).toEqual({ kind: "storage_full" });
      expect(await filesOnDisk()).toBe(before);
      expect(await t.db.storedFile.count({ where: { ownerId: actor.userId } })).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("warns in the server log past 80 % of the volume cap, and still stores", async () => {
    const actor = await freelancer();
    // Someone else's 4 MB CV: the volume is then large enough for a 90 % fill to leave room for one more photo.
    const other = await freelancer();
    await t.db.storedFile.create({ data: { ownerId: other.userId, kind: "cv", contentType: "application/pdf", size: 4_000_000, sha256: "d".repeat(64) } });
    const used = Number((await t.db.storedFile.aggregate({ _sum: { size: true } }))._sum.size ?? 0);
    vi.stubEnv("PROOFSEEN_UPLOADS_MAX_GB", String(used / 0.9 / 1024 ** 3));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const saved = await saveUpload(t.db, actor, "photo", asFile(await photoWithExif(), "p.jpg", "image/jpeg"), root, new Date("2040-01-01T00:00:00Z"));
      expect(saved.kind).toBe("stored");
      expect(warn.mock.calls.flat().join(" ")).toContain("uploads: volume above 80 %");
    } finally {
      vi.unstubAllEnvs();
      warn.mockRestore();
    }
  });

  it("reads the volume cap from the environment, 5 GB when absent or invalid", () => {
    vi.stubEnv("PROOFSEEN_UPLOADS_MAX_GB", "");
    expect(uploadsCapBytes()).toBe(5 * 1024 ** 3);
    vi.stubEnv("PROOFSEEN_UPLOADS_MAX_GB", "-3");
    expect(uploadsCapBytes()).toBe(5 * 1024 ** 3);
    vi.stubEnv("PROOFSEEN_UPLOADS_MAX_GB", "abc");
    expect(uploadsCapBytes()).toBe(5 * 1024 ** 3);
    vi.stubEnv("PROOFSEEN_UPLOADS_MAX_GB", "20");
    expect(uploadsCapBytes()).toBe(20 * 1024 ** 3);
    vi.unstubAllEnvs();
  });

  it("removes the file from disk again when the quota refuses its row", async () => {
    const actor = await freelancer();
    await t.db.storedFile.createMany({ data: Array.from({ length: 30 }, () => ({ id: randomUUID(), ownerId: actor.userId, kind: "portfolio_image" as const, contentType: "image/webp", size: 10, sha256: "c".repeat(64) })) });
    const before = await filesOnDisk();
    expect(await saveUpload(t.db, actor, "photo", asFile(await photoWithExif(), "p.jpg", "image/jpeg"), root)).toEqual({ kind: "quota" });
    expect(await filesOnDisk()).toBe(before);
  });
});
