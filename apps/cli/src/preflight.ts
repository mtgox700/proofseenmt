import { verifiedUrls, type EngineId, type Identity, type Manifest } from "@proofseen/core";
import { WORST_CASE_DRAW_USD } from "@proofseen/engines";
import { EXTRACTOR_COST_ESTIMATE_USD } from "./run";

/*
 * Everything that can sink J0, checked before a single paid call: a frozen manifest, the secrets present (never read out
 * loud), a usable encryption key, a possession proof, and a budget that can pay for the whole wave. What the schemas
 * already guarantee (a prompt carries {{JD}}, every engine has a model…) is not re-checked here. Pure function: the
 * command only prints what it returns.
 */

export type CheckStatus = "ok" | "warn" | "fail";

export interface Check {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export interface PreflightInput {
  readonly manifest: Manifest;
  readonly identity: Identity;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** A folder already exists for this wave: the run would resume it instead of starting fresh. */
  readonly waveExists: boolean;
  readonly now: Date;
}

export interface PreflightReport {
  readonly checks: readonly Check[];
  readonly draws: number;
  readonly worstCaseUsd: number;
  readonly go: boolean;
}

const ENV_KEYS: Readonly<Record<EngineId, string>> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

const MIN_TARGETS = 10;
const MIN_CONTROLS = 3;

const present = (env: PreflightInput["env"], name: string): boolean => (env[name] ?? "").trim() !== "";

/** 32 bytes, base64 (AES-256-GCM). Only the length is ever reported. */
const encryptionKeyBytes = (raw: string | undefined): number | null => {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  try {
    return Buffer.from(value, "base64").length;
  } catch {
    return null;
  }
};

const frozenCheck = (m: Manifest, now: Date): Check => {
  if (m.frozenAt === null) return { name: "manifest frozen", status: "fail", detail: "frozenAt is null: a real wave is refused (EXPERIMENT_0 §2)" };
  const frozen = new Date(m.frozenAt);
  if (frozen.getTime() > now.getTime()) return { name: "manifest frozen", status: "fail", detail: `frozenAt ${m.frozenAt} is in the future` };
  return { name: "manifest frozen", status: "ok", detail: `frozen at ${m.frozenAt}` };
};

const keysCheck = (m: Manifest, env: PreflightInput["env"]): Check => {
  const needed = [...new Set([...m.engines.map((e) => ENV_KEYS[e]), ENV_KEYS.anthropic])]; // Anthropic also runs the extractor
  const missing = needed.filter((name) => !present(env, name));
  return missing.length === 0
    ? { name: "API keys", status: "ok", detail: `${needed.length} present (values never read)` }
    : { name: "API keys", status: "fail", detail: `missing in .env: ${missing.join(", ")}` };
};

const encryptionCheck = (env: PreflightInput["env"]): Check => {
  const bytes = encryptionKeyBytes(env.PROOFSEEN_ENC_KEY);
  if (bytes === null) return { name: "encryption key", status: "fail", detail: "PROOFSEEN_ENC_KEY is missing in .env" };
  return bytes === 32
    ? { name: "encryption key", status: "ok", detail: "32 bytes, base64" }
    : { name: "encryption key", status: "fail", detail: `${bytes} bytes decoded, 32 expected (AES-256-GCM)` };
};

const proofCheck = (identity: Identity): Check => {
  const verified = verifiedUrls(identity);
  return verified.length === 0
    ? { name: "possession proof", status: "fail", detail: "no verified URL: no match can be counted (PROCEDURE_US-F00.md)" }
    : { name: "possession proof", status: "ok", detail: `${verified.length} verified URL(s), ${identity.nameVariants.length} name variant(s)` };
};

const corpusCheck = (m: Manifest): Check => {
  const targets = m.jobDescriptions.filter((j) => j.role === "target").length;
  const controls = m.jobDescriptions.filter((j) => j.role === "control").length;
  const detail = `${targets} target JD(s), ${controls} control(s)`;
  return targets >= MIN_TARGETS && controls >= MIN_CONTROLS
    ? { name: "corpus", status: "ok", detail }
    : { name: "corpus", status: "warn", detail: `${detail} — protocol asks for ${MIN_TARGETS} + ${MIN_CONTROLS}` };
};

const budgetCheck = (m: Manifest, draws: number, worst: number): Check => {
  const detail = `${draws} draws, worst case ${worst.toFixed(2)} $, hard cap ${m.costCapUsd} $`;
  return worst <= m.costCapUsd
    ? { name: "budget", status: "ok", detail }
    : { name: "budget", status: "warn", detail: `${detail} — the wave would stop at the cap before the end (incomplete wave: SoRV not publishable)` };
};

export const preflight = (input: PreflightInput): PreflightReport => {
  const { manifest: m, identity, env, waveExists, now } = input;
  const draws = m.engines.length * m.jobDescriptions.length * m.prompts.length * m.drawsPerCell;
  const perDraw = m.engines.reduce((a, e) => a + WORST_CASE_DRAW_USD[e], 0) / m.engines.length + EXTRACTOR_COST_ESTIMATE_USD;
  const worstCaseUsd = draws * perDraw;
  const checks: Check[] = [
    frozenCheck(m, now),
    keysCheck(m, env),
    encryptionCheck(env),
    proofCheck(identity),
    corpusCheck(m),
    budgetCheck(m, draws, worstCaseUsd),
    waveExists
      ? { name: "wave folder", status: "warn", detail: `runs/${m.waveId} already exists: the run resumes it and keeps the finished draws` }
      : { name: "wave folder", status: "ok", detail: `runs/${m.waveId} is new` },
  ];
  return { checks, draws, worstCaseUsd, go: checks.every((c) => c.status !== "fail") };
};
