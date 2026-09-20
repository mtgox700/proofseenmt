import { describe, expect, it } from "vitest";
import { MIN_DRAWS_TO_PUBLISH, botHits, discoverability, type Observation } from "../src";

const obs = (profileId: string, engine: string, queryId: string, cited: boolean, retrieved = cited): Observation => ({
  profileId,
  engine,
  queryId,
  cited,
  retrieved,
});

/** 12 draws for A (6 cited), 12 for B (0 cited), on two engines and two queries. */
const sample: Observation[] = [
  ...Array.from({ length: 6 }, (_, i) => obs("FR-AAAAA", i % 2 === 0 ? "openai" : "anthropic", i < 3 ? "Q1" : "Q2", true)),
  ...Array.from({ length: 6 }, (_, i) => obs("FR-AAAAA", i % 2 === 0 ? "openai" : "anthropic", i < 3 ? "Q1" : "Q2", false)),
  ...Array.from({ length: 12 }, (_, i) => obs("FR-BBBBB", i % 2 === 0 ? "openai" : "anthropic", i < 6 ? "Q1" : "Q2", false)),
];

describe("LLM Discoverability Rate", () => {
  it("gives a rate with its interval, never a bare number", () => {
    const report = discoverability(sample);
    const a = report.profiles.find((p) => p.profileId === "FR-AAAAA")!;
    expect(a.draws).toBe(12);
    expect(a.cited).toBe(6);
    expect(a.rate!.point).toBeCloseTo(0.5, 6);
    expect(a.rate!.low).toBeLessThan(0.5);
    expect(a.rate!.high).toBeGreaterThan(0.5);
    expect(a.publishable).toBe(true);
  });

  it("refuses to publish a rate computed on too few draws", () => {
    const thin = [obs("FR-CCCCC", "openai", "Q1", true), obs("FR-CCCCC", "openai", "Q1", false)];
    const profile = discoverability(thin).profiles[0]!;
    expect(MIN_DRAWS_TO_PUBLISH).toBeGreaterThanOrEqual(10);
    expect(profile.draws).toBe(2);
    expect(profile.publishable).toBe(false);
    expect(profile.rate).not.toBeNull();
    expect(profile.note).toMatch(/tirages/i);
  });

  it("says zero honestly: a profile never cited keeps an upper bound above zero", () => {
    const b = discoverability(sample).profiles.find((p) => p.profileId === "FR-BBBBB")!;
    expect(b.cited).toBe(0);
    expect(b.rate!.point).toBe(0);
    expect(b.rate!.high).toBeGreaterThan(0);
    expect(b.visible).toBe(false);
  });

  it("splits by engine and by query, because the causes differ", () => {
    const a = discoverability(sample).profiles.find((p) => p.profileId === "FR-AAAAA")!;
    expect(a.byEngine.map((e) => e.key).sort()).toEqual(["anthropic", "openai"]);
    expect(a.byQuery.map((q) => q.key).sort()).toEqual(["Q1", "Q2"]);
    a.byEngine.forEach((e) => expect(e.draws).toBe(6));
  });

  it("computes the global rate weighted by draws, and counts visible profiles", () => {
    const report = discoverability(sample);
    expect(report.global.draws).toBe(24);
    expect(report.global.cited).toBe(6);
    expect(report.global.rate!.point).toBeCloseTo(0.25, 6);
    expect(report.visibleProfiles).toBe(1);
    expect(report.profilesMeasured).toBe(2);
  });

  it("separates what we control (the crawler came) from what we do not (the answer cited us)", () => {
    const retrievedNotCited = [
      ...Array.from({ length: 10 }, () => obs("FR-DDDDD", "openai", "Q1", false, true)),
      ...Array.from({ length: 2 }, () => obs("FR-DDDDD", "openai", "Q1", true, true)),
    ];
    const d = discoverability(retrievedNotCited).profiles[0]!;
    expect(d.retrieved).toBe(12);
    expect(d.retrievalRate!.point).toBe(1);
    expect(d.rate!.point).toBeCloseTo(2 / 12, 6);
  });

  it("returns an empty report rather than pretending, when there is no observation", () => {
    const empty = discoverability([]);
    expect(empty.profiles).toEqual([]);
    expect(empty.global.rate).toBeNull();
    expect(empty.global.draws).toBe(0);
  });
});

describe("AI crawler hits (the controlled half of the measurement)", () => {
  const lines = [
    '66.249.66.1 - - [20/Sep/2026:10:00:00 +0000] "GET /p/FR-8F42K/ HTTP/1.1" 200 5123 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"',
    '20.15.1.2 - - [20/Sep/2026:10:05:00 +0000] "GET /p/FR-8F42K/ HTTP/1.1" 200 5123 "-" "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)"',
    '20.15.1.3 - - [21/Sep/2026:11:00:00 +0000] "GET /freelances/typescript-paris/ HTTP/1.1" 200 4200 "-" "Mozilla/5.0 (compatible; PerplexityBot/1.0)"',
    '1.2.3.4 - - [21/Sep/2026:11:02:00 +0000] "GET /p/FR-8F42K/ HTTP/1.1" 200 5123 "-" "Mozilla/5.0 (Macintosh) Safari/605.1.15"',
    "ligne illisible qui ne doit pas faire tomber le rapport",
  ];

  it("counts only the AI and search crawlers, per URL, with the last visit", () => {
    const report = botHits(lines);
    const profile = report.find((r) => r.path === "/p/FR-8F42K/")!;
    expect(profile.hits.map((h) => h.bot).sort()).toEqual(["Googlebot", "OAI-SearchBot"]);
    expect(profile.hits.find((h) => h.bot === "OAI-SearchBot")!.count).toBe(1);
    expect(profile.hits.find((h) => h.bot === "Googlebot")!.lastSeen).toBe("2026-09-20");
    expect(report.map((r) => r.path)).not.toContain(undefined);
  });

  it("ignores humans and unreadable lines instead of crashing", () => {
    const report = botHits(lines);
    expect(report.flatMap((r) => r.hits).every((h) => h.count > 0)).toBe(true);
    expect(botHits(["n'importe quoi"])).toEqual([]);
  });

  it("tells which pages no AI crawler has ever fetched", () => {
    const report = botHits(lines, ["/p/FR-8F42K/", "/p/FR-3K9PZ/", "/freelances/typescript-paris/"]);
    const never = report.filter((r) => r.hits.length === 0).map((r) => r.path);
    expect(never).toEqual(["/p/FR-3K9PZ/"]);
  });
});
