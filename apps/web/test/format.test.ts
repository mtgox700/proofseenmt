import { describe, expect, it } from "vitest";
import { count, date, percent, points, range, shareWithRange, usd } from "../src/lib/format";

describe("percent", () => {
  it("writes French decimals with a comma and a narrow space before the sign", () => {
    expect(percent(0.019, "fr")).toBe("1,9 %");
    expect(percent(0.39, "fr")).toBe("39 %");
  });

  it("writes English decimals with a point and no space", () => {
    expect(percent(0.019, "en")).toBe("1.9%");
    expect(percent(0.265, "en")).toBe("26.5%");
  });

  it("never rounds an observed share down to a zero", () => {
    expect(percent(0.0004, "fr")).toBe("< 0,1 %");
    expect(percent(0, "fr")).toBe("0 %");
  });
});

describe("range", () => {
  it("brackets the interval the way the client report does", () => {
    expect(range({ p: 0, low: 0, high: 0.019 }, "fr")).toBe("[0 % ; 1,9 %]");
    expect(range({ p: 0, low: 0, high: 0.019 }, "en")).toBe("[0%, 1.9%]");
  });

  it("says plainly when no interval can be computed", () => {
    expect(range(null, "fr")).toBe("non calculable");
    expect(range(null, "en")).toBe("not computable");
  });
});

describe("shareWithRange", () => {
  it("returns the share and its Wilson interval from raw counts", () => {
    const result = shareWithRange(908, 2328);
    expect(result?.p).toBeCloseTo(0.39, 2);
    expect(result?.low).toBeLessThan(0.39);
    expect(result?.high).toBeGreaterThan(0.39);
  });

  it("refuses an empty denominator instead of inventing a zero", () => {
    expect(shareWithRange(0, 0)).toBeNull();
  });
});

describe("count and date", () => {
  it("groups thousands per locale", () => {
    expect(count(2328, "fr")).toBe("2 328");
    expect(count(2328, "en")).toBe("2,328");
  });

  it("writes a measurement date in full, without a time", () => {
    expect(date("2026-09-24", "fr")).toBe("24 septembre 2026");
    expect(date("2026-09-24T08:30:02.217Z", "en")).toBe("24 September 2026");
  });
});

describe("usd", () => {
  it("matches the landing wording of the J0 cost", () => {
    expect(usd(15.790449, "fr")).toBe("15,79 $");
    expect(usd(15.790449, "en")).toBe("$15.79");
  });
});

describe("points", () => {
  it("signs a change in percentage points with a true minus sign", () => {
    expect(points(0.15, "fr")).toBe("+15 pt");
    expect(points(-0.302, "fr")).toBe("−30,2 pt");
    expect(points(-0.302, "en")).toBe("−30.2 pts");
    expect(points(0, "en")).toBe("0 pts");
  });
});
