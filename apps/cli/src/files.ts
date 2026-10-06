import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { z } from "zod";

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export const loadJson = async <T extends z.ZodType>(path: string, schema: T, label: string): Promise<z.infer<T>> => {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new CliError(`${label}: cannot read ${path}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new CliError(`${label}: ${path} is not valid JSON`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new CliError(`${label}: ${path} is invalid\n${issues}`);
  }
  return parsed.data;
};

export const sha256File = async (path: string): Promise<string> =>
  createHash("sha256").update(await readFile(path)).digest("hex");

export const readJsonl = async <T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>[]> => {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = schema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new CliError(`${path}: line ${i + 1} is invalid (${issue?.path.join(".") || "(root)"}: ${issue?.message ?? "?"})`);
      }
      return parsed.data;
    });
};

export const appendJsonl = async (path: string, record: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
};

/**
 * Écriture atomique : fichier temporaire puis `rename`, qui remplace d'un seul coup sur le même volume. Une écriture
 * en place tronque avant d'écrire — une coupure entre les deux laisserait un fichier vide, et `--verify` effacerait
 * ainsi l'historique des vérifications qu'il est censé tenir.
 */
export const writeText = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

export interface WavePaths {
  readonly dir: string;
  readonly wave: string;
  readonly draws: string;
  readonly matches: string;
  readonly rescore: string;
  readonly sealed: string;
  /** Three-arm test: one line per draw and per arm, negatives included. */
  readonly arms: string;
}

export const wavePaths = (runsDir: string, waveId: string): WavePaths => {
  const dir = join(runsDir, waveId.replace(/[^A-Za-z0-9_-]/g, "_"));
  return {
    dir,
    wave: join(dir, "wave.json"),
    draws: join(dir, "draws.jsonl"),
    matches: join(dir, "matches.jsonl"),
    rescore: join(dir, "rescore.jsonl"),
    sealed: join(dir, "sealed"),
    arms: join(dir, "arms.jsonl"),
  };
};

/** First build, or an unreadable record: nothing is considered stale. A path escaping the folder is never trusted. */
const readBuildRecord = async (record: string): Promise<string[]> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(record, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string" && !p.includes("..")) : [];
  } catch {
    return [];
  }
};

/**
 * Writes a generated site and removes what the PREVIOUS build produced but this one no longer does — a withdrawn
 * profile, an entry page that fell under its threshold. Without it, a stale page would be redeployed silently.
 * Only files listed by our own previous build are ever removed; anything else in the folder is left untouched.
 * The build record sits NEXT TO the folder, never inside it, so it is not deployed.
 */
export const syncOutput = async (outDir: string, files: readonly { readonly path: string; readonly content: string }[]): Promise<string[]> => {
  const record = `${outDir.replace(/[\\/]+$/, "")}.build.json`;
  const previous = await readBuildRecord(record);
  const current = new Set(files.map((f) => f.path));
  const stale = previous.filter((path) => !current.has(path));
  await Promise.all(stale.map((path) => rm(join(outDir, ...path.split("/")), { force: true })));
  await Promise.all(files.map((f) => writeText(join(outDir, ...f.path.split("/")), f.content)));
  await writeText(record, `${JSON.stringify([...current].sort(), null, 2)}\n`);
  return stale;
};
