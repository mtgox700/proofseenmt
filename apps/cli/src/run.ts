import {
  assertJdFreeOfIdentity,
  renderPrompt,
  sanitizeJobDescription,
  type EngineId,
  type Identity,
  type JobDescription,
  type Manifest,
  type PromptTemplate,
} from "@proofseen/core";
import { assertCanSpend, BudgetExceededError, charge, createBudget, WORST_CASE_DRAW_USD, type BudgetState, type EngineAdapter } from "@proofseen/engines";
import { analyzeAnswer, writeSealed, type ExtractFn } from "@proofseen/extract";
import { appendJsonl, CliError, readJsonl, wavePaths, writeText } from "./files";
import { drawIdFor, StoredDrawSchema, type StoredDraw, type WaveMeta } from "./records";

/** Estimated cost of one tool-free extraction call (Haiku, ~3k in / ~400 out) — HYPOTHESIS, refined after J0. */
export const EXTRACTOR_COST_ESTIMATE_USD = 0.006;

export interface RunOptions {
  readonly manifest: Manifest;
  readonly manifestSha256: string;
  readonly identity: Identity;
  readonly runsDir: string;
  readonly dryRun: boolean;
  readonly adapters: Readonly<Partial<Record<EngineId, EngineAdapter>>>;
  readonly extract: ExtractFn;
  /** Optional judge for name-only matches (--judge); rare calls, cost folded into the extractor estimate. */
  readonly judge?: ExtractFn | undefined;
  readonly key: Buffer;
  readonly now: () => Date;
  readonly log: (message: string) => void;
}

interface Step {
  readonly jd: JobDescription;
  readonly prompt: PromptTemplate;
  readonly index: number;
}

const planSteps = (m: Manifest): Step[] =>
  m.jobDescriptions.flatMap((jd) =>
    m.prompts.flatMap((prompt) => Array.from({ length: m.drawsPerCell }, (_, index) => ({ jd, prompt, index }))),
  );

/** Anti-inflation (REVUE #7): no JD may contain the client's identity. */
const assertManifestSafe = (m: Manifest, identity: Identity): void => {
  m.jobDescriptions.forEach((jd) => {
    try {
      assertJdFreeOfIdentity(jd.text, identity);
      if (jd.brief !== undefined) assertJdFreeOfIdentity(jd.brief, identity);
    } catch (error) {
      throw new CliError(`job description ${jd.id}: ${(error as Error).message}`);
    }
  });
};

const errorCode = (error: unknown): string => {
  if (error instanceof Error) {
    const status = "status" in error && typeof error.status === "number" ? `:${error.status}` : "";
    return `${error.name}${status}`.slice(0, 80);
  }
  return "UnknownError";
};

const runOne = async (opts: RunOptions, step: Step, engine: EngineId, adapter: EngineAdapter): Promise<{ record: StoredDraw; costUsd: number }> => {
  const paths = wavePaths(opts.runsDir, opts.manifest.waveId);
  const id = drawIdFor(opts.manifest.waveId, engine, step.jd.id, step.prompt.id, step.index);
  const base = {
    id,
    waveId: opts.manifest.waveId,
    engine,
    promptId: step.prompt.id,
    jdId: step.jd.id,
    jdRole: step.jd.role,
    jdSource: step.jd.source,
    drawIndex: step.index,
    timestamp: opts.now().toISOString(),
  };
  const prompt = renderPrompt(step.prompt, { jd: sanitizeJobDescription(step.jd.text), brief: step.jd.brief });
  try {
    const answer = await adapter.runDraw(prompt);
    const analysis = await analyzeAnswer({ answer, identity: opts.identity, extract: opts.extract, judge: opts.judge });
    await writeSealed(paths.sealed, id, analysis.maskedText, opts.key, opts.now());
    if (analysis.outcome.match !== null) {
      await appendJsonl(paths.matches, { drawId: id, identityId: opts.identity.id, ...analysis.outcome.match });
    }
    const costUsd = answer.costUsd + (opts.dryRun ? 0 : EXTRACTOR_COST_ESTIMATE_USD);
    const record = StoredDrawSchema.parse({
      ...base,
      model: answer.model,
      costUsd,
      status: "ok",
      errorCode: null,
      responseHash: analysis.responseHash,
      retrieved: analysis.outcome.retrieved,
      citedDomains: analysis.citedDomains,
      extractionFailed: analysis.extractionFailed,
      extractionError: analysis.extractionError,
    });
    return { record, costUsd };
  } catch (error) {
    const record = StoredDrawSchema.parse({
      ...base,
      model: opts.manifest.models[engine] ?? "unknown",
      costUsd: 0,
      status: "error",
      errorCode: errorCode(error),
      responseHash: null,
      retrieved: false,
      citedDomains: { platform: {}, client: 0, other: 0 },
      extractionFailed: false,
      extractionError: null,
    });
    return { record, costUsd: 0 };
  }
};

