import { AUDIT_CONTROLS, AUDIT_TARGETS, PLACEHOLDER_MARKER, assertJdFreeOfIdentity, hasPlaceholder, verifiedUrls, type EngineId, type Identity, type Manifest } from "@proofseen/core";
import { surfaceCheckBlocker, type SurfaceCheckRecord } from "@proofseen/profiles";
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
  /** Trace du contrôle de surface. `null` = absente : la mesure est interdite (offre : refus des profils manipulés). */
  readonly surfaceCheck: SurfaceCheckRecord | null;
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

/** Shortest a real job ad can plausibly be. Below this, the cell measures nothing. HYPOTHÈSE. */
const MIN_JD_CHARS = 300;
/** Markers left by the template. A wave on those would burn the budget measuring placeholder text. */
const PLACEHOLDER = /\[À COLLER\]|\[TODO\]|lorem ipsum|<[^>]*à remplir[^>]*>/i;

const normaliseJd = (text: string): string => text.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Counting the job descriptions is not enough: the template ships 13 of them, all placeholders. This check reads what
 * they contain — a false green here costs a full wave (≈ 64 $) and answers nothing. Found on 2026-09-23.
 */
/**
 * Le contrôle de surface est obligatoire : l'offre promet de refuser un profil manipulé, et une obligation qui n'est
 * pas imposée par le code n'est qu'une intention. Il porte sur les URL **vérifiées**, seules à être mesurées.
 */
const surfaceCheck = (identity: Identity, record: SurfaceCheckRecord | null, now: Date): Check => {
  const urls = verifiedUrls(identity).map((owned) => owned.url);
  const blocker = surfaceCheckBlocker({ record, identityId: identity.id, urls, now });
  return blocker === null
    ? { name: "surface check", status: "ok", detail: `${urls.length} URL contrôlée(s) le ${record?.checkedAt ?? "?"}` }
    : { name: "surface check", status: "fail", detail: blocker };
};

/**
 * Aucune offre ne doit contenir l'identité du client (REVUE #7, et engagement de l'offre : « une offre qui contient
 * votre nom ou l'une de vos adresses est refusée »). Une offre qui le nomme truque la mesure : le moteur le retrouve
 * parce qu'on le lui a soufflé.
 *
 * `run` refuse déjà ces offres, mais il le fait **au moment de dépenser**. Sans ce contrôle ici, le préflight
 * annoncerait GO puis la vague échouerait — un GO qui n'en est pas un.
 */
const jdLeakCheck = (m: Manifest, identity: Identity): Check => {
  const leaking = m.jobDescriptions.flatMap((jd) => {
    try {
      assertJdFreeOfIdentity(jd.text, identity);
      if (jd.brief !== undefined) assertJdFreeOfIdentity(jd.brief, identity);
      return [];
    } catch (error) {
      return [`${jd.id} (${(error as Error).message})`];
    }
  });
  return leaking.length === 0
    ? { name: "job ads", status: "ok", detail: `${m.jobDescriptions.length} ad(s), none naming the client` }
    : { name: "job ads", status: "fail", detail: `ad(s) naming the client, which would rig the measurement: ${leaking.join(" · ")}` };
};

/**
 * Un dossier client ouvert par `client-init` sort avec des champs volontairement en attente. Ils doivent **faire
 * échouer** ce portail : un squelette qui passerait serait pire que pas de squelette, et un brief non rempli partirait
 * tel quel dans les formulations envoyées aux moteurs — on paierait pour demander « je cherche À RENSEIGNER ».
 */
const placeholderCheck = (m: Manifest, identity: Identity): Check => {
  const left = [
    ...[identity.city, identity.displayName, ...identity.stack, ...identity.nameVariants]
      .filter(hasPlaceholder)
      .map((value) => `identity: ${value}`),
    ...m.jobDescriptions
      .filter((jd) => hasPlaceholder(jd.text) || (jd.brief !== undefined && hasPlaceholder(jd.brief)))
      .map((jd) => `job ad ${jd.id}`),
  ];
  return left.length === 0
    ? { name: "placeholders", status: "ok", detail: "no field left to fill in" }
    : { name: "placeholders", status: "fail", detail: `still marked « ${PLACEHOLDER_MARKER} »: ${left.join(" · ")}` };
};

