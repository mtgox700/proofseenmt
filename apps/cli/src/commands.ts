import { randomBytes } from "node:crypto";
import { z } from "zod";
import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { IdentitySchema, ManifestSchema, MatchSchema, RELEVANT_INDEXES, assertJdFreeOfIdentity, type EngineId, type Identity, type Manifest } from "@proofseen/core";
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
import { RAW_TTL_MS, parseKey, purgeAll, purgeExpired, type ExtractFn } from "@proofseen/extract";
import { assertOwnPagesClean } from "./own-pages";
import { botHits, relevantIndexation, threeArmVerdict } from "@proofseen/stats";
import { buildSite, HubProfileSchema, urlsToFetch, verifyHub, type Fetched } from "@proofseen/hub";
import {
  PrivateIdentitySchema,
  issueChallenge,
  SurfaceCheckRecordSchema,
  SelfSearchSchema,
  assertNoLeaks,
  kAnonymity,
  MEANINGFUL_CATALOGUE_SIZE,
  publicationBlockers,
  selfSearchQueries,
  takedowns,
  buildProfilesSite,
  buildPublicProfile,
  findLeaks,
  planExperiment,
  THRESHOLDS,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  indexNowOutcome,
  indexNowPayload,
  sitemapUrls,
  verifyDeployedSite,
  type Served,
  type SiteFile,
  reidentificationRisk,
  type PrivateIdentity,
  type PublicProfile,
} from "@proofseen/profiles";
import { CliError, loadJson, readJsonl, sha256File, syncOutput, wavePaths, writeText } from "./files";
import { EXPECTED_MANUAL_ROWS, checkManualSample, loadManualCsv } from "./manual";
import { observationsFrom, renderLdrReport } from "./ldr-data";
import { preflight } from "./preflight";
import { ArmRecordSchema, RescoreRecordSchema, StoredDrawSchema, WaveMetaSchema, type WaveMeta } from "./records";
import { armDrawsFrom, armIdentities, renderVerdict } from "./arms";
import { renderWaveStatus } from "./wave-status";
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
  /** Three-arm test: extra identities matched on every draw (one arms.jsonl line per draw and per arm). */
  readonly armPaths?: readonly string[] | undefined;
}

export const commandRun = async (o: RunCommand): Promise<void> => {
  const manifest = await loadJson(o.manifestPath, ManifestSchema, "manifest");
  const identity: Identity = await loadJson(o.identityPath, IdentitySchema, "identity");
  const arms = await Promise.all((o.armPaths ?? []).map((path) => loadJson(path, IdentitySchema, `bras ${path}`)));
  if (arms.length > 0) o.log(`Test à 3 bras : ${arms.length} identité(s) lue(s) sur chaque tirage — ${arms.map((a) => a.id).join(", ")}`);
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
    arms,
    runsDir: o.runsDir,
    dryRun: o.dryRun,
    adapters,
    extract,
    judge,
    key,
    now: o.now,
    log: o.log,
  });
  o.log(`Done: ${meta.draws} draws (${meta.errors} errors), ${meta.spentUsd.toFixed(3)} ${meta.stoppedReason ? ` — stopped: ${meta.stoppedReason}` : ""}`);
  await debriefRun(o, meta);
};

/**
 * Ce qu'une vague doit dire en se terminant, sous forme de lignes — pur, donc vérifiable.
 *
 * Sur J0, **780 extractions sur 780 ont échoué** et personne ne l'a vu avant des heures : le rang et le « nommé »
 * reposaient alors sur le seul re-scoring déterministe. Or les réponses brutes s'effacent 72 h après la mesure — passé
 * ce délai, la vague n'est plus ré-analysable, et l'audit d'un client qui a payé devient irrécupérable.
 *
 * Le compte à rebours commence donc à l'instant où la vague se termine : il est annoncé, avec la commande exacte.
 */
export interface RunDebrief {
  readonly dryRun: boolean;
  readonly waveId: string;
  readonly startedAt: string;
  readonly draws: number;
  readonly failedExtractions: number;
}

export const runDebriefLines = ({ dryRun, waveId, startedAt, draws, failedExtractions }: RunDebrief): string[] => {
  // Un essai à vide n'a rien produit qu'on puisse ré-analyser : l'avertir ferait du bruit, et le bruit cesse d’être lu.
  if (dryRun) return [];
  const deadline = new Date(Date.parse(startedAt) + RAW_TTL_MS).toISOString();
  const head =
    failedExtractions > 0
      ? [
          `⚠ EXTRACTION ÉCHOUÉE SUR ${failedExtractions} TIRAGE(S) SUR ${draws}.`,
          "  Sans extraction, le rang et le « nommé » ne reposent que sur le re-scoring déterministe.",
          `  Corriger la cause, puis relancer AVANT le ${deadline} :`,
        ]
      : [
          `Réponses brutes conservées jusqu'au ${deadline} (72 h), puis effacées définitivement.`,
          "  Toute ré-analyse doit avoir lieu avant cette date :",
        ];
  return ["", ...head, `  proofseen extract --identity <identité> --wave ${waveId}`];
};

