import { describe, expect, it } from "vitest";
import { audienceSecret, isAutomatedAgent, isSpeculative, viewerHash } from "../src/lib/audience";

/*
 * Who counts as a visitor, and what is kept of them: a one-day fingerprint that never contains the address and links
 * nothing from one day to the next.
 */

const SECRET = "s".repeat(40);
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("isAutomatedAgent", () => {
  it("lets browsers through", () => {
    expect(isAutomatedAgent(CHROME)).toBe(false);
    expect(isAutomatedAgent(SAFARI)).toBe(false);
  });

  it("excludes the AI and search crawlers, generic bots, scripts and an empty agent", () => {
    for (const agent of [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "Claude-User/1.0",
      "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Chrome-Lighthouse",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "curl/8.4.0",
      "python-requests/2.32.3",
      "Go-http-client/2.0",
      "",
      null,
    ]) {
      expect(isAutomatedAgent(agent), String(agent)).toBe(true);
    }
  });
});

describe("isSpeculative", () => {
  it("does not count a prefetch or a prerender", () => {
    expect(isSpeculative(new Headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isSpeculative(new Headers({ purpose: "prefetch" }))).toBe(true);
    expect(isSpeculative(new Headers({ "user-agent": CHROME }))).toBe(false);
  });
});

describe("viewerHash", () => {
  it("is stable within a day, differs across days, browsers and addresses", () => {
    const today = viewerHash(SECRET, "2026-10-15", "203.0.113.7", CHROME);
    expect(viewerHash(SECRET, "2026-10-15", "203.0.113.7", CHROME)).toBe(today);
    expect(viewerHash(SECRET, "2026-10-16", "203.0.113.7", CHROME)).not.toBe(today);
    expect(viewerHash(SECRET, "2026-10-15", "203.0.113.8", CHROME)).not.toBe(today);
    expect(viewerHash(SECRET, "2026-10-15", "203.0.113.7", SAFARI)).not.toBe(today);
    expect(viewerHash(`${SECRET}x`, "2026-10-15", "203.0.113.7", CHROME)).not.toBe(today);
  });

  it("has the shape the database accepts, and never contains the address", () => {
    for (const address of ["203.0.113.7", "2001:db8::1", ""]) {
      const hash = viewerHash(SECRET, "2026-10-15", address, CHROME);
      expect(hash).toMatch(/^[A-Za-z0-9_-]{22}$/);
      if (address !== "") expect(hash).not.toContain(address);
    }
  });
});

describe("audienceSecret", () => {
  it("refuses a missing or short secret: counting stays off rather than hashing under a guessable key", () => {
    expect(audienceSecret({})).toBeNull();
    expect(audienceSecret({ PROOFSEEN_ACCESS_SECRET: "short" })).toBeNull();
    expect(audienceSecret({ PROOFSEEN_ACCESS_SECRET: SECRET })).toBe(SECRET);
  });
});
