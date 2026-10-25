import type { ReactNode } from "react";
import { hrefWith, PAGE_PARAM, param, type SearchParams } from "../url";

/*
 * The sort of a DataTable: chosen by the person reading it, by a link, kept in the address (`?tri=echeance`, or
 * `?tri=-echeance` for descending). Never chosen by a model, and never on a score of a person (AI Act, CLAUDE.md): a
 * sortable column whose name says it ranks people is refused before anything is drawn.
 */

export const SORT_PARAM = "tri";
/** Beyond this, a list paginates (§B.7: no virtualisation). */
export const MAX_ROWS = 50;

export type SortValue = string | number | Date;

export interface Column<Row> {
  /** Stable name, used in the address when the column is sorted: lower case, digits and dashes. */
  readonly key: string;
  /** The visible header. */
  readonly label: string;
  /** What the cell shows. */
  readonly cell: (row: Row) => ReactNode;
  /** Present when the reader may sort by this column: the value compared (text, number or date). */
  readonly sortBy?: (row: Row) => SortValue;
  /** A number or an amount: aligned to the end, in tabular figures. */
  readonly numeric?: boolean;
  /** The cell that names the row (a reference, never a person's name first): a row header, and the row's link. */
  readonly rowHeader?: boolean;
  /**
   * The one column that gives way: one line, cut with an ellipsis, its whole text in a title and in the inspector
   * (L1-091 K6: a line of a queue holds on one line). The other cells never wrap.
   */
  readonly truncate?: boolean;
  /**
   * Where the cell goes in the card a row becomes on a phone (QueueCard, §B.7): « label » above, in the trace face (the
   * queue, L1-120 R1); « title » and « end » on the first line; « body » and « aside » on the second. A column without
   * a place is left to the inspector. The row header is the title.
   */
  readonly card?: CardPlace;
}

export type CardPlace = "label" | "title" | "end" | "body" | "aside";

/** The place of a column in the phone card: the row header is the title unless placed otherwise. */
export function cardPlace<Row>(column: Column<Row>): CardPlace | null {
  return column.card ?? (column.rowHeader === true ? "title" : null);
}

export type SortDirection = "ascending" | "descending";
export interface SortState {
  readonly key: string;
  readonly direction: SortDirection;
}

const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Words that name a ranking of people: a column so named may be shown, never sorted. */
const RANKING = /\b(?:score|scoring|rank|ranking|rang|classement|rating|notation|note)s?\b/i;

/** Checks the columns once per render: keys are address-safe and unique, one row header at most, no ranking sort. */
export function checkColumns<Row>(columns: readonly Column<Row>[]): void {
  if (columns.length === 0) throw new Error("a table needs at least one column");
  const keys = new Set<string>();
  for (const column of columns) {
    if (!KEY.test(column.key)) throw new Error(`column key "${column.key}" must be lower case letters, digits and dashes`);
    if (keys.has(column.key)) throw new Error(`column key "${column.key}" is used twice`);
    keys.add(column.key);
    if (column.label.trim() === "") throw new Error(`column "${column.key}" needs a visible header`);
    if (column.sortBy !== undefined && (RANKING.test(column.key) || RANKING.test(column.label))) {
      throw new Error(`column "${column.key}" ranks people: it may be shown, never sorted (AI Act)`);
    }
  }
  if (columns.filter((column) => column.rowHeader === true).length > 1) throw new Error("a table has one row header column at most");
  if (columns.filter((column) => column.truncate === true).length > 1) throw new Error("one column at most gives way");
  const places = columns.map(cardPlace).filter((place) => place !== null);
  if (new Set(places).size !== places.length) throw new Error("each place of the phone card holds one column");
}

/** The sort asked for in the address, if it names a sortable column; anything else is ignored. */
export function parseSort<Row>(params: SearchParams, columns: readonly Column<Row>[]): SortState | null {
  const raw = param(params, SORT_PARAM);
  if (raw === null) return null;
  const descending = raw.startsWith("-");
  const key = descending ? raw.slice(1) : raw;
  const column = columns.find((c) => c.key === key);
  if (column?.sortBy === undefined) return null;
  return { key, direction: descending ? "descending" : "ascending" };
}

/** The address a header links to: ascending first, then it flips; the page goes back to the first. */
export function sortHref(path: string, params: SearchParams, key: string, current: SortState | null): string {
  const descending = current?.key === key && current.direction === "ascending";
  return hrefWith(path, params, { [SORT_PARAM]: descending ? `-${key}` : key, [PAGE_PARAM]: null });
}

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

function compare(a: SortValue, b: SortValue): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a instanceof Date ? a.toISOString() : a), String(b instanceof Date ? b.toISOString() : b));
}

/** The rows in the order the reader chose; a stable sort, so equal rows keep the order they came in. */
export function sortRows<Row>(rows: readonly Row[], columns: readonly Column<Row>[], sort: SortState | null): readonly Row[] {
  const by = sort === null ? undefined : columns.find((c) => c.key === sort.key)?.sortBy;
  if (sort === null || by === undefined) return rows;
  const sign = sort.direction === "ascending" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: by(row) }))
    .sort((a, b) => sign * compare(a.value, b.value) || a.index - b.index)
    .map(({ row }) => row);
}