const corpusCheck = (m: Manifest): Check => {
  const targets = m.jobDescriptions.filter((j) => j.role === "target").length;
  const controls = m.jobDescriptions.filter((j) => j.role === "control").length;
  const detail = `${targets} target JD(s), ${controls} control(s)`;
  const placeholders = m.jobDescriptions.filter((j) => PLACEHOLDER.test(j.text)).map((j) => j.id);
  const short = m.jobDescriptions.filter((j) => !PLACEHOLDER.test(j.text) && j.text.trim().length < MIN_JD_CHARS).map((j) => j.id);
  const seen = new Map<string, string>();
  const duplicates = m.jobDescriptions.flatMap((j) => {
    const key = normaliseJd(j.text);
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, j.id);
      return [];
    }
    return [`${j.id}=${first}`];
  });
  if (placeholders.length > 0 || short.length > 0 || duplicates.length > 0) {
    const problems = [
      placeholders.length > 0 ? `not collected yet: ${placeholders.join(", ")}` : "",
      short.length > 0 ? `shorter than ${MIN_JD_CHARS} characters: ${short.join(", ")}` : "",
      duplicates.length > 0 ? `duplicated: ${duplicates.join(", ")}` : "",
    ].filter(Boolean);
    return { name: "corpus", status: "fail", detail: `${detail} — ${problems.join(" · ")}` };
  }
  // Un audit client ne porte pas le même corpus que la vague de référence : 3 offres du client et 1 témoin, contre
  // 10 + 3. Comparer aux mauvais seuils ferait sonner cet avertissement à chaque client — et un avertissement qui
  // sonne toujours cesse d'être lu. La vague se reconnaît à l'origine de ses offres cibles.
  const clientAudit = m.jobDescriptions.some((j) => j.role === "target" && j.source === "client");
  const wantedTargets = clientAudit ? AUDIT_TARGETS : MIN_TARGETS;
  const wantedControls = clientAudit ? AUDIT_CONTROLS : MIN_CONTROLS;
  const shape = clientAudit ? "client audit" : "reference protocol";
  return targets >= wantedTargets && controls >= wantedControls
    ? { name: "corpus", status: "ok", detail: `${detail}, real texts (${shape})` }
    : { name: "corpus", status: "warn", detail: `${detail} — ${shape} asks for ${wantedTargets} + ${wantedControls}` };
};

const budgetCheck = (m: Manifest, draws: number, worst: number): Check => {
  const detail = `${draws} draws, worst case ${worst.toFixed(2)} $, hard cap ${m.costCapUsd} $`;
  return worst <= m.costCapUsd
    ? { name: "budget", status: "ok", detail }
    : { name: "budget", status: "warn", detail: `${detail} — the wave would stop at the cap before the end (incomplete wave: SoRV not publishable)` };
};

export const preflight = (input: PreflightInput): PreflightReport => {
  const { manifest: m, identity, env, waveExists, now, surfaceCheck: surfaceCheckRecord } = input;
  const draws = m.engines.length * m.jobDescriptions.length * m.prompts.length * m.drawsPerCell;
  const perDraw = m.engines.reduce((a, e) => a + WORST_CASE_DRAW_USD[e], 0) / m.engines.length + EXTRACTOR_COST_ESTIMATE_USD;
  const worstCaseUsd = draws * perDraw;
  const checks: Check[] = [
    frozenCheck(m, now),
    keysCheck(m, env),
    encryptionCheck(env),
    proofCheck(identity),
    surfaceCheck(identity, surfaceCheckRecord, now),
    corpusCheck(m),
    placeholderCheck(m, identity),
    jdLeakCheck(m, identity),
    budgetCheck(m, draws, worstCaseUsd),
    waveExists
      ? { name: "wave folder", status: "warn", detail: `runs/${m.waveId} already exists: the run resumes it and keeps the finished draws` }
      : { name: "wave folder", status: "ok", detail: `runs/${m.waveId} is new` },
  ];
  return { checks, draws, worstCaseUsd, go: checks.every((c) => c.status !== "fail") };
};