const debriefRun = async (o: RunCommand, meta: WaveMeta): Promise<void> => {
  const draws = meta.dryRun ? [] : await readJsonl(wavePaths(o.runsDir, meta.waveId).draws, StoredDrawSchema);
  const lines = runDebriefLines({
    dryRun: meta.dryRun,
    waveId: meta.waveId,
    startedAt: meta.startedAt,
    draws: draws.length,
    failedExtractions: draws.filter((draw) => draw.extractionFailed).length,
  });
  for (const line of lines) o.log(line);
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

/** Chargement d'une vague mesurée : méta, tirages, appariements. Partagé avec la commande `audit`. */
export const loadWave = async (runsDir: string, waveId: string): Promise<WaveData> => {
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
  /** Identité du client : le jeton de possession est alors déposé par le site lui-même. */
  readonly identityPath?: string | undefined;
}

/**
 * Generates the static hub (A1-A2). Local files only: publishing is the founder's call, after the API baseline.
 *
 * Avec `--identity`, le jeton de preuve est **dérivé** et publié par le site que nous construisons : le client n'a
 * rien à recopier, et la boucle se ferme — on bâtit sa page, elle porte sa preuve, `possession --verify` la lit.
 * Recopier un jeton à la main est exactement l'endroit où l'on se trompe d'un caractère sans jamais le voir.
 */
export const commandHub = async (o: HubCommand): Promise<string[]> => {
  const loaded = await loadJson(o.profilePath, HubProfileSchema, "hub profile");
  const profile = o.identityPath === undefined ? loaded : { ...loaded, verificationToken: await hubToken(o, loaded.baseUrl) };
  if (o.identityPath !== undefined) o.log(`Jeton de possession déposé pour ${loaded.baseUrl} (dérivé, rien à recopier).`);
  const files = buildSite(profile);
  assertOwnPagesClean(files, o.log);
  await Promise.all(files.map((f) => writeText(join(o.outDir, ...f.path.split("/")), f.content)));
  o.log(`Hub written to ${o.outDir}: ${files.length} files (${files.filter((f) => f.path.endsWith(".html")).length} pages, no JavaScript).`);
  return files.map((f) => f.path);
};

/** Jeton de preuve du domaine du hub, dérivé de l'identité du client — jamais saisi. */
const hubToken = async (o: HubCommand, baseUrl: string): Promise<string> => {
  const secret = o.env.PROOFSEEN_PROOF_SECRET;
  if (secret === undefined || secret === "") {
    throw new CliError("PROOFSEEN_PROOF_SECRET absent de l'environnement : sans secret, le jeton serait devinable et ne prouverait rien");
  }
  const identity = await loadJson(o.identityPath!, IdentitySchema, "identité");
  return issueChallenge({ secret, identityId: identity.id, url: `${baseUrl}/`, method: "well_known_file" }).token;
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
  /** Adresse de Proofseen (jamais celle d'un freelance : le balayage anti-fuite le vérifierait). */
  contactEmail: z.email().optional(),
  /** Clé IndexNow : servie à la racine, elle prouve que nous possédons le domaine. */
  indexNowKey: z.string().regex(INDEXNOW_KEY).optional(),
  entries: z
    // selfSearch : test de ré-identification fait par le freelance lui-même (PIVOT_ANONYME §6.2).
    .array(z.object({ identity: PrivateIdentitySchema, profile: z.unknown(), selfSearch: SelfSearchSchema.optional() }))
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
  const now = o.now();
  const active = input.entries.filter((entry) => entry.identity.consent.withdrawnAt === null);
  const profiles = active.map((entry) => buildPublicProfile(entry.identity, entry.profile));
  profiles.forEach((profile) => {
    const risk = reidentificationRisk(profile);
    o.log(`${profile.id} — risque de ré-identification ${risk.score}/100${risk.blocking ? " (BLOQUANT)" : ""}`);
    risk.reasons.forEach((r) => o.log(`    ${r.signal} (+${r.points}) : ${r.detail}`));
    risk.suggestions.forEach((s) => o.log(`    → ${s}`));
  });
  logKAnonymity(o, profiles);

  // Test de ré-identification (§6.2) : aucune publication tant qu'un profil ne l'a pas passé.
  const blockers = publicationBlockers({
    profiles,
    selfSearches: new Map(active.map((entry) => [entry.identity.profileId, entry.selfSearch])),
    consentGivenAt: new Map(active.map((entry) => [entry.identity.profileId, entry.identity.consent.givenAt])),
    now,
  });
  if (blockers.length > 0) {
    blockers.forEach((blocker) => o.log(`  BLOQUANT : ${blocker}`));
    const pending = profiles.filter((p) => blockers.some((b) => b.startsWith(`${p.id} :`)));
    pending.forEach((p) => {
      o.log(`  Auto-recherche à faire par ${p.id} lui-même (rien n'est lancé par Proofseen) :`);
      selfSearchQueries(p).forEach((q) => o.log(`    · ${q}`));
    });
    throw new CliError(`${blockers.length} bloquant(s) de ré-identification : rien n'est écrit.`);
  }

  // Retrait du consentement (§6.3) : la page quitte le site, et l'échéance de 72 h est rappelée.
  const removals = takedowns(input.entries.map((entry) => entry.identity), input.baseUrl, now);
  await Promise.all(removals.flatMap((t) => [rm(join(o.outDir, "p", t.id), { recursive: true, force: true }), rm(join(o.outDir, "en", "p", t.id), { recursive: true, force: true })]));
  removals.forEach((t) =>
    o.log(`  RETRAIT ${t.id} : pages supprimées de ${o.outDir}, échéance ${t.deadline}${t.overdue ? " — DÉPASSÉE" : ""}. Demander la désindexation : ${t.urls.join("  ")}`),
  );

  const files = buildProfilesSite(profiles, { baseUrl: input.baseUrl, contactEmail: input.contactEmail, indexNowKey: input.indexNowKey });
  assertOwnPagesClean(files, o.log);
  // Le balayage porte sur toutes les identités, retirées comprises : une personne partie ne doit fuiter nulle part.
  assertNoLeaks(input.entries.map((entry) => entry.identity), files);
  const stale = await syncOutput(o.outDir, files);
  stale.forEach((path) => o.log(`  retiré (n existe plus dans ce build) : ${path}`));
  o.log(`Site public écrit dans ${o.outDir} : ${files.length} fichiers (${files.filter((f) => f.path.endsWith(".html")).length} pages, aucun JavaScript).`);
  return files.map((f) => f.path);
};

const logKAnonymity = (o: Pick<CommonOptions, "log">, profiles: readonly PublicProfile[]): void => {
  const unique = kAnonymity(profiles).filter((entry) => entry.k === 1).length;
  o.log(
    profiles.length < MEANINGFUL_CATALOGUE_SIZE
      ? `k-anonymat : ${unique}/${profiles.length} profil(s) unique(s) dans le catalogue — indicatif sous ${MEANINGFUL_CATALOGUE_SIZE} profils, l'auto-recherche fait foi`
      : `k-anonymat : ${unique}/${profiles.length} profil(s) unique(s) dans le catalogue`,
  );
};

/*
 * Three-arm test (PIVOT_ANONYME §5). The named arm publishes a real identity on purpose, so the leak sweep is split:
 * every file is checked against every private identity, except the named pages, which are checked against everyone
 * BUT the subject. The exposure must be claimed explicitly, by the subject, with a date.
 */
const ExperimentInputSchema = z.object({
  /** Absent = test à 2 bras (A nominatif contre B pseudonyme), sur les seules données du sujet. */
  entrySlug: z.string().regex(/^[a-z0-9-]+$/, "entrySlug : minuscules, chiffres et tirets").optional(),
  publishedAt: z.iso.date(),
  namedArm: z.object({
    profileId: z.string().regex(/^[A-Z]{2}-[A-Z0-9]{5}$/),
    identity: z.object({
      displayName: z.string().min(2).max(120),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      sameAs: z.array(z.url({ protocol: /^https$/ })).max(10),
    }),
    /** Written consent of the subject to publish his real identity: without it, nothing is generated. */
    consent: z.object({
      selfPublished: z.literal(true),
      givenAt: z.iso.date(),
      scope: z.literal("named_arm_of_the_three_arm_test"),
    }),
  }),
});

export interface ExperimentCommand extends CommonOptions {
  readonly inputPath: string;
  readonly experimentPath: string;
  readonly outDir: string;
  readonly manifestPath: string;
}

/** The only two fields the subject publishes on purpose; an email or a phone number stays a leak everywhere. */
const NAMED_ARM_ALLOWED_FIELDS: readonly string[] = ["realName", "link"];
/**
 * What the named arm owns: its own pages, the home list where its card sits next to the pseudonymous ones, and the
 * sitemap — its URL is built on the real name, so the name necessarily appears there. Everything else stays swept.
 */
const namedArmOwns = (path: string): boolean =>
  /^(en\/)?n\//.test(path) || path === "index.html" || path === "en/index.html" || path === "sitemap.xml";

const sweepExperiment = (identities: readonly PrivateIdentity[], files: readonly { path: string; content: string }[], subjectId: string): void => {
  const subject = identities.find((identity) => identity.profileId === subjectId);
  const others = identities.filter((identity) => identity.profileId !== subjectId);
  assertNoLeaks(others, files);
  if (subject === undefined) return;
  // Le sujet reste protégé partout ailleurs, et sur ses propres pages tout sauf son nom et ses liens reste une fuite.
  assertNoLeaks([subject], files.filter((file) => !namedArmOwns(file.path)));
  const strays = files
    .filter((file) => namedArmOwns(file.path))
    .flatMap((file) => findLeaks(subject, file.content).filter((field) => !NAMED_ARM_ALLOWED_FIELDS.includes(field)).map((field) => `${file.path} → ${subjectId}.${field}`));
  if (strays.length > 0) throw new CliError(`bras nominatif : ${strays.join(" · ")}`);
};

export const commandExperiment = async (o: ExperimentCommand): Promise<readonly string[]> => {
  const input = await loadJson(o.inputPath, ProfilesInputSchema, "profils");
  const plan = await loadJson(o.experimentPath, ExperimentInputSchema, "test à 3 bras");
  const profiles = input.entries
    .filter((entry) => entry.identity.consent.withdrawnAt === null)
    .map((entry) => buildPublicProfile(entry.identity, entry.profile));
  const { files, manifest, blockers } = planExperiment({
    profiles,
    namedArm: plan.namedArm,
    entrySlug: plan.entrySlug,
    publishedAt: plan.publishedAt,
    baseUrl: input.baseUrl,
    contactEmail: input.contactEmail,
    indexNowKey: input.indexNowKey,
  });
  sweepExperiment(input.entries.map((entry) => entry.identity), files, plan.namedArm.profileId);

  o.log(
    `Test à ${manifest.arms.length} bras · A nominatif (consentement du ${plan.namedArm.consent.givenAt}) · B pseudonyme` +
      (manifest.arms.length > 2 ? " · C page d'entrée" : " · pas de page d'entrée (mécanisme B non testé)"),
  );
  manifest.arms.forEach((arm) => o.log(`  ${arm.arm} — ${arm.role} : ${arm.urls.join("  ")}`));
  manifest.measurements.forEach((m) => o.log(`  mesure J+${m.day} : ${m.date} (vague réduite, 150 tirages)`));
  o.log(`  limite assumée : ${manifest.limitation}`);
  if (blockers.length > 0) {
    blockers.forEach((blocker) => o.log(`  BLOQUANT : ${blocker}`));
    throw new CliError(`${blockers.length} bloquant(s) : le test ne serait pas interprétable, rien n'est écrit.`);
  }

  const stale = await syncOutput(o.outDir, files);
  stale.forEach((path) => o.log(`  retiré (n existe plus dans ce build) : ${path}`));
  // Le manifeste reste hors du site : le publier reviendrait à annoncer l'expérience aux moteurs qu'elle mesure.
  await writeText(o.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  o.log(`Site écrit dans ${o.outDir} : ${files.length} fichiers. Pré-enregistrement (non publié) : ${o.manifestPath}`);
  return files.map((f) => f.path);
};

export interface LdrCommand extends CommonOptions {
  readonly waveId: string;
  readonly profileIds: readonly string[];
  readonly logPath: string | undefined;
  readonly watchedPaths: readonly string[];
  readonly reportDir: string;
}

/** Reads a measured wave (and, when given, the server access log) and writes the LLM Discoverability Rate report. */
export const commandLdr = async (o: LdrCommand): Promise<string> => {
  const paths = wavePaths(o.runsDir, o.waveId);
  const draws = await readJsonl(paths.draws, StoredDrawSchema);
  const matches = await readJsonl(paths.matches, MatchSchema);
  const ids = o.profileIds.length > 0 ? o.profileIds : [...new Set(matches.map((m) => m.identityId))];
  if (ids.length === 0) throw new CliError("aucun profil à mesurer : passer --profiles <id,id> ou lancer sim:extract d'abord");
  const logLines = o.logPath === undefined ? [] : (await readFile(o.logPath, "utf8")).split("\n");
  const report = renderLdrReport({
    waveId: o.waveId,
    date: o.now().toISOString().slice(0, 10),
    engines: [...new Set(draws.map((d) => d.engine))],
    observations: observationsFrom(draws, matches, ids),
    crawler: o.logPath === undefined && o.watchedPaths.length === 0 ? [] : botHits(logLines, o.watchedPaths),
  });
  const out = join(o.reportDir, `${wavePaths("", o.waveId).dir}-ldr.md`);
  await writeText(out, report);
  o.log(`Rapport LDR écrit : ${out}`);
  return out;
};
/** Validates the hand-filled manual sample on its own (usable before the wave exists): exits 1 on any protocol problem. */
export const commandCheckManual = async (
  o: Pick<CommonOptions, "log"> & { readonly manualPath: string; readonly expectedRows?: number | undefined },
): Promise<void> => {
  const rows = await loadManualCsv(o.manualPath);
  // Un échantillon partiel vaut mieux que rien, à condition de le déclarer : le rapport dira sur quoi il repose.
  const { problems, summary } = checkManualSample(rows, o.expectedRows ?? EXPECTED_MANUAL_ROWS);
  if (o.expectedRows !== undefined && o.expectedRows < EXPECTED_MANUAL_ROWS) {
    o.log(`Échantillon PARTIEL déclaré : ${o.expectedRows} saisies au lieu de ${EXPECTED_MANUAL_ROWS}.`);
  }
  const apps = Object.entries(summary.byApp).map(([app, n]) => `${app} ${n}`).join(", ");
  o.log(`${summary.total} lignes · client présent dans ${summary.present} · refus de nommer : ${summary.refusals} · ${apps || "aucune app"}`);
  if (problems.length > 0) throw new CliError([`manual sample: ${problems.length} problem(s)`, ...problems.map((p) => `- ${p}`)].join("\n"));
  o.log("manual sample OK");
};

/** Dry check of everything that could sink a real wave. Reads the env only to say whether a key is present. */
export const commandPreflight = async (
  o: CommonOptions & { readonly manifestPath: string; readonly identityPath: string; readonly recordPath: string },
): Promise<void> => {
  const manifest = await loadJson(o.manifestPath, ManifestSchema, "manifest");
  const identity: Identity = await loadJson(o.identityPath, IdentitySchema, "identity");
  // Trace absente = contrôle non fait : le préflight le refuse, il ne le devine pas.
  const surfaceCheck = existsSync(o.recordPath) ? await loadJson(o.recordPath, SurfaceCheckRecordSchema, "contrôle de surface") : null;
  const report = preflight({
    manifest,
    identity,
    env: o.env,
    waveExists: existsSync(join(o.runsDir, manifest.waveId)),
    now: o.now(),
    surfaceCheck,
  });
  const mark = { ok: "[ ok ]", warn: "[warn]", fail: "[FAIL]" };
  report.checks.forEach((c) => o.log(`${mark[c.status]} ${c.name}: ${c.detail}`));
  o.log(`manifest sha256 ${await sha256File(o.manifestPath)}`);
  if (!report.go) throw new CliError("NO-GO: fix the [FAIL] lines above before spending.");
  o.log("GO: sim:run --confirm-spend can be launched.");
};
export interface PurgeCommand extends CommonOptions {
  /** Vague dont on supprime les réponses scellées AVANT l échéance : leur analyse est terminée. */
  readonly waveId?: string | undefined;
}

export const commandPurge = async (o: PurgeCommand): Promise<void> => {
  if (o.waveId !== undefined) {
    const files = await purgeAll(wavePaths(o.runsDir, o.waveId).sealed);
    o.log(`${files.length} réponse(s) scellée(s) de la vague ${o.waveId} supprimées avant l échéance. La vague ne peut plus être ré-analysée.`);
    return;
  }
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

/** Every file of a published folder, with forward-slash paths, as the site generator produced them. */
const readPublished = async (outDir: string): Promise<SiteFile[]> => {
  let entries;
  try {
    entries = await readdir(outDir, { withFileTypes: true, recursive: true });
  } catch {
    throw new CliError(`dossier publié introuvable : ${outDir}`);
  }
  const files = entries.filter((entry) => entry.isFile());
  return Promise.all(
    files.map(async (entry) => {
      const full = join(entry.parentPath, entry.name);
      const path = full.slice(outDir.length).split(/[\\/]+/).filter(Boolean).join("/");
      return { path, content: await readFile(full, "utf8") };
    }),
  );
};

const BaseUrlSchema = z.url({ protocol: /^https$/ }).refine((u) => !u.endsWith("/"), "baseUrl ne doit pas finir par /");

export interface SiteVerifyCommand extends Pick<CommonOptions, "log"> {
  readonly outDir: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetchImpl?: typeof fetch | undefined;
}

/** Checks the deployed site against the published folder, the way the measured engines will meet it (profiles/verify.ts). */
export const commandSiteVerify = async (o: SiteVerifyCommand): Promise<void> => {
  const baseUrl = BaseUrlSchema.parse(o.baseUrl);
  const published = await readPublished(o.outDir);
  const doFetch = o.fetchImpl ?? fetch;
  const cache = new Map<string, Served>();
  const want = new Set<string>();
  // Pass 1: learn which URLs the checks ask for; pass 2: answer them from the network.
  verifyDeployedSite(baseUrl, published, (url, ua) => {
    want.add(`${ua ?? ""}\u0000${url}`);
    return { status: 0, body: "", contentType: "", robotsTag: "" };
  });
  o.log(`${want.size} requêtes vers ${baseUrl} (pages, robots, sitemap, et user-agents des robots d'IA)…`);
  for (const key of want) {
    const [ua, url] = key.split("\u0000") as [string, string];
    try {
      const response = await doFetch(url, { redirect: "follow", signal: AbortSignal.timeout(o.timeoutMs), headers: ua === "" ? {} : { "user-agent": ua } });
      cache.set(key, {
        status: response.status,
        body: await response.text(),
        contentType: response.headers.get("content-type") ?? "",
        robotsTag: response.headers.get("x-robots-tag") ?? "",
      });
    } catch {
      cache.set(key, { status: 0, body: "", contentType: "", robotsTag: "" });
    }
  }
  const report = verifyDeployedSite(baseUrl, published, (url, ua) => cache.get(`${ua ?? ""}\u0000${url}`) ?? { status: 0, body: "", contentType: "", robotsTag: "" });
  const mark = { ok: "[ ok ]", warn: "[warn]", fail: "[FAIL]" };
  report.checks.forEach((c) => o.log(`${mark[c.status]} ${c.name} : ${c.detail}`));
  if (!report.ok) throw new CliError("le site déployé ne correspond pas au dossier publié ou bloque les robots (voir les lignes [FAIL]).");
  o.log("Site déployé conforme au dossier publié. L'accès réel des robots se prouve ensuite par leurs visites dans les journaux (sim:ldr --log).");
};

export interface IndexNowCommand extends Pick<CommonOptions, "log"> {
  readonly outDir: string;
  readonly baseUrl: string;
  readonly confirmSubmit: boolean;
  readonly fetchImpl?: typeof fetch | undefined;
}

/**
 * Prepares the IndexNow submission from the published folder. Sending URLs to an external service is the founder's
 * decision on publication day: nothing leaves this machine without --confirm-submit.
 */
export const commandIndexNow = async (o: IndexNowCommand): Promise<number> => {
  const baseUrl = BaseUrlSchema.parse(o.baseUrl);
  const published = await readPublished(o.outDir);
  const keyFile = published.find((f) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(f.path) && f.content.trim() === f.path.replace(/\.txt$/, ""));
  if (keyFile === undefined) throw new CliError("aucun fichier de clé IndexNow dans le dossier publié : ajouter indexNowKey au fichier de profils puis regénérer.");
  const sitemap = published.find((f) => f.path === "sitemap.xml");
  if (sitemap === undefined) throw new CliError("sitemap.xml absent du dossier publié.");
  const payload = indexNowPayload(baseUrl, keyFile.path.replace(/\.txt$/, ""), sitemapUrls(sitemap.content));
  o.log(`${payload.urlList.length} URL de ${payload.host}, clé servie à ${payload.keyLocation}`);
  if (!o.confirmSubmit) {
    o.log("Rien n'est envoyé. Relancer avec --confirm-submit le jour de la publication, après site-verify.");
    return 0;
  }
  const response = await (o.fetchImpl ?? fetch)(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const outcome = indexNowOutcome(response.status);
  o.log(`IndexNow : HTTP ${response.status} — ${outcome.meaning}`);
  if (!outcome.ok) throw new CliError(`soumission refusée : ${outcome.meaning}`);
  return response.status;
};

const ExperimentArmsSchema = z.object({ verifiedAt: z.iso.date() });

/*
 * Relevé d'indexation des bras, au moment de la mesure. C'est un **fait extérieur** : il se lit dans Search Console
 * et Bing Webmaster Tools, il ne se calcule pas. Il entre donc par un fichier que l'opérateur remplit, comme les
 * relevés manuels ailleurs dans cette CLI.
 *
 * Sans lui, le verdict ne peut plus clore de voie — c'est voulu. Le 29/09, Bing donnait la page nominative
 * « Discovered but not crawled » cinq jours après l'avoir découverte ; trois bras jamais crawlés auraient produit
 * trois zéros, et le verdict aurait déclaré la thèse du produit morte sur une expérience qui n'avait pas eu lieu.
 */
const IndexationSchema = z.object({
  checkedAt: z.iso.date(),
  arms: z
    .array(
      z.object({
        arm: z.enum(["A", "B", "C"]),
        // Sans ce champ, « 1 page indexée » ne veut rien dire : être dans Google ne rend la page récupérable par
        // aucun des moteurs mesurés. Le 01/10, Google indexait la page nominative que Bing n'avait jamais crawlée.
        index: z.enum(["bing", "brave", "google", "other"]),
        indexed: z.number().int().nonnegative(),
        declared: z.number().int().positive(),
      }),
    )
    .min(1)
    // Une ligne par couple (bras, index) : 3 bras × 4 index au plus.
    .max(12),
});

export interface ExperimentArmsCommand extends CommonOptions {
  readonly inputPath: string;
  readonly experimentPath: string;
  readonly verifiedAt: string;
  readonly outDir: string;
}

/**
 * Writes the three arm identities the measurement waves need, from the same files as `experiment`, so the URLs the
 * wave recognises are exactly the URLs that were published. They stay local: arm A carries the real name.
 */
export const commandExperimentArms = async (o: ExperimentArmsCommand): Promise<string[]> => {
  const { verifiedAt } = ExperimentArmsSchema.parse({ verifiedAt: o.verifiedAt });
  const input = await loadJson(o.inputPath, ProfilesInputSchema, "profils");
  const plan = await loadJson(o.experimentPath, ExperimentInputSchema, "test à 3 bras");
  const profiles = input.entries
    .filter((entry) => entry.identity.consent.withdrawnAt === null)
    .map((entry) => buildPublicProfile(entry.identity, entry.profile));
  const twin = profiles.find((p) => p.id === plan.namedArm.profileId);
  if (twin === undefined) throw new CliError(`bras B : aucun profil ${plan.namedArm.profileId} dans le lot`);
  const { manifest, blockers } = planExperiment({ profiles, namedArm: plan.namedArm, entrySlug: plan.entrySlug, publishedAt: plan.publishedAt, baseUrl: input.baseUrl });
  if (blockers.length > 0) throw new CliError(`le test a encore ${blockers.length} bloquant(s) : lancer \`experiment\` d'abord`);
  const identities = armIdentities(manifest, twin, plan.namedArm.identity, verifiedAt);
  const written = identities.map((identity) => join(o.outDir, `${identity.id}.json`));
  await Promise.all(identities.map((identity, i) => writeText(written[i]!, `${JSON.stringify(identity, null, 2)}\n`)));
  o.log(`Identités des bras écrites (à garder hors du site) : ${written.join(", ")}`);
  const principal = written.find((w) => w.includes("arm-B")) ?? written[0]!;
  o.log(
    `Vague de mesure : run --identity ${principal} --arms ${written.join(",")} --confirm-spend`,
  );
  return written;
};

export interface ExperimentVerdictCommand extends CommonOptions {
  readonly waveId: string;
  readonly day: number;
  readonly reportDir: string;
  /** Relevé d'indexation des bras. Absent, le verdict ne peut clore aucune voie et le dit. */
  readonly indexationPath?: string | undefined;
}

/** Applies the pre-registered rules of PIVOT_ANONYME §5 to a measured wave and writes the verdict. */
export const commandExperimentVerdict = async (o: ExperimentVerdictCommand): Promise<string> => {
  if (!Number.isInteger(o.day) || o.day < 0) throw new CliError("--day : nombre de jours depuis la publication (30 ou 60)");
  const paths = wavePaths(o.runsDir, o.waveId);
  const draws = await readJsonl(paths.draws, StoredDrawSchema);
  const records = await readJsonl(paths.arms, ArmRecordSchema);
  if (records.length === 0) throw new CliError(`aucun enregistrement par bras dans la vague ${o.waveId} : lancer la vague avec --arms`);
  const meta = await loadJson(paths.wave, WaveMetaSchema, `vague ${o.waveId}`);
  const indexation =
    o.indexationPath === undefined
      ? undefined
      : await loadJson(o.indexationPath, IndexationSchema, "relevé d'indexation").then((releve) =>
          // Seuls les index dont un moteur mesuré tire son web comptent. Un relevé qui ne porterait que sur Google
          // ressort « non relevé » — et c'est le bon défaut : aucun des trois moteurs mesurés ne lit Google.
          relevantIndexation(
            releve.arms.map((row) => ({ ...row, checkedAt: releve.checkedAt })),
            RELEVANT_INDEXES,
          ),
        );
  const verdict = threeArmVerdict(armDrawsFrom(draws, records), o.day, THRESHOLDS, indexation);
  if (indexation === undefined)
    o.log("Indexation non relevée (--indexation) : le verdict ne clôt aucune voie. Un bras absent de l'index ne peut pas être cité.");
  else if (verdict.delivered !== "yes")
    o.log(`Délivrance ${verdict.delivered === "no" ? "nulle" : "partielle"} : des bras n'étaient pas indexés, leurs zéros ne mesurent pas l'hypothèse.`);
  const out = join(o.reportDir, `${wavePaths("", o.waveId).dir}-verdict-j${o.day}.md`);
  await writeText(out, renderVerdict(o.waveId, o.day, o.now().toISOString().slice(0, 10), verdict, meta.dryRun));
  if (meta.dryRun) o.log("SIMULATION : vague --dry-run, les chiffres n'ont aucune valeur et aucune décision n'est prise.");
  else o.log(`Mécanisme A : ${verdict.mechanismA} · mécanisme B : ${verdict.mechanismB}${verdict.final ? "" : " (point d'étape, pas de décision)"}`);
  o.log(`Rapport écrit : ${out}`);
  return out;
};

export interface JdImportCommand extends Pick<CommonOptions, "log"> {
  readonly manifestPath: string;
  readonly identityPath: string;
  readonly dir: string;
  readonly outPath: string;
}

/**
 * Fills the manifest's job descriptions from one text file per ad (`T01.txt`, `C01.txt`…). Pasting a whole ad into
 * JSON by hand breaks on newlines and quotes; this reads the files as they are. Each ad is checked against the
 * client's identity on the way in: an ad naming him would inflate his own rank (REVUE #7).
 */
export const commandJdImport = async (o: JdImportCommand): Promise<number> => {
  const manifest = await loadJson(o.manifestPath, ManifestSchema, "manifest");
  const identity = await loadJson(o.identityPath, IdentitySchema, "identity");
  const imported: string[] = [];
  const missing: string[] = [];
  const jobDescriptions = await Promise.all(
    manifest.jobDescriptions.map(async (jd) => {
      const candidates = [join(o.dir, `${jd.id}.txt`), join(o.dir, `${jd.id}.md`)];
      const found = candidates.find((path) => existsSync(path));
      if (found === undefined) {
        missing.push(jd.id);
        return jd;
      }
      const text = (await readFile(found, "utf8")).replace(/\r\n/g, "\n").trim();
      if (text.length === 0) throw new CliError(`${found} est vide`);
      try {
        assertJdFreeOfIdentity(text, identity);
      } catch {
        throw new CliError(`${found} contient l'identité du client (nom ou URL) : une offre ne doit jamais le nommer, sinon la mesure est gonflée`);
      }
      imported.push(jd.id);
      return { ...jd, text };
    }),
  );
  const updated = ManifestSchema.parse({ ...manifest, jobDescriptions });
  await writeText(o.outPath, `${JSON.stringify(updated, null, 2)}\n`);
  o.log(`${imported.length} offre(s) importée(s) : ${imported.join(", ") || "aucune"}`);
  if (missing.length > 0) o.log(`  manquantes (fichier absent dans ${o.dir}) : ${missing.join(", ")}`);
  o.log(`Manifeste écrit : ${o.outPath} — lancer \`preflight\` pour vérifier, puis geler (frozenAt) avant toute dépense.`);
  return imported.length;
};

export interface WaveStatusCommand extends CommonOptions {
  readonly waveId: string;
  readonly manifestPath: string | undefined;
}

/** Où en est une vague, ce qu'elle a coûté, et combien de temps avant la purge des bruts (72 h). */
export const commandWaveStatus = async (o: WaveStatusCommand): Promise<string> => {
  const paths = wavePaths(o.runsDir, o.waveId);
  const draws = await readJsonl(paths.draws, StoredDrawSchema);
  if (draws.length === 0) throw new CliError(`aucun tirage dans ${paths.dir} : la vague n'a pas démarré`);
  const manifest = o.manifestPath === undefined ? null : await loadJson(o.manifestPath, ManifestSchema, "manifest");
  const sealedFiles = await readdir(paths.sealed).then((files) => files.length, () => 0);
  const status = renderWaveStatus({
    waveId: o.waveId,
    draws,
    matches: await readJsonl(paths.matches, MatchSchema),
    arms: await readJsonl(paths.arms, ArmRecordSchema),
    sealedFiles,
    expected: manifest === null ? null : manifest.engines.length * manifest.jobDescriptions.length * manifest.prompts.length * manifest.drawsPerCell,
    now: o.now(),
  });
  status.trimEnd().split("\n").forEach((line) => o.log(line));
  return status;
};
