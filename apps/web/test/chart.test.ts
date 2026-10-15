import { describe, expect, it } from "vitest";
import { barChart, niceMax, seriesSummary } from "../src/lib/chart";

describe("niceMax", () => {
  it("rounds up to 1, 2 or 5 times a power of ten, and never below 1", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-3)).toBe(1);
    expect(niceMax(Number.NaN)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(12)).toBe(20);
    expect(niceMax(200)).toBe(200);
    expect(niceMax(201)).toBe(500);
    expect(niceMax(880_000)).toBe(1_000_000);
  });
});

describe("barChart", () => {
  const size = { width: 232, height: 126, gap: 0 };

  it("draws bars proportional to their value, from a zero baseline", () => {
    const g = barChart(
      [
        { label: "a", value: 0 },
        { label: "b", value: 5 },
        { label: "c", value: 10 },
        { label: "d", value: 2.5 },
      ],
      size,
    );
    expect(g.scaleMax).toBe(10);
    expect(g.baseline).toBe(108);
    expect(g.bars.map((bar) => bar.height)).toEqual([0, 50, 100, 25]);
    expect(g.bars.map((bar) => bar.x)).toEqual([32, 82, 132, 182]);
    expect(g.bars.every((bar) => bar.y + bar.height === g.baseline)).toBe(true);
    expect(g.ticks).toEqual([
      { value: 0, y: 108 },
      { value: 5, y: 58 },
      { value: 10, y: 8 },
    ]);
  });

  it("keeps an empty or all-zero series flat on its baseline, never invents a scale", () => {
    const flat = barChart([{ label: "a", value: 0 }, { label: "b", value: 0 }], size);
    expect(flat.scaleMax).toBe(1);
    expect(flat.bars.every((bar) => bar.height === 0)).toBe(true);
    expect(barChart([], size).bars).toEqual([]);
  });

  it("treats negative or non-finite values as zero", () => {
    const g = barChart([{ label: "a", value: -4 }, { label: "b", value: Number.POSITIVE_INFINITY }, { label: "c", value: 1 }], size);
    expect(g.bars.map((bar) => bar.value)).toEqual([0, 0, 1]);
  });
});

describe("seriesSummary", () => {
  it("gives the total and the first highest point, or no peak for an empty series", () => {
    expect(seriesSummary([{ label: "a", value: 1 }, { label: "b", value: 4 }, { label: "c", value: 4 }])).toEqual({ total: 9, peak: { label: "b", value: 4 } });
    expect(seriesSummary([{ label: "a", value: 0 }])).toEqual({ total: 0, peak: null });
  });
});
