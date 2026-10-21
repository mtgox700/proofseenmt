/*
 * The drawing of the 404: a register entry whose punch slot is empty. The brand strikes its punch only on what a
 * third party has checked (BRAND_BOOK, section 2); here nothing was found, so nothing is struck, and there is no green
 * on the page. Crop marks aim at the slot and close in once on arrival, then stop: the punch was aimed, never struck.
 *
 * Inline SVG drawn by hand, about 1 KB, no external file, sized by its viewBox (no layout shift). Decorative: the
 * caption next to it says the same thing in words.
 */

const SLOT = { x: 200, y: 48, size: 96, r: 16 } as const;

/** The punch outline: a square whose four corners are bitten by a quarter circle, like the brand cartouche. */
const cartouche = ({ x, y, size, r }: typeof SLOT): string =>
  [
    `M${x + r} ${y}H${x + size - r}`,
    `A${r} ${r} 0 0 0 ${x + size} ${y + r}V${y + size - r}`,
    `A${r} ${r} 0 0 0 ${x + size - r} ${y + size}H${x + r}`,
    `A${r} ${r} 0 0 0 ${x} ${y + size - r}V${y + r}`,
    `A${r} ${r} 0 0 0 ${x + r} ${y}Z`,
  ].join("");

/** Two short strokes at each corner of the slot, a little outside it, as on a print proof. */
const cropMarks = ({ x, y, size }: typeof SLOT): string => {
  const gap = 8;
  const arm = 10;
  const left = x - gap;
  const right = x + size + gap;
  const top = y - gap;
  const bottom = y + size + gap;
  return [
    `M${left} ${top + arm}V${top}H${left + arm}`,
    `M${right - arm} ${top}H${right}V${top + arm}`,
    `M${right} ${bottom - arm}V${bottom}H${right - arm}`,
    `M${left + arm} ${bottom}H${left}V${bottom - arm}`,
  ].join("");
};

/** Placeholder lines of the entry: what was declared, written in ink, without any mark. */
const LINES: readonly (readonly [number, number, number])[] = [
  [24, 28, 56],
  [24, 56, 140],
  [24, 74, 112],
  [24, 118, 128],
  [24, 136, 96],
  [24, 170, 48],
];

export function PunchAbsent() {
  return (
    <svg className="nf-art-svg" viewBox="0 0 320 200" width="320" height="200" aria-hidden="true" focusable="false">
      <rect className="nf-paper" x="0.75" y="0.75" width="318.5" height="198.5" rx="4" />
      {LINES.map(([x, y, width]) => (
        <rect key={`${x}-${y}`} className="nf-ink" x={x} y={y} width={width} height="6" rx="1" />
      ))}
      <path className="nf-rule" d="M24 98H176M80 176H176" />
      <path className="nf-slot" d={cartouche(SLOT)} />
      <path className="nf-aim" d={cropMarks(SLOT)} />
    </svg>
  );
}
