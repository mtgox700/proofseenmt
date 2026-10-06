import { describe, expect, it } from "vitest";
import { maskThirdParties } from "../src/mask";
import { parseExtractorOutput } from "../src/candidates";
import { rescoreMasked } from "../src/rescore";
import { answer, answerText, extractorJson, identity } from "./fixtures";

describe("rescoreMasked", () => {
  it("recovers the same rank as the LLM extractor from the masked text", () => {
    const masked = maskThirdParties(answerText, parseExtractorOutput(extractorJson, answer), identity);
    expect(rescoreMasked(masked, identity)).toEqual({ named: true, rank: 3, type: "certain" });
  });

  it("falls back to a probable match on name plus attribute", () => {
    expect(rescoreMasked("1. [PERSON_1]\n2. A. Hammoudi, TypeScript, Paris", identity)).toEqual({ named: true, rank: 2, type: "probable" });
  });

  it("counts competitors cited earlier on the same line (answers written as prose)", () => {
    const prose = "Nous recommandons [PERSON_1], [PERSON_2], puis Ayoub Hammoudi (https://ayoub-hammoudi.dev/).";
    expect(rescoreMasked(prose, identity)).toEqual({ named: true, rank: 3, type: "certain" });
  });

  it("reports nothing when the client is absent or unverified", () => {
    expect(rescoreMasked("1. [PERSON_1]", identity)).toEqual({ named: false, rank: null, type: null });
    const unverified = { ...identity, ownedUrls: identity.ownedUrls.map((u) => ({ ...u, verifiedAt: null })) };
    expect(rescoreMasked("https://ayoub-hammoudi.dev/", unverified)).toEqual({ named: false, rank: null, type: null });
  });
});
