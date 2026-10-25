/*
 * The poinçon d'empreinte (LEGENDS_P2_CONCEPT §A.3): a lozenge drawn from the 256 bits of the SHA-256 fingerprint of a
 * frozen document. It helps the eye recognise a document; the printed characters are what attest (§A.3, « le dessin
 * aide l'oeil ; la chaîne fait foi »). A mark of the brand, so it lives in the brand package (L1-111): the web app draws
 * it on screen, the document engine prints it in the footer of a PDF, from the same geometry.
 *
 * The drawing, in six rules (each chosen on the specimen, .war-room/sprints/L1_specimens/fingerprint-mark.html):
 * 1. An emblem, not a noise. The lozenge holds a grid of small lozenges, mirrored on its vertical axis, as a hallmark
 *    or a face is: the eye remembers a symmetric figure, it forgets static (the first draft, unmirrored, read as static).
 * 2. Every bit counts. At 128 px the grid is 16 x 16, so 136 cells on and right of the axis. Bit k of the fingerprint
 *    is folded into cell k mod 136 (exclusive or), in the order of a page: top row first, left to right. Flipping any
 *    one bit of the fingerprint flips exactly one cell and its mirror; a changed document (about half its bits change,
 *    the avalanche of SHA-256) changes about half the cells.
 * 3. A smaller mark is the same mark seen from further away. 64 and 32 px show 8 x 8 and 4 x 4 cells, each the majority
 *    of the four cells under it, a tie settled by the top one of the four (which keeps the mirror). Every size depends
 *    on all 256 bits and keeps the silhouette of the larger one.
 * 4. At 16 px, the frame and its state only, no cell (Shogun, L1-090): a 2 x 2 mirrored grid has four possible
 *    drawings, so two documents of one list would share a mark and the eye would conclude « same document ». At that
 *    size the sixteen characters beside the mark carry the identity. Print (the footer of a PDF) has the resolution the
 *    screen lacks: it draws the 64 px level, scaled down in vector.
 * 5. The geometry is drawn at its nominal size in pixel units, so the cells land where the pixels are; any other size
 *    scales the nearest level (levelFor).
 * 6. A pending act has an open frame: the frame's own path, interrupted in the middle of each side (a gap of 14 % of
 *    the side, centred; at 28 % the four corners read as separate chevrons on the specimen), so the lozenge keeps its
 *    silhouette and reads « unfinished ». At 16 px the gaps would be a pixel or two: the frame stays whole, and the
 *    word says the state.
 *
 * Pure: no clock, no randomness, no DOM, no dependency. The same fingerprint always gives the same paths.
 */

const HEX64 = /^[0-9a-fA-F]{64}$/;

/** What a value that is not a fingerprint is told. */
export const FINGERPRINT_ERROR = "a fingerprint is the 64 hexadecimal characters of a SHA-256";

/** A SHA-256 fingerprint as 64 hexadecimal characters, trimmed and normalised to lower case; throws on anything else. */
export function parseFingerprint(value: unknown): string {
  if (typeof value !== "string" || !HEX64.test(value.trim())) throw new Error(FINGERPRINT_ERROR);
  return value.trim().toLowerCase();
}

/** The four nominal sizes, each with its own level of detail. */
export const MARK_SIZES = [16, 32, 64, 128] as const;
export type MarkSize = (typeof MARK_SIZES)[number];

export interface Level {
  /** Nominal size in pixels; the viewBox is drawn in these units. */
  readonly size: MarkSize;
  /** Cells per side of the inner grid. */
  readonly n: 2 | 4 | 8 | 16;
  /** From the centre to a vertex of the frame's stroke line. */
  readonly frame: number;
  /** Stroke width of the frame (drawn outline) or the rim of the plate (struck mark). */
  readonly stroke: number;
  /** From the centre to a vertex of the grid of cells. */
  readonly grid: number;
  /** What each cell's half-diagonal gives back to the gap between cells. */
  readonly inset: number;
  /** Whether the level draws cells at all (not at 16 px) and opens the frame of a pending act (not at 16 px). */
  readonly detailed: boolean;
}

