import type { Actor, OwnedUrls } from "@proofseen/db";
import { defaultProbe, proveOwnership, type EvidenceProbe } from "@proofseen/profiles";
import { logError } from "../lib/log";

/*
 * Ownership proofs, from the web app: the freelancer's "check now", and the scheduled recheck of proven addresses. The
 * evidence is read through the hardened fetcher of `@proofseen/profiles` (https only, internal addresses refused at
 * connection time, bounded body and total time); LinkedIn and Malt are never contacted. The token is bound to the
 * profile id and the address, so a token published for one profile proves nothing for another.
 *
 * Wall-clock bounds on top of the fetcher's: DNS lookups and anything else in the chain have none of their own. A check
 * that outlives its bound is abandoned and records nothing, so one hostile site never holds a request or the scheduled
 * run. The whole recheck step also has a budget; the proofs it leaves are due again on the next run.
 */

/** A scheduled run rereads a few addresses at a time: each one costs up to three requests to someone else's site. */
const RECHECK_CONCURRENCY = 5;
/** Shorter than the interactive timeout: a scheduled run must not hang on one slow site. */
const RECHECK_TIMEOUT_MS = 5_000;
export const VERIFY_DEADLINE_MS = 10_000;
export const RECHECK_DEADLINE_MS = 12_000;
export const RECHECK_BUDGET_MS = 60_000;

const TIMED_OUT = Symbol("timed out");

/** The promise's value, or `TIMED_OUT` once `ms` have passed; the timer never outlives the race. */
const within = async <T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), Math.max(0, ms));
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
};

export type VerifyOutcome = "proven" | "absent" | "not_found" | "manual_only" | "already_proven_elsewhere";

/** Looks for the token behind one of the actor's own addresses, and records the proof when it is there. */
export const verifyOwnedUrl = async (
  repo: Pick<OwnedUrls, "get" | "markVerified">,
  actor: Actor,
  id: string,
  secret: string,
  now: Date,
  probe: EvidenceProbe = defaultProbe(),
  limits: { readonly deadlineMs: number } = { deadlineMs: VERIFY_DEADLINE_MS },
): Promise<VerifyOutcome> => {
  const record = await repo.get(actor, id);
  if (record === null) return "not_found";
  if (record.proofMethod === "profile_token") return "manual_only";
  const outcome = await within(proveOwnership({ secret, identityId: record.profileId, url: record.url }, probe), limits.deadlineMs);
  // A site that does not answer in time has not shown the token: same answer as an absent one, nothing recorded.
  if (outcome === TIMED_OUT) return "absent";
  if (outcome.kind === "manual_only") return "manual_only";
  if (outcome.kind === "not_found") return "absent";
  const marked = await repo.markVerified(actor, id, outcome.method, now);
  return marked.kind === "verified" ? "proven" : marked.kind;
};

export interface RecheckReport {
  readonly checked: number;
  readonly confirmed: number;
  readonly grace: number;
  readonly revoked: number;
  readonly failed: number;
  /** Due proofs left for the next run because the step ran out of budget. */
  readonly deferred: number;
}

export interface RecheckLimits {
  readonly perCheckMs: number;
  readonly budgetMs: number;
}

type Tally = Omit<RecheckReport, "checked" | "deferred">;
type Step = keyof Tally;

const recheckOne = async (
  repo: Pick<OwnedUrls, "recordRecheck">,
  proof: { readonly id: string; readonly profileId: string; readonly url: string },
  secret: string,
  now: Date,
  probe: EvidenceProbe,
  deadlineMs: number,
): Promise<Step> => {
  try {
    const outcome = await within(proveOwnership({ secret, identityId: proof.profileId, url: proof.url }, probe), deadlineMs);
    // Cut short: nothing is recorded, so a slow site neither confirms its proof nor uses up its grace period.
    if (outcome === TIMED_OUT) return "failed";
    const result = await repo.recordRecheck(proof.id, outcome.kind === "proven" ? outcome.method : null, now);
    return result ?? "failed";
  } catch (error) {
    // Nothing is recorded: the address stays due and is retried on the next run.
    logError("proofs: recheck failed", error);
    return "failed";
  }
};

/**
 * Rereads the proofs that are due (bounded by the repository), a few in parallel, each within its own deadline and all
 * within the step's budget; returns what happened to them.
 */
export const recheckProofs = async (
  repo: Pick<OwnedUrls, "dueForRecheck" | "recordRecheck">,
  secret: string,
  now: Date,
  probe: EvidenceProbe = defaultProbe(RECHECK_TIMEOUT_MS),
  limits: RecheckLimits = { perCheckMs: RECHECK_DEADLINE_MS, budgetMs: RECHECK_BUDGET_MS },
): Promise<RecheckReport> => {
  const due = await repo.dueForRecheck(now);
  const stopAt = Date.now() + limits.budgetMs;
  const steps: Step[] = [];
  for (let start = 0; start < due.length; start += RECHECK_CONCURRENCY) {
    const left = stopAt - Date.now();
    if (left <= 0) break;
    const chunk = due.slice(start, start + RECHECK_CONCURRENCY);
    const deadlineMs = Math.min(limits.perCheckMs, left);
    steps.push(...(await Promise.all(chunk.map((proof) => recheckOne(repo, proof, secret, now, probe, deadlineMs)))));
  }
  const count = (step: Step): number => steps.filter((s) => s === step).length;
  return {
    checked: steps.length,
    confirmed: count("confirmed"),
    grace: count("grace"),
    revoked: count("revoked"),
    failed: count("failed"),
    deferred: due.length - steps.length,
  };
};
