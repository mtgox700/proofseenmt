import { GEOMETRY } from "./registre";

/*
 * The register of a freelancer's own answers (CONNECTED_PLAN §2.1 "Être cité", decision 1 of the Shogun): the figure of
 * the storefront (lib/registre.ts), drawn from what the database keeps of a measurement. The raw answers are never
 * stored (packages/db/src/visibility.ts): each engine keeps its count of answers and of answers that cite the person
 * with a link. So one slot per answer obtained, the cited ones first in the column (their order inside a measurement
 * is not kept, and the figure does not pretend to know it), drawn green like the storefront's `.rg-you`; the others in
 * ink, lower, so the difference is said by form as well as by tone (WCAG 1.4.11). Computed on the server, a few paths.
 */

export interface EngineCount {
  readonly engine: string;
  readonly draws: number;
  readonly cited: number;
}

export interface EngineColumn {
  readonly engine: string;
  readonly draws: number;
  readonly cited: number;
  readonly viewBox: string;
  /** The rule above the first row and under the last, in one path. */
  readonly frame: string;
  /** The cited answers, one dashed run per row; empty when none cites the person. */
  readonly citedPath: string;
  /** Every other answer, one dashed run per row. */
  readonly restPath: string;
  /** The reading rule, resting on the foot rule, with its two stops. */
  readonly rule: string;
  /** From the foot rule up to the head rule (negative: upwards), for the one descent of the reading rule. */
  readonly rise: number;
}

/** Slot heights: a cited answer is as tall as the storefront's "you"; another answer is a short mark in ink. */
export const CITED_HEIGHT = 10;
export const REST_HEIGHT = 4;

const WIDTH = GEOMETRY.pitch * GEOMETRY.perRow;
const round = (value: number): string => String(Math.round(value * 10) / 10);
const baseline = (row: number): number => GEOMETRY.rowTop + row * GEOMETRY.rowPitch + GEOMETRY.slotHeight;

/** One dashed run of `slots` slots from slot index `from` of a row, centred on the height of its category. */
const run = (row: number, from: number, slots: number, height: number): string =>
  slots <= 0 ? "" : `M${round(from * GEOMETRY.pitch)} ${round(baseline(row) - height / 2)}h${slots * GEOMETRY.pitch - (GEOMETRY.pitch - GEOMETRY.slot)}`;

/** A count that cannot be negative, fractional or above its total (the database already refuses those). */
const whole = (value: number, max: number): number => Math.max(0, Math.min(max, Math.floor(Number.isFinite(value) ? value : 0)));

export const engineColumn = (input: EngineCount): EngineColumn => {
  const draws = whole(input.draws, Number.MAX_SAFE_INTEGER);
  const cited = whole(input.cited, draws);
  const rows = Math.max(1, Math.ceil(draws / GEOMETRY.perRow));
  const per = GEOMETRY.perRow;
  const citedRuns: string[] = [];
  const restRuns: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const start = row * per;
    const inRow = Math.max(0, Math.min(per, draws - start));
    const citedHere = Math.max(0, Math.min(inRow, cited - start));
    citedRuns.push(run(row, 0, citedHere, CITED_HEIGHT));
    restRuns.push(run(row, citedHere, inRow - citedHere, REST_HEIGHT));
  }
  const head = 1;
  const foot = baseline(rows - 1) + 5;
  const o = GEOMETRY.overhang;
  const s = GEOMETRY.stop;
  const span = WIDTH - 1 + 2 * o;
  const pad = o + 1;
  return {
    engine: input.engine,
    draws,
    cited,
    viewBox: `${-pad} ${-pad} ${WIDTH + 2 * pad} ${foot + s + 1 + pad}`,
    frame: `M0 ${head}h${WIDTH - 1}M0 ${foot}h${WIDTH - 1}`,
    citedPath: citedRuns.join(""),
    restPath: restRuns.join(""),
    rule: `M${-o} ${foot}h${span}M${-o} ${foot - s}v${2 * s}M${span - o} ${foot - s}v${2 * s}`,
    rise: head - foot,
  };
};

/** The whole register of a measurement: one column per engine, and the raw totals that its caption writes. */
export const citationRegister = (engines: readonly EngineCount[]): { readonly columns: readonly EngineColumn[]; readonly draws: number; readonly cited: number } => {
  const columns = engines.map(engineColumn);
  return {
    columns,
    draws: columns.reduce((sum, c) => sum + c.draws, 0),
    cited: columns.reduce((sum, c) => sum + c.cited, 0),
  };
};
