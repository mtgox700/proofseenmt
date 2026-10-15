/*
 * Geometry of the dashboard bar charts, computed on the server and drawn as plain SVG: no chart library, no client
 * script. Every chart also has a data table next to it, so this only has to be faithful, never the sole source.
 *
 * The scale always starts at zero and ends at a round number (1, 2 or 5 times a power of ten) at or above the largest
 * value: a bar's height is proportional to its count, and an empty series draws a flat baseline, not a guess.
 */

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface ChartBar extends ChartPoint {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ChartTick {
  readonly value: number;
  readonly y: number;
}

export interface BarChartGeometry {
  readonly width: number;
  readonly height: number;
  /** Left of the plot: room for the tick labels. */
  readonly plotLeft: number;
  readonly baseline: number;
  readonly top: number;
  readonly scaleMax: number;
  readonly bars: readonly ChartBar[];
  readonly ticks: readonly ChartTick[];
}

export interface ChartSize {
  readonly width: number;
  readonly height: number;
  /** Share of each slot left empty between bars, 0 to 0.9. */
  readonly gap?: number;
}

const PLOT_LEFT = 32;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 18;
const STEPS = [1, 2, 5] as const;

const finite = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

/** The smallest round number at or above `max` (1 for an empty series). */
export const niceMax = (max: number): number => {
  const value = finite(max);
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of STEPS) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
};

/** Bars across the plot, left to right in the order given; three ticks (0, half, max). */
export const barChart = (points: readonly ChartPoint[], size: ChartSize): BarChartGeometry => {
  const baseline = size.height - PLOT_BOTTOM;
  const plotHeight = Math.max(1, baseline - PLOT_TOP);
  const plotWidth = Math.max(1, size.width - PLOT_LEFT);
  const scaleMax = niceMax(Math.max(0, ...points.map((p) => finite(p.value))));
  const slot = points.length === 0 ? plotWidth : plotWidth / points.length;
  const gap = Math.min(0.9, Math.max(0, size.gap ?? 0.2));
  const barWidth = Math.max(0.5, slot * (1 - gap));
  const yOf = (value: number): number => baseline - (finite(value) / scaleMax) * plotHeight;
  const round = (n: number): number => Math.round(n * 100) / 100;
  return {
    width: size.width,
    height: size.height,
    plotLeft: PLOT_LEFT,
    baseline,
    top: PLOT_TOP,
    scaleMax,
    bars: points.map((point, i) => {
      const y = yOf(point.value);
      return { ...point, value: finite(point.value), x: round(PLOT_LEFT + i * slot + (slot - barWidth) / 2), y: round(y), width: round(barWidth), height: round(baseline - y) };
    }),
    ticks: (scaleMax % 2 === 0 ? [0, scaleMax / 2, scaleMax] : [0, scaleMax]).map((value) => ({ value, y: round(yOf(value)) })),
  };
};

/** Sum and largest point of a series, for the chart's text summary. */
export const seriesSummary = (points: readonly ChartPoint[]): { readonly total: number; readonly peak: ChartPoint | null } => {
  const total = points.reduce((sum, p) => sum + finite(p.value), 0);
  const peak = points.reduce<ChartPoint | null>((best, p) => (finite(p.value) > (best === null ? 0 : best.value) ? { label: p.label, value: finite(p.value) } : best), null);
  return { total, peak };
};
