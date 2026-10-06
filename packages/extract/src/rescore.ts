import { normalizeText, verifiedUrls, type Identity } from "@proofseen/core";
import { isClientUrl } from "./urls";

export interface Rescore {
  readonly named: boolean;
  readonly rank: number | null;
  readonly type: "certain" | "probable" | null;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s)>\]"'<]+/g;
const PERSON_TOKEN = /\[person_(\d+)\]/g;
const WINDOW = 200;

/** Like normalizeText but keeps line breaks, which the rank computation needs. */
const normalizeKeepingLines = (value: string): string =>
  value
    .split("\n")
    .map((line) => normalizeText(line))
    .join("\n");

const firstClientUrl = (text: string, identity: Identity): number => {
  const hit = [...text.matchAll(URL_PATTERN)].find((m) => isClientUrl(m[0], identity));
  return hit?.index ?? -1;
};

const hasAttribute = (context: string, identity: Identity): boolean =>
  [identity.city, ...identity.stack].map(normalizeText).some((attr) => attr.length > 0 && context.includes(attr));

const firstProbableName = (text: string, identity: Identity): number => {
  const positions = identity.nameVariants
    .map((v) => text.indexOf(normalizeText(v)))
    .filter((p) => p >= 0 && hasAttribute(text.slice(Math.max(0, p - WINDOW), p + WINDOW), identity));
  return positions.length === 0 ? -1 : Math.min(...positions);
};

/**
 * Deterministic re-scoring of a sealed, already-masked answer (sim-extract): no LLM, no third-party name.
 * Rank = 1 + number of distinct masked persons appearing before the client. Used to cross-check the LLM extractor.
 */
export const rescoreMasked = (maskedText: string, identity: Identity): Rescore => {
  if (verifiedUrls(identity).length === 0) return { named: false, rank: null, type: null };
  const text = normalizeKeepingLines(maskedText);
  const certainAt = firstClientUrl(text, identity);
  const probableAt = firstProbableName(text, identity);
  if (certainAt < 0 && probableAt < 0) return { named: false, rank: null, type: null };

  // The client is "mentioned" at its first name variant or verified URL, whichever comes first.
  const namePositions = identity.nameVariants.map((v) => text.indexOf(normalizeText(v))).filter((p) => p >= 0);
  const mentionAt = Math.min(...[certainAt, ...namePositions].filter((p) => p >= 0));
  const before = new Set([...text.slice(0, mentionAt).matchAll(PERSON_TOKEN)].map((m) => m[1]));
  return { named: true, rank: before.size + 1, type: certainAt >= 0 ? "certain" : "probable" };
};
