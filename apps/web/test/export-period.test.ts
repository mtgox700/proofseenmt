import { describe, expect, it } from "vitest";
import { exportPeriod, parisDayStart } from "../src/lib/export-period";

const period = (query: string) => exportPeriod(new URLSearchParams(query));

describe("export period", () => {
  it("starts each day at midnight in Paris, winter and summer", () => {
    expect(parisDayStart("2026-12-01").toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(parisDayStart("2026-08-01").toISOString()).toBe("2026-07-31T22:00:00.000Z");
    // The night clocks go back: 25 October 2026.
    expect(parisDayStart("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("includes both days given", () => {
    expect(period("from=2026-11-01&to=2026-11-30")).toEqual({ from: new Date("2026-10-31T23:00:00Z"), to: new Date("2026-11-30T23:00:00Z") });
  });

  it("refuses malformed, reversed or over-long periods", () => {
    expect(period("from=2026-11-01")).toBeNull();
    expect(period("from=2026-13-01&to=2026-12-01")).toBeNull();
    expect(period("from=2026-12-01&to=2026-11-01")).toBeNull();
    expect(period("from=2026-01-01&to=2027-01-02")).toBeNull();
    expect(period("from=2026-01-01&to=2026-12-31")).not.toBeNull();
    expect(period("from=9999-12-01&to=9999-12-31")).toBeNull();
    expect(period("from=0000-01-01&to=0000-01-31")).toBeNull();
  });
});
