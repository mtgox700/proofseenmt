import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { IdentitySchema, ManifestSchema, MatchSchema, type EngineId, type Identity, type Manifest } from "@proofseen/core";
import {
  createAnthropicAdapter,
  createOpenAiAdapter,
  createPerplexityAdapter,
  createToolFreeCompletion,
  fetchTransport,
  WORST_CASE_DRAW_USD,
  type EngineAdapter,
  type Transport,
} from "@proofseen/engines";
import { parseKey, purgeExpired, type ExtractFn } from "@proofseen/extract";
import { CliError, loadJson, readJsonl, sha256File, wavePaths, writeText } from "./files";
import { loadManualCsv } from "./manual";
import { RescoreRecordSchema, StoredDrawSchema, WaveMetaSchema } from "./records";
import { buildReportData, type WaveData } from "./report-data";
import { renderReport } from "./report-md";
import { rescoreWave } from "./rescore-wave";
import { EXTRACTOR_COST_ESTIMATE_USD, runWave } from "./run";
import { createSimulatedTransport, simulatedExtract } from "./simulate";

export interface CommonOptions {
  readonly runsDir: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly log: (message: string) => void;
  readonly now: () => Date;
}

const ENV_KEYS: Readonly<Record<EngineId, string>> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

const requireEnv = (env: CommonOptions["env"], name: string): string => {
  const value = env[name];
  if (value === undefined || value.trim() === "") throw new CliError(`${name} is missing in .env (see .env.example)`);
  return value.trim();
};

const buildAdapters = (m: Manifest, transport: Transport, keyOf: (e: EngineId) => string): Partial<Record<EngineId, EngineAdapter>> => {
  const factories = { openai: createOpenAiAdapter, anthropic: createAnthropicAdapter, perplexity: createPerplexityAdapter };
  // models[e] is guaranteed by ManifestSchema's refine ("every selected engine needs a model").
  return Object.fromEntries(m.engines.map((e) => [e, factories[e]({ apiKey: keyOf(e), model: m.models[e]!, transport })]));
};

export interface RunCommand extends CommonOptions {
  readonly manifestPath: string;
  readonly identityPath: string;
  readonly dryRun: boolean;
  readonly confirmSpend: boolean;
  readonly extractorModel: string;
}

export const commandRun = async (o: RunCommand): Promise<void> => {
  const manifest = await loadJson(o.manifestPath, ManifestSchema, "manifest");
  const identity: Identity = await loadJson(o.identityPath, IdentitySchema, "identity");
  const draws = manifest.engines.length * manifest.jobDescriptions.length * manifest.prompts.length * manifest.drawsPerCell;
  const worst = draws * (manifest.engines.reduce((a, e) => a + WORST_CASE_DRAW_USD[e], 0) / manifest.engines.length + EXTRACTOR_COST_ESTIMATE_USD);
  o.log(`Wave ${manifest.waveId}: ${draws} draws on ${manifest.engines.join(", ")} — worst case ${worst.toFixed(2)} $, hard cap ${manifest.costCapUsd} $`);

  let adapters: Partial<Record<EngineId, EngineAdapter>>;
  let extract: ExtractFn;
  let key: Buffer;
  if (o.dryRun) {
    const transport = createSimulatedTransport(identity, 20260928);
    adapters = buildAdapters(manifest, transport, () => "dry-run");
    extract = simulatedExtract;
    key = o.env.PROOFSEEN_ENC_KEY ? parseKey(o.env.PROOFSEEN_ENC_KEY) : randomBytes(32);
  } else {
    if (manifest.frozenAt === null) throw new CliError("manifest is not frozen: set frozenAt before a real wave (EXPERIMENT_0 §2)");
    if (!o.confirmSpend) throw new CliError("real API calls need --confirm-spend (founder's GO API). Use --dry-run to test for free.");
    key = parseKey(o.env.PROOFSEEN_ENC_KEY);
    adapters = buildAdapters(manifest, fetchTransport, (e) => requireEnv(o.env, ENV_KEYS[e]));
    extract = createToolFreeCompletion({ apiKey: requireEnv(o.env, "ANTHROPIC_API_KEY"), model: o.extractorModel, transport: fetchTransport });
  }

  const meta = await runWave({
    manifest,
    manifestSha256: await sha256File(o.manifestPath),
    identity,
    runsDir: o.runsDir,
    dryRun: o.dryRun,
    adapters,
    extract,
    key,
    now: o.now,
    log: o.log,
  });
  o.log(`Done: ${meta.draws} draws (${meta.errors} errors), ${meta.spentUsd.toFixed(3)} $${meta.stoppedReason ? ` — stopped: ${meta.stoppedReason}` : ""}`);
};

export interface ExtractCommand extends CommonOptions {
  readonly identityPath: string;
  readonly waveId: string;
}

export const commandExtract = async (o: ExtractCommand): Promise<void> => {
  const identity = await loadJson(o.identityPath, IdentitySchema, "identity");
  const summary = await rescoreWave(o.runsDir, o.waveId, identity, parseKey(o.env.PROOFSEEN_ENC_KEY));
  o.log(`Re-scored ${summary.rescored} answers; ${summary.unavailable} no longer available (72 h purge or unreadable).`);
};

const loadWave = async (runsDir: string, waveId: string): Promise<WaveData> => {
  const paths = wavePaths(runsDir, waveId);
  return {
    meta: await loadJson(paths.wave, WaveMetaSchema, `wave ${waveId}`),
    draws: await readJsonl(paths.draws, StoredDrawSchema),
    matches: await readJsonl(paths.matches, MatchSchema),
  };
};

export interface ReportCommand extends CommonOptions {
  readonly waveId: string;
  readonly baselineWaveId: string | undefined;
  readonly manualPath: string | undefined;
  readonly reportDir: string;
}

export const commandReport = async (o: ReportCommand): Promise<string> => {
  const current = await loadWave(o.runsDir, o.waveId);
  const rescore = await readJsonl(wavePaths(o.runsDir, o.waveId).rescore, RescoreRecordSchema);
  const data = buildReportData({
    current,
    baseline: o.baselineWaveId === undefined ? null : await loadWave(o.runsDir, o.baselineWaveId),
    rescore: rescore.length === 0 ? null : rescore,
    manual: o.manualPath === undefined ? null : await loadManualCsv(o.manualPath),
  });
  const out = join(o.reportDir, `${wavePaths("", o.waveId).dir}.md`);
  await writeText(out, renderReport(data));
  o.log(`Report written: ${out}`);
  return out;
};

export const commandPurge = async (o: CommonOptions): Promise<void> => {
  let waves: string[];
  try {
    waves = await readdir(o.runsDir);
  } catch {
    waves = [];
  }
  const purged = await Promise.all(waves.map((wave) => purgeExpired(join(o.runsDir, wave, "sealed"), o.now())));
  const total = purged.reduce((a, files) => a + files.length, 0);
  o.log(`Purged ${total} expired sealed answers.`);
};
