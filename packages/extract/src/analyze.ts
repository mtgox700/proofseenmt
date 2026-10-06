import { createHash } from "node:crypto";
import type { CitedDomains, EngineAnswer, Identity } from "@proofseen/core";
import { buildExtractionPrompt, parseExtractorOutput, type Candidate } from "./candidates";
import { tallyCitedDomains } from "./domains";
import { maskThirdParties } from "./mask";
import { matchClient, type MatchOutcome } from "./match";
import { rescoreMasked, type Rescore } from "./rescore";
import { applyJudge } from "./judge";
import { armOutcomes, maskingIdentity, type ArmOutcome } from "./arms";
import { refusesToName } from "./refusal";

/** Tool-less LLM completion used for extraction; injected so this package never touches the network. */
export type ExtractFn = (prompt: string) => Promise<string>;

export interface AnalyzeInput {
  readonly answer: EngineAnswer;
  readonly identity: Identity;
  readonly extract: ExtractFn;
  /** Optional tool-free judge for name-only (probable) matches — off by default in V0. */
  readonly judge?: ExtractFn | undefined;
  /** Three-arm test: every arm is matched against the same answer, the extractor still runs once. */
  readonly arms?: readonly Identity[] | undefined;
}

const EXCERPT_WINDOW = 200;

/** Raw text around the client's first name mention: the only context given to the judge. */
export const excerptAround = (text: string, identity: Identity): string => {
  const lower = text.toLowerCase();
  const positions = identity.nameVariants.map((v) => lower.indexOf(v.toLowerCase())).filter((p) => p >= 0);
  if (positions.length === 0) return text.slice(0, EXCERPT_WINDOW * 2);
  const at = Math.min(...positions);
  return text.slice(Math.max(0, at - EXCERPT_WINDOW), at + EXCERPT_WINDOW);
};

export interface AnalyzeResult {
  readonly outcome: MatchOutcome;
  /** Pseudonymised text: the only form of the answer that may be written (encrypted) to disk. */
  readonly maskedText: string;
  readonly citedDomains: CitedDomains;
  readonly responseHash: string;
  readonly extractionFailed: boolean;
  /** Error class only (e.g. "ExtractionError", "EngineHttpError") — never a message, which could quote the answer. */
  readonly extractionError: string | null;
  /**
   * Refus de nommer quiconque. `null` quand l'extraction a échoué : un refus ne s'y distingue pas d'une liste non
   * analysée, et un refus inventé retirerait des tirages du dénominateur du client.
   */
  readonly refusedToName: boolean | null;
  /** One outcome per arm, negatives included. Empty when the wave has no arms. */
  readonly arms: readonly ArmOutcome[];
}

/**
 * The extractor is an LLM and could be steered by an injected instruction to drop competitors and improve the
 * client's rank. The deterministic re-score (masked person tokens before the client) cannot be steered that way:
 * we keep the WORSE of the two ranks and flag any disagreement for manual review.
 */
export const conservativeRank = (outcome: MatchOutcome, check: Rescore): MatchOutcome => {
  if (outcome.match === null || check.rank === null || check.rank === outcome.match.rank) return outcome;
  const rank = Math.max(outcome.match.rank, check.rank);
  return { ...outcome, top5: rank <= 5, match: { ...outcome.match, rank, needsReview: true } };
};

/** Whole in-memory pipeline for one draw: extract → match (in memory) → mask → cross-check rank → tally. */
export const analyzeAnswer = async ({ answer, identity, extract, judge, arms = [] }: AnalyzeInput): Promise<AnalyzeResult> => {
  let candidates: Candidate[] = [];
  let extractionError: string | null = null;
  try {
    candidates = parseExtractorOutput(await extract(buildExtractionPrompt(answer.text)), answer);
  } catch (error) {
    extractionError = error instanceof Error ? error.name.slice(0, 80) : "UnknownError";
  }
  const extractionFailed = extractionError !== null;
  const maskedText = maskThirdParties(answer.text, candidates, arms.length === 0 ? identity : maskingIdentity(identity, arms));
  const ranked = conservativeRank(matchClient({ answer, candidates, identity }), rescoreMasked(maskedText, identity));
  // The judge only ever sees the MASKED excerpt: third-party names never leave the process (minimisation).
  const outcome = judge === undefined ? ranked : await applyJudge(ranked, excerptAround(maskedText, identity), identity, judge);
  return {
    outcome,
    maskedText,
    citedDomains: tallyCitedDomains(answer.citations.map((c) => c.url), identity),
    responseHash: createHash("sha256").update(maskedText).digest("hex"),
    extractionFailed,
    extractionError,
    refusedToName: extractionFailed ? null : refusesToName({ text: answer.text, namedCandidates: candidates.length }),
    arms: armOutcomes(answer, candidates, maskedText, arms),
  };
};
