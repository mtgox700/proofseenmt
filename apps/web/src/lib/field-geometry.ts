import type { PlacedAnswer } from "./answers";

/*
 * Geometry of the answer field: where each placed answer sits on the canvas, and which answer is under the pointer.
 * Pure functions, so the drawing island stays a thin shell and the maths is tested without a browser.
 */

export const DOTS_PER_ROW = 13;
export const ROWS = 20;

export interface FieldBox {
  readonly width: number;
  readonly height: number;
  /** Horizontal gap between two engine columns. */
  readonly gap: number;
  readonly columns: number;
}

export interface FieldLayout {
  readonly pitch: number;
  readonly radius: number;
  readonly columnWidth: number;
  /** Left edge of each column, and top edge of the grid, centred in the box. */
  readonly columnLeft: readonly number[];
  readonly top: number;
}

export const computeLayout = (box: FieldBox): FieldLayout => {
  const available = (box.width - box.gap * (box.columns - 1)) / box.columns;
  const pitch = Math.max(2, Math.min(available / DOTS_PER_ROW, box.height / ROWS));
  const columnWidth = pitch * DOTS_PER_ROW;
  const total = columnWidth * box.columns + box.gap * (box.columns - 1);
  const left = (box.width - total) / 2;
  return {
    pitch,
    radius: pitch * 0.34,
    columnWidth,
    columnLeft: Array.from({ length: box.columns }, (_, i) => left + i * (columnWidth + box.gap)),
    top: (box.height - pitch * ROWS) / 2,
  };
};

export const centreOf = (placed: PlacedAnswer, layout: FieldLayout): { x: number; y: number } => ({
  x: (layout.columnLeft[placed.column] ?? 0) + (placed.col + 0.5) * layout.pitch,
  y: layout.top + (placed.row + 0.5) * layout.pitch,
});

/** The answer under a point of the canvas, or `null` between dots and outside the grid. */
export const hitTest = (x: number, y: number, layout: FieldLayout, byCell: ReadonlyMap<string, number>): number | null => {
  const column = layout.columnLeft.findIndex((left) => x >= left && x < left + layout.columnWidth);
  if (column === -1) return null;
  const col = Math.floor((x - (layout.columnLeft[column] ?? 0)) / layout.pitch);
  const row = Math.floor((y - layout.top) / layout.pitch);
  if (row < 0 || row >= ROWS) return null;
  return byCell.get(cellKey(column, row, col)) ?? null;
};

export const cellKey = (column: number, row: number, col: number): string => `${column}:${row}:${col}`;

/** Strong ease-out (animate skill vocabulary), as a function of progress. */
export const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 4;

/** Deterministic pseudo-random numbers: the intro scatter is the same on every visit and in every test. */
export const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};
