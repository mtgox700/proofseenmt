import { describe, expect, it } from "vitest";
import { tallyFrames, upperBoundAt } from "../src/lib/sim";

describe("upperBoundAt", () => {
  it("is the Wilson upper bound of zero successes, the real J0 count", () => {
    expect(upperBoundAt(200)).toBeCloseTo(0.0188, 3);
  });

  it("tightens as answers accumulate: this is what the animation shows", () => {
    expect(upperBoundAt(10)).toBeGreaterThan(upperBoundAt(50));
    expect(upperBoundAt(50)).toBeGreaterThan(upperBoundAt(200));
  });

  it("returns a full-width interval before any answer is counted", () => {
    expect(upperBoundAt(0)).toBe(1);
  });
});

describe("tallyFrames", () => {
  it("ends exactly on the measured total, never past it", () => {
    const frames = tallyFrames(200, 24);
    expect(frames.at(-1)).toBe(200);
    expect(frames.every((n) => n >= 1 && n <= 200)).toBe(true);
  });

  it("is strictly increasing, so the counter never goes backwards", () => {
    const frames = tallyFrames(200, 24);
    expect(frames.every((n, i) => i === 0 || n > (frames[i - 1] ?? 0))).toBe(true);
  });

  it("front-loads the early answers, where the interval moves the most", () => {
    const frames = tallyFrames(200, 24);
    expect(frames[5]).toBeLessThan(40);
  });
});