const LEVELS: readonly Level[] = [
  { size: 16, n: 2, frame: 7.25, stroke: 1.25, grid: 0, inset: 0, detailed: false },
  { size: 32, n: 4, frame: 15, stroke: 1, grid: 13, inset: 0.35, detailed: true },
  { size: 64, n: 8, frame: 30.5, stroke: 1.25, grid: 27, inset: 0.35, detailed: true },
  { size: 128, n: 16, frame: 61.5, stroke: 1.5, grid: 56, inset: 0.35, detailed: true },
];

/** The level a printed document draws, scaled down in vector (about 12 mm): print resolves what 16 px cannot. */
export const PRINT_LEVEL: MarkSize = 64;

/**
 * The open frame of a pending act, in units of the frame's pathLength (one unit per side, the path starting at the top
 * vertex): each side is drawn from both of its corners and left open in its middle, the gap centred and at most 30 %.
 */
export const PENDING_FRAME = { pathLength: 4, gap: 0.14, dasharray: "0.86 0.14", dashoffset: "0.43" } as const;

/**
 * The level drawn for a rendered size: each level serves from three quarters of its nominal size, where its cells are
 * still 5 px across. So 24 to 47 px draw the 32 px level, 48 to 95 the 64, and 96 px and more the full grid, as §A.3
 * asks for documents, the ceremony and /verifier (96 to 160 px).
 */
export function levelFor(size: number): Level {
  if (!Number.isFinite(size) || size <= 0) throw new Error("a mark needs a positive size in pixels");
  let chosen = LEVELS[0] as Level;
  for (const level of LEVELS) if (level.size * 0.75 <= size) chosen = level;
  return chosen;
}

/** The 256 bits, most significant bit of the first byte first: bit 0 is the high bit of the first hex character. */
export function fingerprintBits(fingerprint: string): readonly boolean[] {
  const hex = parseFingerprint(fingerprint);
  const bits: boolean[] = [];
  for (const char of hex) {
    const nibble = Number.parseInt(char, 16);
    for (let shift = 3; shift >= 0; shift -= 1) bits.push(((nibble >> shift) & 1) === 1);
  }
  return bits;
}

/** The first sixteen characters, in capitals, grouped by four: « 7F3A 91C2 0B4E D2A8 ». */
export function fingerprintPrefix(fingerprint: string): string {
  return parseFingerprint(fingerprint)
    .slice(0, 16)
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * The cells of an n x n grid in reading order: rows of the screen from the top vertex down (i + j constant), each from
 * left to right. Returns [i, j] pairs; i runs down-left from the top vertex, j down-right, so the mirror of (i, j) on the
 * vertical axis is (j, i).
 */
export function readingOrder(n: number): readonly (readonly [number, number])[] {
  const order: [number, number][] = [];
  for (let row = 0; row <= 2 * (n - 1); row += 1) {
    for (let i = Math.min(row, n - 1); i >= Math.max(0, row - (n - 1)); i -= 1) order.push([i, row - i]);
  }
  return order;
}

/** A square grid of cells, set or not. */
export type Grid = readonly (readonly boolean[])[];

/** The cells drawn from bits, on and right of the axis (i <= j), in reading order: 136 at 16 x 16. */
export const FULL_N = 16;
const halfCells = (n: number) => readingOrder(n).filter(([i, j]) => i <= j);

/** The full 16 x 16 grid: every bit folded into its cell, then mirrored on the vertical axis. */
export function fullGrid(fingerprint: string): Grid {
  const bits = fingerprintBits(fingerprint);
  const cells = halfCells(FULL_N);
  const folded = cells.map(() => false);
  bits.forEach((bit, k) => {
    if (bit) folded[k % cells.length] = !folded[k % cells.length];
  });
  const grid = Array.from({ length: FULL_N }, () => Array.from({ length: FULL_N }, () => false));
  cells.forEach(([i, j], c) => {
    (grid[i] as boolean[])[j] = folded[c] === true;
    (grid[j] as boolean[])[i] = folded[c] === true;
  });
  return grid;
}

/** Half the resolution: each cell is set when most of its four are; a tie goes to the top one (it keeps the mirror). */
export function reduce(grid: Grid): Grid {
  const n = grid.length / 2;
  if (!Number.isInteger(n) || n < 1) throw new Error("a grid of one cell cannot be reduced");
  const at = (i: number, j: number): boolean => grid[i]?.[j] === true;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const top = at(2 * i, 2 * j);
      const count = [top, at(2 * i, 2 * j + 1), at(2 * i + 1, 2 * j), at(2 * i + 1, 2 * j + 1)].filter(Boolean).length;
      return count > 2 || (count === 2 && top);
    }),
  );
}

