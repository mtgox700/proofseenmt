import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { decrypt, encrypt } from "./crypto";

/** Pseudonymised raw answers are kept 72 hours at most (CONFORMITE T3, REQ-M2-03). */
export const RAW_TTL_MS = 72 * 60 * 60 * 1000;
const SUFFIX = ".sealed.json";

const SealedFileSchema = z.object({
  v: z.literal(1),
  expiresAt: z.iso.datetime(),
  iv: z.string(),
  tag: z.string(),
  data: z.string(),
});

const assertDrawId = (drawId: string): void => {
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/.test(drawId) || drawId.includes("..")) {
    throw new Error(`invalid draw id: ${JSON.stringify(drawId)}`);
  }
};

export const writeSealed = async (dir: string, drawId: string, maskedText: string, key: Buffer, now: Date): Promise<void> => {
  assertDrawId(drawId);
  await mkdir(dir, { recursive: true });
  const expiresAt = new Date(now.getTime() + RAW_TTL_MS).toISOString();
  const body = { v: 1 as const, expiresAt, ...encrypt(maskedText, key) };
  await writeFile(join(dir, `${drawId}${SUFFIX}`), JSON.stringify(body), { encoding: "utf8", mode: 0o600 });
};

export const readSealed = async (dir: string, drawId: string, key: Buffer): Promise<string> => {
  assertDrawId(drawId);
  const body = SealedFileSchema.parse(JSON.parse(await readFile(join(dir, `${drawId}${SUFFIX}`), "utf8")));
  return decrypt(body, key);
};

const isExpired = async (path: string, now: Date): Promise<boolean> => {
  try {
    const body = SealedFileSchema.parse(JSON.parse(await readFile(path, "utf8")));
    return new Date(body.expiresAt).getTime() <= now.getTime();
  } catch {
    return true; // unreadable or corrupted: never keep it
  }
};

/**
 * Deletes every sealed answer of a folder before its deadline, for a wave whose analysis is finished. Minimisation
 * (CONFORMITE T3) : keeping a raw answer that no longer serves anything is a risk without a use — especially when the
 * masking degraded, as it did on J0 (2026-09-24), and the text may still carry third-party names.
 */
export const purgeAll = async (dir: string): Promise<string[]> => {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(SUFFIX));
  } catch {
    return [];
  }
  await Promise.all(files.map((file) => unlink(join(dir, file))));
  return files;
};

/** Deletes every expired (or corrupted) sealed file; returns the deleted file names. The key is not needed. */
export const purgeExpired = async (dir: string, now: Date): Promise<string[]> => {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(SUFFIX));
  } catch {
    return [];
  }
  const deleted: string[] = [];
  for (const file of files) {
    const path = join(dir, file);
    if (await isExpired(path, now)) {
      await unlink(path);
      deleted.push(file);
    }
  }
  return deleted.sort();
};
