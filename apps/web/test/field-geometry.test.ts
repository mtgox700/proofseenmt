import { describe, expect, it } from "vitest";
import { cellKey, centreOf, computeLayout, easeOut, hitTest, ROWS, seeded } from "../src/lib/field-geometry";

const box = { width: 600, height: 300, gap: 24, columns: 3 };

describe("computeLayout", () => {
  it("fits the three columns inside the box, whichever side constrains", () => {
    const layout = computeLayout(box);
    const right = (layout.columnLeft[2] ?? 0) + layout.columnWidth;
    expect(layout.columnLeft[0]).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(box.width + 1e-9);
    expect(layout.top).toBeGreaterThanOrEqual(0);
    expect(layout.top + layout.pitch * ROWS).toBeLessThanOrEqual(box.height + 1e-9);
  });

  it("keeps dots apart: the radius is well under half the pitch", () => {
    const layout = computeLayout(box);
    expect(layout.radius * 2).toBeLessThan(layout.pitch);
  });
});

describe("hitTest", () => {
  const layout = computeLayout(box);
  const byCell = new Map([[cellKey(1, 3, 4), 42]]);

  it("finds the answer whose dot is under the pointer", () => {
    const { x, y } = centreOf({ index: 42, column: 1, row: 3, col: 4 }, layout);
    expect(hitTest(x, y, layout, byCell)).toBe(42);
  });

  it("returns nothing in the gap between columns or outside the grid", () => {
    expect(hitTest((layout.columnLeft[1] ?? 0) - 2, layout.top + 10, layout, byCell)).toBeNull();
    expect(hitTest(layout.columnLeft[0] ?? 0, layout.top - 5, layout, byCell)).toBeNull();
  });
});

describe("motion helpers", () => {
  it("eases out, clamped to the animation", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(2)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it("scatters the same way on every visit", () => {
    const a = seeded(7);
    const b = seeded(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