/** The grid shown with n cells per side: the full grid reduced until it is that coarse. */
export function gridAt(fingerprint: string, n: number): Grid {
  let grid = fullGrid(fingerprint);
  while (grid.length > n) grid = reduce(grid);
  return grid;
}

/** The drawing at one level, in the units of its viewBox. */
export interface MarkGeometry {
  readonly size: MarkSize;
  readonly n: number;
  readonly viewBox: string;
  /** The lozenge of the frame, as path data. */
  readonly frame: string;
  readonly stroke: number;
  /** False at 16 px: no cell, and a pending frame stays whole. */
  readonly detailed: boolean;
  /** Every set cell, as one path of small lozenges (empty at 16 px). */
  readonly cells: string;
  /** How many cells are set, of n x n. */
  readonly setCount: number;
}

const num = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

const lozenge = (cx: number, cy: number, r: number): string =>
  `M${num(cx)} ${num(cy - r)}L${num(cx + r)} ${num(cy)}L${num(cx)} ${num(cy + r)}L${num(cx - r)} ${num(cy)}Z`;

/** The geometry of the mark of a fingerprint at a rendered size (its level, levelFor). */
export function fingerprintMark(fingerprint: string, size: number): MarkGeometry {
  const level = levelFor(size);
  const c = level.size / 2;
  const base = { size: level.size, viewBox: `0 0 ${level.size} ${level.size}`, frame: lozenge(c, c, level.frame), stroke: level.stroke, detailed: level.detailed };
  if (!level.detailed) {
    parseFingerprint(fingerprint);
    return { ...base, n: 0, cells: "", setCount: 0 };
  }
  const grid = gridAt(fingerprint, level.n);
  const step = level.grid / level.n;
  const half = step - level.inset;
  // Every cell has the same shape: one move, then the same three relative lines, which compress to almost nothing.
  const shape = `l${num(half)} ${num(half)}l${num(-half)} ${num(half)}l${num(-half)} ${num(-half)}z`;
  let cells = "";
  let setCount = 0;
  for (const [i, j] of readingOrder(level.n)) {
    if (grid[i]?.[j] !== true) continue;
    setCount += 1;
    const x = c + (j - i) * step;
    const y = c - level.grid + (i + j + 1) * step;
    cells += `M${num(x)} ${num(y - half)}${shape}`;
  }
  return { ...base, n: level.n, cells, setCount };
}

/** The two inks of a mark drawn without a stylesheet: on paper, the brand's PAPER_INKS (text for both, or proof). */
export interface MarkInks {
  readonly frame: string;
  readonly cells: string;
}

const INK = /^#[0-9a-fA-F]{6}$/;

/**
 * The mark as a standalone SVG string, for a document that has no stylesheet (the footer of a PDF, L1-071): the print
 * level (64 px, 8 x 8) by default, a closed frame and its cells in the inks given by the caller. No state colour is
 * chosen here: green on paper is the caller's decision, for a document every party signed.
 */
export function fingerprintMarkSvg(fingerprint: string, inks: MarkInks, size: number = PRINT_LEVEL): string {
  if (!INK.test(inks.frame) || !INK.test(inks.cells)) throw new Error("inks are six-digit hexadecimal colours");
  const g = fingerprintMark(fingerprint, size);
  const cells = g.cells === "" ? "" : `<path d="${g.cells}" fill="${inks.cells}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g.viewBox}" width="${g.size}" height="${g.size}"><path d="${g.frame}" fill="none" stroke="${inks.frame}" stroke-width="${g.stroke}" stroke-linejoin="miter"/>${cells}</svg>`;
}
