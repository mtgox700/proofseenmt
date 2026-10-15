import { describe, expect, it } from "vitest";
import { ARTICLE_CACHE_CONTROL } from "../src/lib/article-cache";
import { safeDecode } from "../src/lib/safe-decode";

/*
 * Public pages addressed by a path segment (wave-2 review, L4 and L5): a malformed escape is an address that does not
 * exist (404), never a server error; an article taken offline leaves shared caches within minutes.
 */

describe("decoding a path segment", () => {
  it("decodes a well-formed segment", () => {
    expect(safeDecode("saint-%C3%A9tienne")).toBe("saint-étienne");
    expect(safeDecode("acme")).toBe("acme");
  });

  it("answers null for a malformed escape instead of throwing", () => {
    for (const malformed of ["%", "%E0%A4%A", "acme%zz", "%C3"]) expect(safeDecode(malformed)).toBeNull();
  });
});

describe("article cache", () => {
  it("lets an unpublished article leave shared caches within minutes", () => {
    expect(ARTICLE_CACHE_CONTROL).toBe("public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  });
});
