import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
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

export const writeText = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
};

export interface WavePaths {
  readonly dir: string;
  readonly wave: string;
  readonly draws: string;
  readonly matches: string;
  readonly rescore: string;
  readonly sealed: string;
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
  };
};
