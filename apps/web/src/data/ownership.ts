import type { Actor, OwnedUrls } from "@proofseen/db";
import { defaultProbe, proveOwnership, type EvidenceProbe } from "@proofseen/profiles";
import { logError } from "../lib/log";

/*
 * Ownership proofs, from the web app: the freelancer's "check now", and the scheduled recheck of proven addresses. The
 * evidence is read through the hardened fetcher of `@proofseen/profiles` (https only, internal addresses refused at
 * connection time, bounded body); LinkedIn and Malt are never contacted. The token is bound to the profile id and the
 * address, so a token published for one profile proves nothing for another.
 */

/** A scheduled run rereads a few addresses at a time: each one costs up to three requests to someone else's site. */
const RECHECK_CONCURRENCY = 5;
/** Shorter than the interactive timeout: a scheduled run must not hang on one slow site. */
const RECHECK_TIMEOUT_MS = 5_000;

export type VerifyOutcome = "proven" | "absent" | "not_found" | "manual_only" | "already_proven_elsewhere";

/** Looks for the token behind one of the actor's own addresses, and records the proof when it is there. */
export const verifyOwnedUrl = async (
  repo: Pick<OwnedUrls, "get" | "markVerified">,
  actor: Actor,
  id: string,
  secret: string,
  now: Date,
  probe: EvidenceProbe = defaultProbe(),
): Promise<VerifyOutcome> => {
  const record = await repo.get(actor, id);
  if (record === null) return "not_found";
  if (record.proofMethod === "profile_token") return "manual_only";
  const outcome = await proveOwnership({ secret, identityId: record.profileId, url: record.url }, probe);
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
}

type Tally = Omit<RecheckReport, "checked">;
type Step = keyof Tally;

const recheckOne = async (repo: Pick<OwnedUrls, "recordRecheck">, proof: { readonly id: string; readonly profileId: string; readonly url: string }, secret: string, now: Date, probe: EvidenceProbe): Promise<Step> => {
  try {
    const outcome = await proveOwnership({ secret, identityId: proof.profileId, url: proof.url }, probe);
    const result = await repo.recordRecheck(proof.id, outcome.kind === "proven" ? outcome.method : null, now);
    return result ?? "failed";
  } catch (error) {
    // Nothing is recorded: the address stays due and is retried on the next run.
    logError("proofs: recheck failed", error);
    return "failed";
  }
};

/** Rereads the proofs that are due (bounded by the repository), a few in parallel; returns what happened to them. */
export const recheckProofs = async (
  repo: Pick<OwnedUrls, "dueForRecheck" | "recordRecheck">,
  secret: string,
  now: Date,
  probe: EvidenceProbe = defaultProbe(RECHECK_TIMEOUT_MS),
): Promise<RecheckReport> => {
  const due = await repo.dueForRecheck(now);
  const steps: Step[] = [];
  for (let start = 0; start < due.length; start += RECHECK_CONCURRENCY) {
    const chunk = due.slice(start, start + RECHECK_CONCURRENCY);
    steps.push(...(await Promise.all(chunk.map((proof) => recheckOne(repo, proof, secret, now, probe)))));
  }
  const count = (step: Step): number => steps.filter((s) => s === step).length;
  return { checked: due.length, confirmed: count("confirmed"), grace: count("grace"), revoked: count("revoked"), failed: count("failed") };
};
