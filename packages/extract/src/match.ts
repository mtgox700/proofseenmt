import { normalizeText, verifiedUrls, type EngineAnswer, type Identity } from "@proofseen/core";
import type { Candidate } from "./candidates";
import { isClientUrl } from "./urls";

export interface ClientMatch {
  readonly type: "certain" | "probable";
  readonly rank: number;
  readonly clientUrlCited: boolean;
  readonly needsReview: boolean;
}

export interface MatchOutcome {
  readonly retrieved: boolean;
  readonly named: boolean;
  readonly top5: boolean;
  readonly cited: boolean;
  readonly match: ClientMatch | null;
}

const NO_OUTCOME: MatchOutcome = { retrieved: false, named: false, top5: false, cited: false, match: null };
const CONTEXT_WINDOW = 200;

const containsWord = (haystack: string, word: string): boolean => {
  const needle = normalizeText(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return needle.length > 0 && new RegExp(`(^|[^\\p{L}\\p{N}])${needle}($|[^\\p{L}\\p{N}])`, "u").test(haystack);
};

const hasAttribute = (context: string, identity: Identity): boolean =>
  [identity.city, ...identity.stack].some((attr) => containsWord(context, attr));

const isNameVariant = (name: string, identity: Identity): boolean =>
  identity.nameVariants.some((v) => normalizeText(v) === normalizeText(name));

export interface MatchInput {
  readonly answer: EngineAnswer;
  readonly candidates: readonly Candidate[];
  readonly identity: Identity;
}

/**
 * Runs in memory, BEFORE masking (REQ-M2-02). Certain = a verified URL; probable = a name variant
 * plus the client's city or stack near the mention (flagged for manual review, excluded from the north star).
 */
export const matchClient = ({ answer, candidates, identity }: MatchInput): MatchOutcome => {
  if (verifiedUrls(identity).length === 0) return NO_OUTCOME;

  const isClient = (url: string): boolean => isClientUrl(url, identity);
  const cited = answer.citations.some((c) => isClient(c.url));
  const retrieved = cited || answer.searchResults.some((r) => isClient(r.url));
  const text = normalizeText(answer.text);

  const certainIndex = candidates.findIndex((c) => c.urls.some(isClient));
  const probableIndex = candidates.findIndex(
    (c) =>
      isNameVariant(c.name, identity) &&
      hasAttribute(text.slice(Math.max(0, c.position - CONTEXT_WINDOW), c.position + CONTEXT_WINDOW), identity),
  );
  const index = certainIndex >= 0 ? certainIndex : probableIndex;
  if (index < 0) return { retrieved, named: false, top5: false, cited, match: null };

  const rank = index + 1;
  const certain = certainIndex >= 0;
  return {
    retrieved,
    named: true,
    top5: rank <= 5,
    cited,
    match: { type: certain ? "certain" : "probable", rank, clientUrlCited: cited, needsReview: !certain },
  };
};
