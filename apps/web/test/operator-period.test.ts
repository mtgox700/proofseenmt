import { describe, expect, it } from "vitest";
import { periodOf } from "../src/lib/operator-period";

const NOW = new Date("2026-10-16T15:30:00Z");

describe("back-office period filter", () => {
  it("defaults to the last thirty days, today included", () => {
    const p = periodOf(undefined, undefined, NOW);
    expect(p.from).toBe("2026-09-17");
    expect(p.to).toBe("2026-10-16");
    expect(p.cohort).toEqual({ from: new Date("2026-09-17T00:00:00Z"), to: new Date("2026-10-17T00:00:00Z") });
  });

  it("keeps the last day in the period, puts a reversed period back in order and ignores what is unreadable", () => {
    expect(periodOf("2026-10-01", "2026-10-01", NOW).cohort).toEqual({ from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-02T00:00:00Z") });
    expect(periodOf("2026-10-10", "2026-10-01", NOW)).toMatchObject({ from: "2026-10-01", to: "2026-10-10" });
    expect(periodOf("2026-02-30", "pas une date", NOW)).toMatchObject({ from: "2026-09-17", to: "2026-10-16" });
  });

  it("never spans more than three years", () => {
    expect(periodOf("2000-01-01", "2026-10-16", NOW).from).toBe("2023-10-14");
  });
});
