import { randomBytes } from "node:crypto";
import { z } from "zod";
import { existsSync } from "node:fs";
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
import { buildSite, HubProfileSchema, urlsToFetch, verifyHub, type Fetched } from "@proofseen/hub";
import { PrivateIdentitySchema, assertNoLeaks, buildProfilesSite, buildPublicProfile, reidentificationRisk } from "@proofseen/profiles";
import { CliError, loadJson, readJsonl, sha256File, wavePaths, writeText } from "./files";
import { checkManualSample, loadManualCsv } from "./manual";
import { preflight } from "./preflight";
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
  readonly useJudge: boolean;
}

export const commandRun = async (o: RunCommand): Promise<void> => {
  const manifest = await loadJson(o.manifestPath, ManifestSchema, "manifest");
  const identity: Identity = await loadJson(o.identityPath, IdentitySchema, "identity");
  const draws = manifest.engines.length * manifest.jobDescriptions.length * manifest.prompts.length * manifest.drawsPerCell;
  const worst = draws * (manifest.engines.reduce((a, e) => a + WORST_CASE_DRAW_USD[e], 0) / manifest.engines.length + EXTRACTOR_COST_ESTIMATE_USD);
  o.log(`Wave ${manifest.waveId}: ${draws} draws on ${manifest.engines.join(", ")} — worst case ${worst.toFixed(2)} $, hard cap ${manifest.costCapUsd} $`);

  let adapters: Partial<Record<EngineId, EngineAdapter>>;
  let extract: ExtractFn;
  let judge: ExtractFn | undefined;
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
    judge = o.useJudge ? extract : undefined;
  }

  const meta = await runWave({
    manifest,
    manifestSha256: await sha256File(o.manifestPath),
    identity,
    runsDir: o.runsDir,
    dryRun: o.dryRun,
    adapters,
    extract,
    judge,
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

export interface HubCommand extends CommonOptions {
  readonly profilePath: string;
  readonly outDir: string;
}

/** Generates the static hub (A1-A2). Local files only: publishing is the founder's call, after the API baseline. */
export const commandHub = async (o: HubCommand): Promise<string[]> => {
  const profile = await loadJson(o.profilePath, HubProfileSchema, "hub profile");
  const files = buildSite(profile);
  await Promise.all(files.map((f) => writeText(join(o.outDir, ...f.path.split("/")), f.content)));
  o.log(`Hub written to ${o.outDir}: ${files.length} files (${files.filter((f) => f.path.endsWith(".html")).length} pages, no JavaScript).`);
  return files.map((f) => f.path);
};

export interface HubVerifyCommand extends Pick<CommonOptions, "log"> {
  readonly profilePath: string;
  readonly timeoutMs: number;
}

/** Checks the DEPLOYED hub as a crawler sees it: raw HTML, no JavaScript executed (ROADMAP S2, definition of done). */
export const commandHubVerify = async (o: HubVerifyCommand): Promise<void> => {
  const profile = await loadJson(o.profilePath, HubProfileSchema, "hub profile");
  const urls = urlsToFetch(profile);
  o.log(`Fetching ${urls.length} URLs from ${profile.baseUrl} (no JavaScript, like a crawler)…`);
  const responses = new Map<string, Fetched>();
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(o.timeoutMs) });
      responses.set(url, { status: response.status, body: await response.text(), contentType: response.headers.get("content-type") ?? "" });
    } catch {
      responses.set(url, { status: 0, body: "", contentType: "" }); // unreachable: reported as a failed check, never as a crash
    }
  }
  const report = verifyHub(profile, (url) => responses.get(url) ?? { status: 404, body: "", contentType: "" });
  const mark = { ok: "[ ok ]", warn: "[warn]", fail: "[FAIL]" };
  report.checks.forEach((c) => o.log(`${mark[c.status]} ${c.name}: ${c.detail}`));
  if (!report.ok) throw new CliError("the deployed hub does not meet the definition of done (see the [FAIL] lines).");
  o.log("Deployed hub OK: an AI crawler reads the whole text without running any script.");
};
const ProfilesInputSchema = z.object({
  baseUrl: z.url({ protocol: /^https$/ }).refine((u) => !u.endsWith("/"), "baseUrl ne doit pas finir par /"),
  entries: z
    .array(z.object({ identity: PrivateIdentitySchema, profile: z.unknown() }))
    .min(1)
    .max(500),
});

export interface ProfilesCommand extends CommonOptions {
  readonly inputPath: string;
  readonly outDir: string;
}

/**
 * Builds the public pseudonymous site. Three gates before anything is written: the Identity Firewall on each draft,
 * the re-identification risk on each profile, and a final sweep of every produced file against every private identity.
 */
export const commandProfiles = async (o: ProfilesCommand): Promise<string[]> => {
  const input = await loadJson(o.inputPath, ProfilesInputSchema, "profils");
  const profiles = input.entries.map((entry) => buildPublicProfile(entry.identity, entry.profile));
  profiles.forEach((profile) => {
    const risk = reidentificationRisk(profile);
    o.log(`${profile.id} — risque de ré-identification ${risk.score}/100${risk.blocking ? " (BLOQUANT)" : ""}`);
    risk.reasons.forEach((r) => o.log(`    ${r.signal} (+${r.points}) : ${r.detail}`));
    risk.suggestions.forEach((s) => o.log(`    → ${s}`));
  });
  const files = buildProfilesSite(profiles, { baseUrl: input.baseUrl });
  assertNoLeaks(input.entries.map((entry) => entry.identity), files);
  await Promise.all(files.map((f) => writeText(join(o.outDir, ...f.path.split("/")), f.content)));
  o.log(`Site public écrit dans ${o.outDir} : ${files.length} fichiers (${files.filter((f) => f.path.endsWith(".html")).length} pages, aucun JavaScript).`);
  return files.map((f) => f.path);
};
/** Validates the hand-filled manual sample on its own (usable before the wave exists): exits 1 on any protocol problem. */
export const commandCheckManual = async (o: Pick<CommonOptions, "log"> & { readonly manualPath: string }): Promise<void> => {
  const { problems, summary } = checkManualSample(await loadManualCsv(o.manualPath));
  const apps = Object.entries(summary.byApp).map(([app, n]) => `${app} ${n}`).join(", ");
  o.log(`${summary.total} rows · client present in ${summary.present} · ${apps || "no app"}`);
  if (problems.length > 0) throw new CliError([`manual sample: ${problems.length} problem(s)`, ...problems.map((p) => `- ${p}`)].join("\n"));
  o.log("manual sample OK");
};

/** Dry check of everything that could sink a real wave. Reads the env only to say whether a key is present. */
export const commandPreflight = async (o: CommonOptions & { readonly manifestPath: string; readonly identityPath: string }): Promise<void> => {
  const manifest = await loadJson(o.manifestPath, ManifestSchema, "manifest");
  const identity: Identity = await loadJson(o.identityPath, IdentitySchema, "identity");
  const report = preflight({ manifest, identity, env: o.env, waveExists: existsSync(join(o.runsDir, manifest.waveId)), now: o.now() });
  const mark = { ok: "[ ok ]", warn: "[warn]", fail: "[FAIL]" };
  report.checks.forEach((c) => o.log(`${mark[c.status]} ${c.name}: ${c.detail}`));
  o.log(`manifest sha256 ${await sha256File(o.manifestPath)}`);
  if (!report.go) throw new CliError("NO-GO: fix the [FAIL] lines above before spending.");
  o.log("GO: sim:run --confirm-spend can be launched.");
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
