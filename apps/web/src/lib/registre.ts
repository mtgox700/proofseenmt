import { SOURCE_CATEGORIES, type SourceCategory } from "./answers";

/*
 * The register of the founder's J0 measure (STORYBOARD b.1): one slot per real AI answer, one column per engine, one
 * row per job offer (the target offers, then the control offers under a rule), and in each row one slot per answer.
 *
 * Everything here is computed on the server and reduced to a handful of SVG paths: one path per source category, each
 * run of neighbouring slots of the same category drawn as a single dashed stroke (the dash pattern restarts at every
 * subpath, so a run of n slots shows n slots). No answer object ever reaches the client.
 *
 * Within a row the slots are ordered by category (strongest source first): the row reads as the share of each source
 * for that offer, which is what the figure is for. The counts are untouched.
 */

export interface RegistreAnswer {
  readonly engine: number;
  readonly offer: string;
  readonly control: boolean;
  readonly category: SourceCategory;
}

/** Geometry, in SVG user units. A slot is 4 wide; its height says its category (form, not only tone: WCAG 1.4.11). */
export const GEOMETRY = {
  slot: 4,
  pitch: 5,
  perRow: 20,
  rowPitch: 14,
  rowTop: 6,
  slotHeight: 10,
  /** Extra space between the target offers and the control offers, where the rule between them is drawn. */
  controlGap: 10,
  gutter: 22,
  /** The reading rule overhangs its column by this much on each side, ending on the two stops of the interval. */
  overhang: 3,
  stop: 3,
} as const;

export const COLUMN_WIDTH = GEOMETRY.pitch * GEOMETRY.perRow;

/** Height of a slot by category, bottom-aligned on the row's baseline. "none" is the bare baseline: an empty slot. */
export const SLOT_HEIGHT: Readonly<Record<SourceCategory, number>> = {
  you: 10,
  malt: 10,
  linkedin: 7,
  code: 4,
  platform: 4,
  other: 4,
  none: 1,
};

export interface RegistreRow {
  readonly offer: string;
  readonly control: boolean;
}

export interface RegistrePath {
  readonly category: SourceCategory;
  readonly height: number;
  readonly d: string;
}

export interface Registre {
  readonly width: number;
  readonly height: number;
  /** viewBox, with room for the overhang and the stops of the reading rule. */
  readonly viewBox: string;
  readonly engines: number;
  readonly rows: readonly RegistreRow[];
  readonly targets: number;
  readonly controls: number;
  readonly paths: readonly RegistrePath[];
  /** Head rule, foot rule and the rule between targets and controls, for every column, in one path. */
  readonly frame: string;
  /** One reading rule per column, resting on the foot rule. */
  readonly rules: readonly string[];
  /** Distance from the foot rule up to the head rule (negative: upwards), for the descent of the reading rule. */
  readonly rise: number;
  /** Answers per engine and category: the legend, the table and the founder's line are written from this. */
  readonly counts: readonly Readonly<Record<SourceCategory, number>>[];
  readonly total: number;
}

const emptyCounts = (): Record<SourceCategory, number> =>
  Object.fromEntries(SOURCE_CATEGORIES.map((category) => [category, 0])) as Record<SourceCategory, number>;

const columnLeft = (column: number): number => column * (COLUMN_WIDTH + GEOMETRY.gutter);

/** Top of a row, the target rows first, then the control rows after the gap. */
const rowTop = (row: number, targets: number): number =>
  GEOMETRY.rowTop + row * GEOMETRY.rowPitch + (row >= targets ? GEOMETRY.controlGap : 0);

const baseline = (row: number, targets: number): number => rowTop(row, targets) + GEOMETRY.slotHeight;

/** Offers in their measured order (T01..., then C01...), targets first: the row order of every column. */
const orderRows = (answers: readonly RegistreAnswer[]): RegistreRow[] => {
  const seen = new Map<string, boolean>();
  for (const answer of answers) if (!seen.has(answer.offer)) seen.set(answer.offer, answer.control);
  const rows = [...seen].map(([offer, control]) => ({ offer, control }));
  return [...rows.filter((r) => !r.control), ...rows.filter((r) => r.control)];
};

