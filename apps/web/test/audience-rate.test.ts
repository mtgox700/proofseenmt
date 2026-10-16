import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIENCE_RATE, audienceWriteAllowed } from "../src/data/audience-rate";

/*
 * Audience counting writes at most AUDIENCE_RATE.max times a minute per address (wave-3 review, M4): a script that
 * reloads a profile, or rotates its browser string, cannot turn each request into a database write. Without a database
 * the throttle counts in memory, as here.
 */

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("audience write rate", () => {
  it("lets an address write AUDIENCE_RATE.max times a minute, then stops it, and lets another address through", async () => {
    const now = new Date("2026-10-15T10:00:00Z");
    const from = (address: string) => new Headers({ "x-real-ip": address });
    const outcomes = [];
    for (let i = 0; i < AUDIENCE_RATE.max + 2; i += 1) outcomes.push(await audienceWriteAllowed(from("198.51.100.20"), now));
    expect(outcomes.filter(Boolean)).toHaveLength(AUDIENCE_RATE.max);
    expect(outcomes.at(-1)).toBe(false);
    expect(await audienceWriteAllowed(from("198.51.100.21"), now)).toBe(true);
    expect(await audienceWriteAllowed(from("198.51.100.20"), new Date(now.getTime() + AUDIENCE_RATE.windowMs + 1))).toBe(true);
    expect(AUDIENCE_RATE).toEqual({ windowMs: 60_000, max: 30 });
  });
});
