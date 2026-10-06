import type { EngineAnswer, Identity } from "@proofseen/core";
import type { Candidate } from "./candidates";
import { matchClient } from "./match";
import { rescoreMasked } from "./rescore";

/*
 * Several "identities" read from ONE answer: the arms of the three-arm test (PIVOT_ANONYME §5) — A named, B pseudonymous,
 * C the entry page. The expensive step (the extractor LLM) runs once per answer; matching runs once per arm.
 *
 * Every arm gets an outcome for every draw, negatives included: the verdict needs explicit denominators, and an entry
 * page cited as a SOURCE (no person attached) must still count — `matches.jsonl` only records recognised persons.
 */

export interface ArmOutcome {
  readonly armId: string;
  /** One of the arm's URLs appears among the search results or the citations. */
  readonly retrieved: boolean;
  /** One of the arm's URLs is cited as a source. */
  readonly cited: boolean;
  /** A person recognised as the arm: "certain" through a verified URL, "probable" through the name alone. */
  readonly type: "certain" | "probable" | null;
  readonly rank: number | null;
  readonly needsReview: boolean;
}

/** Masking must keep the names of every arm: they are our own consenting subject, not third parties. */
export const maskingIdentity = (primary: Identity, arms: readonly Identity[]): Identity => ({
  ...primary,
  nameVariants: [...new Set([primary, ...arms].flatMap((arm) => arm.nameVariants))],
});

/** Same conservative rule as the single-identity pipeline: the worse of the extractor's rank and the re-score's. */
export const armOutcomes = (answer: EngineAnswer, candidates: readonly Candidate[], maskedText: string, arms: readonly Identity[]): ArmOutcome[] =>
  arms.map((arm) => {
    const outcome = matchClient({ answer, candidates, identity: arm });
    const check = rescoreMasked(maskedText, arm);
    const match = outcome.match;
    const rank = match === null ? null : check.rank === null ? match.rank : Math.max(match.rank, check.rank);
    return {
      armId: arm.id,
      retrieved: outcome.retrieved,
      cited: outcome.cited,
      type: match?.type ?? null,
      rank,
      needsReview: match === null ? false : match.needsReview || (check.rank !== null && check.rank !== match.rank),
    };
  });
