import { describe, expect, it } from "vitest";
import { wilson } from "../src/wilson";
import { createRng } from "../src/rng";
import { clusterBootstrap, differenceInDifferences } from "../src/bootstrap";
import { funnel, type DrawOutcome } from "../src/funnel";
import { sorvAt5, isRenderedVisible } from "../src/sorv";
import { controlDrift } from "../src/drift";

describe("wilson", () => {
  // Reference values computed by hand with z = 1.96:
  // 5/10  -> centre 0.5, half-width 1.96*sqrt(0.025+0.009604)/1.38416 = 0.26341 -> [0.23659, 0.76341]
  // 0/10  -> upper = z²/(n+z²) = 3.8416/13.8416 = 0.27753
  it("matches hand-computed references", () => {
    const mid = wilson(5, 10)!;
    expect(mid.p).toBeCloseTo(0.5, 10);
    expect(mid.low).toBeCloseTo(0.23659, 4);
    expect(mid.high).toBeCloseTo(0.76341, 4);
    const zero = wilson(0, 10)!;
    expect(zero.low).toBe(0);
    expect(zero.high).toBeCloseTo(0.27753, 4);
  });

  it("stays inside [0, 1] at the extremes", () => {
    const full = wilson(10, 10)!;
    expect(full.high).toBe(1);
    expect(full.low).toBeGreaterThan(0.7);
  });

  it("returns null when there is no observation", () => {
    expect(wilson(0, 0)).toBeNull();
  });

  it("rejects impossible inputs", () => {
    expect(() => wilson(3, 2)).toThrow(RangeError);
    expect(() => wilson(-1, 2)).toThrow(RangeError);
    expect(() => wilson(1.5, 2)).toThrow(RangeError);
  });
});

describe("createRng", () => {
  it("is deterministic for a given seed and within [0, 1)", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe("clusterBootstrap", () => {
  const clusters = [
    { successes: 2, n: 20 },
    { successes: 0, n: 20 },
    { successes: 5, n: 20 },
    { successes: 1, n: 20 },
  ];

  it("returns the pooled estimate and a reproducible interval", () => {
    const first = clusterBootstrap(clusters, { iterations: 2000, seed: 7 });
    const second = clusterBootstrap(clusters, { iterations: 2000, seed: 7 });
    expect(first.estimate).toBeCloseTo(8 / 80, 10);
    expect(first).toEqual(second);
    expect(first.low).toBeLessThanOrEqual(first.estimate);
    expect(first.high).toBeGreaterThanOrEqual(first.estimate);
  });

  it("gives a zero-width interval when every cluster is empty of successes", () => {
    const result = clusterBootstrap([{ successes: 0, n: 5 }, { successes: 0, n: 5 }], { iterations: 200, seed: 1 });
    expect(result).toEqual({ estimate: 0, low: 0, high: 0 });
  });

  it("rejects an empty input", () => {
    expect(() => clusterBootstrap([], { iterations: 10, seed: 1 })).toThrow(RangeError);
  });
});

describe("differenceInDifferences", () => {
  it("isolates the treatment effect from a shared drift", () => {
    const before = [{ successes: 1, n: 20 }, { successes: 1, n: 20 }];
    const after = [{ successes: 9, n: 20 }, { successes: 9, n: 20 }];
    const controlBefore = [{ successes: 2, n: 20 }, { successes: 2, n: 20 }];
    const controlAfter = [{ successes: 4, n: 20 }, { successes: 4, n: 20 }];
    const did = differenceInDifferences({ before, after, controlBefore, controlAfter }, { iterations: 500, seed: 3 });
    // (0.45 - 0.05) - (0.2 - 0.1) = 0.3
    expect(did.estimate).toBeCloseTo(0.3, 10);
    expect(did.low).toBeLessThanOrEqual(did.estimate);
    expect(did.high).toBeGreaterThanOrEqual(did.estimate);
  });
});

describe("funnel", () => {
  const outcomes: DrawOutcome[] = [
    { engine: "openai", jdId: "T01", retrieved: true, named: true, top5: true, cited: true },
    { engine: "openai", jdId: "T01", retrieved: true, named: false, top5: false, cited: false },
    { engine: "openai", jdId: "T02", retrieved: false, named: false, top5: false, cited: false },
    { engine: "anthropic", jdId: "T01", retrieved: false, named: false, top5: false, cited: false },
  ];

  it("counts each stage per engine with Wilson intervals", () => {
    const result = funnel(outcomes);
    const openai = result.find((r) => r.engine === "openai")!;
    expect(openai.draws).toBe(3);
    expect(openai.retrieved.successes).toBe(2);
    expect(openai.top5.successes).toBe(1);
    expect(openai.top5.interval!.p).toBeCloseTo(1 / 3, 10);
    const anthropic = result.find((r) => r.engine === "anthropic")!;
    expect(anthropic.retrieved.successes).toBe(0);
  });
});

describe("sorvAt5", () => {
  it("averages TA@5 across engines and bootstraps over job descriptions", () => {
    const outcomes: DrawOutcome[] = [
      ...Array.from({ length: 5 }, () => ({ engine: "openai" as const, jdId: "T01", retrieved: true, named: true, top5: true, cited: false })),
      ...Array.from({ length: 5 }, () => ({ engine: "openai" as const, jdId: "T02", retrieved: false, named: false, top5: false, cited: false })),
      ...Array.from({ length: 10 }, (_, i) => ({ engine: "anthropic" as const, jdId: i < 5 ? "T01" : "T02", retrieved: false, named: false, top5: false, cited: false })),
    ];
    const result = sorvAt5(outcomes, { iterations: 500, seed: 11 });
    // openai 5/10 = 0.5, anthropic 0/10 = 0 -> mean 0.25
    expect(result.estimate).toBeCloseTo(0.25, 10);
    expect(result.perEngine).toEqual({ openai: 0.5, anthropic: 0 });
    expect(result.low).toBeGreaterThanOrEqual(0);
    expect(result.high).toBeLessThanOrEqual(1);
  });
});

describe("isRenderedVisible", () => {
  const certain = (jdId: string, source: "market" | "client" = "market") => ({ jdId, source, type: "certain" as const });

  it("requires at least 2 certain matches on 2 distinct market JDs and a positive lower bound", () => {
    expect(isRenderedVisible([certain("T01"), certain("T02")], 0.01)).toBe(true);
    expect(isRenderedVisible([certain("T01"), certain("T01")], 0.01)).toBe(false);
    expect(isRenderedVisible([certain("T01"), certain("T02")], 0)).toBe(false);
  });

  it("ignores probable matches and client-supplied JDs", () => {
    const probable = { jdId: "T02", source: "market" as const, type: "probable" as const };
    expect(isRenderedVisible([certain("T01"), probable], 0.2)).toBe(false);
    expect(isRenderedVisible([certain("T01"), certain("C01", "client")], 0.2)).toBe(false);
  });
});

describe("controlDrift", () => {
  it("flags a retrieval-rate move above 5 points on control JDs", () => {
    expect(controlDrift({ successes: 2, n: 20 }, { successes: 5, n: 20 })).toEqual({ delta: 0.15, flagged: true });
    expect(controlDrift({ successes: 2, n: 20 }, { successes: 3, n: 20 }).flagged).toBe(false);
  });
});
