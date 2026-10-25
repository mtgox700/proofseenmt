import { fingerprintMark, gridAt, levelFor, readingOrder, type MarkGeometry } from "@proofseen/brand/fingerprint-mark";

/*
 * The cells of a mark cut into bands, for M1 (storyboard L1.6, §6): the fingerprint of a version that has just been
 * born inks from the top of the lozenge down, in four bands, the way the ink of a punch settles. The drawing is frozen
 * (L1-120): nothing is recomputed here. The one path of cells of `fingerprintMark` is cut where it already is, between
 * its cells, in the reading order it was drawn in (screen rows from the top vertex down); `gridAt` and `readingOrder`
 * of the same module say which screen row each cell sits on. Put back together, the bands are the drawing, exactly.
 */

export const INK_BANDS = 4;

export interface InkedMark {
  readonly geometry: MarkGeometry;
  /** The cells, in INK_BANDS paths from the top band down; an empty band is an empty string. */
  readonly bands: readonly string[];
}

export function markBands(fingerprint: string, size: number): InkedMark {
  const geometry = fingerprintMark(fingerprint, size);
  const bands = Array.from({ length: INK_BANDS }, () => "");
  if (geometry.cells === "") return { geometry, bands };
  const n = levelFor(size).n;
  const grid = gridAt(fingerprint, n);
  const rows = readingOrder(n)
    .filter(([i, j]) => grid[i]?.[j] === true)
    .map(([i, j]) => i + j);
  const cells = geometry.cells.split(/(?=M)/);
  if (cells.length !== rows.length) throw new Error("the cells of the mark are not where its grid says");
  const screenRows = 2 * n - 1;
  cells.forEach((cell, index) => {
    const band = Math.min(INK_BANDS - 1, Math.floor(((rows[index] as number) * INK_BANDS) / screenRows));
    bands[band] += cell;
  });
  return { geometry, bands };
}