const round = (value: number): string => String(Math.round(value * 10) / 10);

interface Run {
  readonly category: SourceCategory;
  readonly x: number;
  readonly y: number;
  readonly slots: number;
}

/** The runs of one row of one column: the answers sorted by category, neighbours of a category merged. */
const rowRuns = (cells: readonly SourceCategory[], left: number, base: number): Run[] => {
  const sorted = [...cells].sort((a, b) => SOURCE_CATEGORIES.indexOf(a) - SOURCE_CATEGORIES.indexOf(b));
  const runs: Run[] = [];
  sorted.forEach((category, i) => {
    const last = runs.at(-1);
    if (last !== undefined && last.category === category) {
      runs[runs.length - 1] = { ...last, slots: last.slots + 1 };
      return;
    }
    runs.push({ category, x: left + i * GEOMETRY.pitch, y: base - SLOT_HEIGHT[category] / 2, slots: 1 });
  });
  return runs;
};

const runPath = (run: Run): string => `M${round(run.x)} ${round(run.y)}h${run.slots * GEOMETRY.pitch - (GEOMETRY.pitch - GEOMETRY.slot)}`;

export const buildRegistre = (answers: readonly RegistreAnswer[], engines: number): Registre => {
  const rows = orderRows(answers);
  const targets = rows.filter((r) => !r.control).length;
  const controls = rows.length - targets;
  const rowIndex = new Map(rows.map((r, i) => [r.offer, i]));
  const counts = Array.from({ length: engines }, emptyCounts);
  const cells: SourceCategory[][][] = Array.from({ length: engines }, () => rows.map(() => []));

  for (const answer of answers) {
    const row = rowIndex.get(answer.offer);
    const engine = counts[answer.engine];
    if (row === undefined || engine === undefined) continue;
    engine[answer.category] += 1;
    cells[answer.engine]?.[row]?.push(answer.category);
  }

  const byCategory = new Map<SourceCategory, string[]>();
  cells.forEach((column, c) =>
    column.forEach((row, r) => {
      for (const run of rowRuns(row, columnLeft(c), baseline(r, targets))) {
        byCategory.set(run.category, [...(byCategory.get(run.category) ?? []), runPath(run)]);
      }
    }),
  );
  const paths = SOURCE_CATEGORIES.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    height: SLOT_HEIGHT[category],
    d: (byCategory.get(category) ?? []).join(""),
  }));

  const head = 1;
  const foot = baseline(rows.length - 1, targets) + 5;
  // Halfway between the last target row and the first control row.
  const between = controls > 0 && targets > 0 ? (baseline(targets - 1, targets) + rowTop(targets, targets)) / 2 : null;
  const width = engines * COLUMN_WIDTH + (engines - 1) * GEOMETRY.gutter;
  const frame = Array.from({ length: engines }, (_, c) => {
    const x = columnLeft(c);
    const lines = [head, ...(between === null ? [] : [between]), foot].map((y) => `M${x} ${round(y)}h${COLUMN_WIDTH - 1}`);
    return lines.join("");
  }).join("");
  const rules = Array.from({ length: engines }, (_, c) => {
    const x = columnLeft(c) - GEOMETRY.overhang;
    const span = COLUMN_WIDTH - 1 + 2 * GEOMETRY.overhang;
    const s = GEOMETRY.stop;
    return `M${x} ${foot}h${span}M${x} ${foot - s}v${2 * s}M${x + span} ${foot - s}v${2 * s}`;
  });
  const pad = GEOMETRY.overhang + 1;
  const height = foot + GEOMETRY.stop + 1;

  return {
    width,
    height,
    viewBox: `${-pad} ${-pad} ${width + 2 * pad} ${height + pad}`,
    engines,
    rows,
    targets,
    controls,
    paths,
    frame,
    rules,
    rise: head - foot,
    counts,
    total: answers.length,
  };
};

/** Total of one category across every engine. */
export const categoryTotal = (registre: Registre, category: SourceCategory): number =>
  registre.counts.reduce((sum, engine) => sum + engine[category], 0);
