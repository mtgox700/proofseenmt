import { describe, expect, it } from "vitest";
import type { EngineResult, WaveView } from "@proofseen/db";
import { evolutionOf, firstSteps, funnelOf, latestCitations } from "../src/lib/visibility-view";

const result = (engine: string, draws: number, retrieved: number, named: number, top5: number, cited: number): EngineResult => ({ engine, draws, retrieved, named, top5, cited });

const wave = (waveId: string, day: string, engines: readonly EngineResult[]): WaveView => ({ waveId, measuredAt: new Date(`${day}T09:00:00Z`), draws: engines.reduce((s, e) => s + e.draws, 0), engines });

describe("funnel of one engine", () => {
  it("gives each step as a count out of the answers, its share and its interval", () => {
    const funnel = funnelOf(result("anthropic", 20, 15, 10, 5, 5));
    expect(funnel.engine).toBe("anthropic");
    expect(funnel.draws).toBe(20);
    expect(funnel.steps.map((s) => [s.step, s.count, s.draws, s.share])).toEqual([
      ["retrieved", 15, 20, 0.75],
      ["named", 10, 20, 0.5],
      ["top5", 5, 20, 0.25],
      ["cited", 5, 20, 0.25],
    ]);
    const cited = funnel.steps[3];
    expect(cited?.interval?.low).toBeLessThan(0.25);
    expect(cited?.interval?.high).toBeGreaterThan(0.25);
  });

  it("has no share and no interval when the engine gave no answer", () => {
    const funnel = funnelOf(result("openai", 0, 0, 0, 0, 0));
    expect(funnel.steps.every((s) => s.share === null && s.interval === null && s.count === 0)).toBe(true);
  });
});

describe("evolution between the two latest waves", () => {
  it("is null until there are two waves", () => {
    expect(evolutionOf([])).toBeNull();
    expect(evolutionOf([wave("W2", "2026-10-10", [result("anthropic", 20, 1, 1, 1, 1)])])).toBeNull();
  });

  it("compares shares engine by engine, keeping the raw counts of both waves", () => {
    const latest = wave("W2", "2026-10-10", [result("anthropic", 20, 15, 10, 5, 4)]);
    const before = wave("W1", "2026-09-10", [result("anthropic", 10, 5, 5, 5, 1)]);
    const older = wave("W0", "2026-08-10", [result("anthropic", 20, 20, 20, 20, 20)]);
    const evolution = evolutionOf([latest, before, older]);
    expect(evolution?.current.waveId).toBe("W2");
    expect(evolution?.previous.waveId).toBe("W1");
    const [engine] = evolution?.engines ?? [];
    expect(engine?.kind).toBe("both");
    const retrieved = engine?.steps[0];
    expect(retrieved).toMatchObject({ step: "retrieved", previous: { count: 5, draws: 10 }, current: { count: 15, draws: 20 } });
    expect(retrieved?.delta).toBeCloseTo(0.25);
    expect(engine?.steps[2]?.delta).toBeCloseTo(-0.25);
    expect(engine?.steps[3]?.delta).toBeCloseTo(0.1);
  });

  it("names engines measured only once, sorted, without a change to report", () => {
    const latest = wave("W2", "2026-10-10", [result("perplexity", 20, 2, 2, 2, 2), result("anthropic", 20, 4, 4, 4, 4)]);
    const before = wave("W1", "2026-09-10", [result("openai", 20, 1, 1, 1, 1), result("anthropic", 20, 2, 2, 2, 2)]);
    const engines = evolutionOf([latest, before])?.engines ?? [];
    expect(engines.map((e) => [e.engine, e.kind])).toEqual([
      ["anthropic", "both"],
      ["openai", "dropped"],
      ["perplexity", "new"],
    ]);
    const openai = engines[1];
    expect(openai?.steps[0]).toMatchObject({ previous: { count: 1, draws: 20 }, current: null, delta: null });
    const perplexity = engines[2];
    expect(perplexity?.steps[0]).toMatchObject({ previous: null, current: { count: 2, draws: 20 }, delta: null });
  });

  it("gives no change when one of the waves counted no answer for the engine", () => {
    const latest = wave("W2", "2026-10-10", [result("anthropic", 0, 0, 0, 0, 0)]);
    const before = wave("W1", "2026-09-10", [result("anthropic", 20, 2, 2, 2, 2)]);
    expect(evolutionOf([latest, before])?.engines[0]?.steps.every((s) => s.delta === null)).toBe(true);
  });
});

describe("first steps to a measured result", () => {
  it("are all to do without a profile", () => {
    expect(firstSteps({ profile: null, requests: [] })).toEqual([
      { key: "publish", done: false },
      { key: "prove", done: false },
      { key: "request", done: false },
    ]);
  });

  it("follow the profile's publication, its proven addresses and the requests made", () => {
    const steps = (visibility: "private" | "pseudonymous" | "named", verifiedUrls: number, statuses: readonly ("queued" | "running" | "done" | "failed" | "refused")[]) =>
      firstSteps({ profile: { visibility, verifiedUrls }, requests: statuses.map((status) => ({ status })) }).map((s) => s.done);
    expect(steps("private", 0, [])).toEqual([false, false, false]);
    expect(steps("pseudonymous", 0, [])).toEqual([true, false, false]);
    expect(steps("named", 2, ["failed", "refused"])).toEqual([true, true, false]);
    expect(steps("named", 1, ["queued"])).toEqual([true, true, true]);
    expect(steps("named", 1, ["running"])).toEqual([true, true, true]);
    expect(steps("named", 1, ["done"])).toEqual([true, true, true]);
  });
});

describe("latest citations for the home tile", () => {
  it("is null before the first wave", () => {
    expect(latestCitations([])).toBeNull();
  });

  it("keeps only the citations of the latest wave, per engine", () => {
    const latest = wave("W2", "2026-10-10", [result("anthropic", 20, 15, 10, 5, 4), result("openai", 20, 3, 2, 1, 0)]);
    const before = wave("W1", "2026-09-10", [result("anthropic", 20, 1, 1, 1, 1)]);
    expect(latestCitations([latest, before])).toEqual({
      measuredAt: latest.measuredAt,
      engines: [
        { engine: "anthropic", cited: 4, draws: 20 },
        { engine: "openai", cited: 0, draws: 20 },
      ],
    });
  });
});
