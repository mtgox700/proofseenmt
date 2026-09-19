/** Pure maths and gating of the hero "field of answers" (ambient WebGL backdrop). No DOM here, so it is unit-tested. */
export interface Grid {
  readonly cols: number;
  readonly rows: number;
  /** Interleaved x,y in [-1, 1]. */
  readonly positions: Float32Array;
}

export const buildGrid = (cols: number, rows: number): Grid => {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2) throw new RangeError("grid needs at least 2×2 points");
  const positions = new Float32Array(cols * rows * 2);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = (r * cols + c) * 2;
      positions[i] = (c / (cols - 1)) * 2 - 1;
      positions[i + 1] = (r / (rows - 1)) * 2 - 1;
    }
  }
  return { cols, rows, positions };
};

export interface MotionContext {
  readonly reducedMotion: boolean;
  readonly saveData: boolean;
  readonly webgl2: boolean;
  readonly cores: number;
  readonly width: number;
  /** A precise pointer (mouse/trackpad): a proxy for a laptop/desktop class device. */
  readonly finePointer: boolean;
}

/** Below this width the CSS-only signal is shown instead (phones: no GPU/CPU cost, same story). */
export const MIN_WEBGL_WIDTH = 900;

/**
 * Performance budget (DESIGN_WEB §3): WebGL only on desktop-class devices. Measured on 2026-09-19: starting WebGL on an
 * emulated mid-range phone blocked the main thread for 1.28 s (Lighthouse mobile TBT) — phones get the CSS signal.
 */
export const shouldAnimate = (ctx: MotionContext): boolean =>
  !ctx.reducedMotion && !ctx.saveData && ctx.webgl2 && ctx.cores >= 4 && ctx.width >= MIN_WEBGL_WIDTH && ctx.finePointer;

/** Smaller field on narrow screens: fewer points, same look. */
export const gridSizeFor = (width: number): { readonly cols: number; readonly rows: number } =>
  width < 720 ? { cols: 38, rows: 26 } : { cols: 64, rows: 34 };

/** "#0b6e54" → [11, 110, 84] / 255. Returns null for anything else. */
export const parseHex = (value: string): readonly [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (m === null) return null;
  const n = Number.parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