const writeMeta = (opts: RunOptions, meta: WaveMeta): Promise<void> =>
  writeText(wavePaths(opts.runsDir, opts.manifest.waveId).wave, `${JSON.stringify(meta, null, 2)}\n`);

/** Runs (or resumes) a wave: engines in parallel per step, analysis in memory, masked text sealed, hard budget stop. */
export const runWave = async (opts: RunOptions): Promise<WaveMeta> => {
  assertManifestSafe(opts.manifest, opts.identity);
  const paths = wavePaths(opts.runsDir, opts.manifest.waveId);
  const existing = await readJsonl(paths.draws, StoredDrawSchema);
  const done = new Set(existing.map((d) => d.id));
  let budget: BudgetState = charge(createBudget(opts.manifest.costCapUsd), existing.reduce((a, d) => a + d.costUsd, 0));
  let drawCount = existing.length;
  let errorCount = existing.filter((d) => d.status === "error").length;
  let stoppedReason: string | null = null;
  const startedAt = opts.now().toISOString();
  const meta = (finishedAt: string | null): WaveMeta => ({
    waveId: opts.manifest.waveId,
    dryRun: opts.dryRun,
    manifestSha256: opts.manifestSha256,
    startedAt,
    finishedAt,
    spentUsd: Math.round(budget.spentUsd * 1e6) / 1e6,
    draws: drawCount,
    errors: errorCount,
    stoppedReason,
  });
  await writeMeta(opts, meta(null));

  for (const step of planSteps(opts.manifest)) {
    const pending = opts.manifest.engines.filter(
      (e) => !done.has(drawIdFor(opts.manifest.waveId, e, step.jd.id, step.prompt.id, step.index)),
    );
    if (pending.length === 0) continue;
    const worstCase = pending.reduce((a, e) => a + WORST_CASE_DRAW_USD[e] + EXTRACTOR_COST_ESTIMATE_USD, 0);
    try {
      assertCanSpend(budget, worstCase);
    } catch (error) {
      if (!(error instanceof BudgetExceededError)) throw error;
      stoppedReason = error.message;
      opts.log(`STOP: ${error.message}`);
      break;
    }
    const results = await Promise.all(
      pending.map((engine) => {
        const adapter = opts.adapters[engine];
        if (adapter === undefined) throw new CliError(`no adapter configured for ${engine}`);
        return runOne(opts, step, engine, adapter);
      }),
    );
    for (const { record, costUsd } of results) {
      await appendJsonl(paths.draws, record);
      budget = charge(budget, costUsd);
      drawCount += 1;
      if (record.status === "error") errorCount += 1;
    }
    opts.log(`${step.jd.id} ${step.prompt.id} #${step.index} — ${drawCount} draws, ${budget.spentUsd.toFixed(3)} $`);
  }

  const final = meta(opts.now().toISOString());
  await writeMeta(opts, final);
  return final;
};
