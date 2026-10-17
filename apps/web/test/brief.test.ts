import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateProfileBrief, type BriefTranslate } from "../src/data/brief";

/*
 * The brief translation behind the company search page and the JSON route. A fake translator stands in for the model:
 * no paid call ever leaves a test. Without a database the throttle counts in memory, per test user.
 */

let user = 0;
const nextUser = (): string => {
  user += 1;
  return `brief-test-user-${user}-${Date.now()}`;
};

const fixed = (candidate: unknown): BriefTranslate => async () => ({ candidate });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("brief translation", () => {
  it("keeps only revalidated filters, never an order or a list of people", async () => {
    const outcome = await translateProfileBrief(nextUser(), "Un dev React à Lyon, 600 € max", {
      translate: fixed({ skills: ["React"], city: "Lyon", workModes: ["hybrid", "space"], maxDailyRateEuros: 600, availableOnly: true, sort: "rate_desc", people: ["FR-ABCDE"] }),
    });
    expect(outcome).toEqual({ kind: "ok", filters: { skills: ["React"], city: "Lyon", workModes: ["hybrid"], maxDailyRateCents: 60_000, availableOnly: true } });
  });

  it("turns the languages a sentence asks for into language filters, nothing more", async () => {
    const outcome = await translateProfileBrief(nextUser(), "Un dev Go, anglais courant, allemand B1", {
      translate: fixed({ skills: ["Go"], languages: [{ code: "en", minLevel: "c1" }, { code: "DE", minLevel: "B1" }, { code: "en", minLevel: "a1" }, { code: "xx", minLevel: "b2" }], score: 3 }),
    });
    expect(outcome).toEqual({
      kind: "ok",
      filters: { skills: ["Go"], workModes: [], availableOnly: false, languages: [{ code: "en", minLevel: "c1" }, { code: "de", minLevel: "b1" }] },
    });
  });

  it("refuses a sentence too short or too long before any call", async () => {
    const translate = vi.fn(fixed({ skills: [] }));
    expect(await translateProfileBrief(nextUser(), "Go", { translate })).toEqual({ kind: "invalid" });
    expect(await translateProfileBrief(nextUser(), "x".repeat(601), { translate })).toEqual({ kind: "invalid" });
    expect(await translateProfileBrief(nextUser(), 42, { translate })).toEqual({ kind: "invalid" });
    expect(translate).not.toHaveBeenCalled();
  });

  it("says when the answer is not filters, and when the model fails", async () => {
    expect(await translateProfileBrief(nextUser(), "Un développeur Go", { translate: fixed("pas un objet") })).toEqual({ kind: "not_understood" });
    const failing: BriefTranslate = async () => {
      throw new TypeError("fetch failed");
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await translateProfileBrief(nextUser(), "Un développeur Go", { translate: failing })).toEqual({ kind: "failed" });
  });

  it("is unavailable without a configured model", async () => {
    expect(await translateProfileBrief(nextUser(), "Un développeur Go")).toEqual({ kind: "unconfigured" });
  });

  it("limits each person to twenty translations an hour", async () => {
    const who = nextUser();
    const translate = vi.fn(fixed({ skills: ["Go"] }));
    for (let i = 0; i < 20; i += 1) expect((await translateProfileBrief(who, "Un développeur Go", { translate })).kind).toBe("ok");
    expect(await translateProfileBrief(who, "Un développeur Go", { translate })).toEqual({ kind: "throttled" });
    expect(translate).toHaveBeenCalledTimes(20);
  });
});
