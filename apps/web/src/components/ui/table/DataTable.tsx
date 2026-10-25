import "@/styles/ui.css";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@/i18n/types";
import type { SearchParams } from "../url";
import { cardPlace, checkColumns, MAX_ROWS, sortHref, sortRows, type Column, type SortState } from "./table-state";

/*
 * DataTable (LEGENDS_P2_CONCEPT §B.7): a real <table> drawn by the server, readable without JavaScript.
 * - <caption>, column headers with scope, a row header; aria-sort on the sorted column.
 * - Sorting is a GET link per header, chosen by the reader and kept in the address (table-state.ts).
 * - The whole row opens its item through one stretched link on the row header, whose text stays its name.
 * - Dense: a row holds on one line of 44 px; one column may give way with an ellipsis (L1-091 K6).
 * - Selection is drawn checkboxes on native inputs, tied to the page's <form> by the form attribute: a batch works
 *   without script; the whole cell is the target.
 * - Empty and error states are part of the table; more than 50 rows is refused: paginate.
 * - On a phone the same rows become cards (QueueCard: reference and deadline, then subject and age) and the sortable
 *   headers give way to a « Trier par » control of the same links (L1-120 R1): one markup, no second copy of the list.
 */

const WORDS = {
  fr: {
    sortAsc: "trier par ordre croissant",
    sortDesc: "trier par ordre décroissant",
    sortedAsc: "trié par ordre croissant",
    sortedDesc: "trié par ordre décroissant",
    sortBy: "Trier par",
    select: "Sélection",
    pages: "Pages de la liste",
    prev: "Page précédente",
    next: "Page suivante",
  },
  en: {
    sortAsc: "sort ascending",
    sortDesc: "sort descending",
    sortedAsc: "sorted ascending",
    sortedDesc: "sorted descending",
    sortBy: "Sort by",
    select: "Selection",
    pages: "Pages of the list",
    prev: "Previous page",
    next: "Next page",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export interface TableSelection<Row> {
  /** The id of the <form> that holds the batch actions; the checkboxes join it wherever it sits on the page. */
  readonly formId: string;
  /** The name the checked values are sent under. */
  readonly name: string;
  /** The accessible name of a row's checkbox: « Sélectionner FR-7H2XK ». */
  readonly label: (row: Row) => string;
}

export interface TablePages {
  readonly prev?: string;
  readonly next?: string;
  /** Where the reader is, in words: « 1 à 3 sur 3 ». */
  readonly summary?: string;
}

export interface DataTableProps<Row> {
  readonly lang: Lang;
  /** Unique on the page: names the caption and the scrolling region. */
  readonly id: string;
  readonly caption: string;
  /** Keeps the caption for screen readers only, when a visible heading already says the same. */
  readonly captionHidden?: boolean;
  readonly columns: readonly Column<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  /** Where a row leads (usually its inspector, `?voir=<id>`). */
  readonly rowHref?: (row: Row) => string;
  /** The key of the row open in the inspector, marked as current. */
  readonly current?: string | null;
  /** The address the sort links build on: the page's path and its awaited searchParams. */
  readonly path: string;
  readonly params: SearchParams;
  /** The sort read from the address (parseSort); null keeps the order the rows came in. */
  readonly sort: SortState | null;
  readonly selection?: TableSelection<Row>;
  /** What an empty list says, and where to go: never a placeholder figure. */
  readonly empty: ReactNode;
  /** When the rows could not be read: said in place of the rows, never as an empty list. */
  readonly error?: ReactNode;
  /** Shown only when there is something to say: a summary, or a page before or after. */
  readonly pages?: TablePages;
}

const classes = (...names: (string | false)[]): string | undefined => names.filter(Boolean).join(" ") || undefined;

function Header<Row>({ column, sort, path, params, lang }: { column: Column<Row>; sort: SortState | null; path: string; params: SearchParams; lang: Lang }) {
  const sorted = sort?.key === column.key ? sort.direction : undefined;
  const className = classes(column.numeric === true && "ui-num", column.truncate === true && "ui-trunc");
  if (column.sortBy === undefined) {
    return (
      <th scope="col" className={className}>
        {column.label}
      </th>
    );
  }
  const next = sorted === "ascending" ? WORDS[lang].sortDesc : WORDS[lang].sortAsc;
  return (
    <th scope="col" className={className} aria-sort={sorted} data-sortable="">
      <Link className="ui-sort" href={sortHref(path, params, column.key, sort)} data-dir={sorted}>
        {column.label}
        <span className="sr-only">{`, ${next}`}</span>
      </Link>
    </th>
  );
}

/**
 * The sort of a phone (L1-120 R1): the cards have no column headers, so the same GET links are offered as « Trier par »,
 * the one in use marked as current and said in words. Hidden from 48 rem, where the headers carry aria-sort.
 */
function SortBar<Row>({ id, columns, sort, path, params, lang }: { id: string; columns: readonly Column<Row>[]; sort: SortState | null; path: string; params: SearchParams; lang: Lang }) {
  const sortable = columns.filter((column) => column.sortBy !== undefined);
  if (sortable.length === 0) return null;
  const words = WORDS[lang];
  return (
    <nav className="ui-sortbar" aria-labelledby={`${id}-sortby`}>
      <p id={`${id}-sortby`} className="ui-sortbar-label">
        {words.sortBy}
      </p>
      <ul>
        {sortable.map((column) => {
          const sorted = sort?.key === column.key ? sort.direction : undefined;
          const state = sorted === undefined ? "" : `, ${sorted === "ascending" ? words.sortedAsc : words.sortedDesc}`;
          return (
            <li key={column.key}>
              <Link className="ui-sort" href={sortHref(path, params, column.key, sort)} data-dir={sorted} aria-current={sorted === undefined ? undefined : "true"}>
                {column.label}
                <span className="sr-only">{`${state}, ${sorted === "ascending" ? words.sortDesc : words.sortAsc}`}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Pager({ lang, pages }: { lang: Lang; pages: TablePages }) {
  if (pages.prev === undefined && pages.next === undefined && pages.summary === undefined) return null;
  return (
    <nav className="ui-pager" aria-label={WORDS[lang].pages}>
      {pages.summary === undefined ? null : <p className="ui-pager-summary">{pages.summary}</p>}
      {pages.prev === undefined ? null : (
        <Link href={pages.prev} rel="prev">
          {WORDS[lang].prev}
        </Link>
      )}
      {pages.next === undefined ? null : (
        <Link href={pages.next} rel="next">
          {WORDS[lang].next}
        </Link>
      )}
    </nav>
  );
}

function Cell<Row>({ column, row, href, isCurrent }: { column: Column<Row>; row: Row; href: string | undefined; isCurrent: boolean }) {
  const content = column.cell(row);
  // The ellipsis hides nothing from a screen reader: the text is whole in the markup, and in a title for the pointer.
  const inner = column.truncate === true && typeof content === "string" ? <span title={content}>{content}</span> : content;
  const body =
    column.rowHeader === true && href !== undefined ? (
      <Link className="ui-row-link" href={href} aria-current={isCurrent ? "true" : undefined}>
        {inner}
      </Link>
    ) : (
      inner
    );
  const className = classes(column.numeric === true && "ui-num", column.truncate === true && "ui-trunc");
  const place = cardPlace(column) ?? undefined;
  return column.rowHeader === true ? (
    <th scope="row" className={className} data-card={place}>
      {body}
    </th>
  ) : (
    <td className={className} data-card={place}>
      {body}
    </td>
  );
}

/** Throws on columns that would rank people, on duplicate keys or places, and on more than 50 rows. */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const { lang, id, caption, captionHidden = false, columns, rowKey, rowHref, current = null, path, params, sort, selection, empty, error, pages } = props;
  checkColumns(columns);
  if (props.rows.length > MAX_ROWS) throw new Error(`a table shows ${MAX_ROWS} rows at most: paginate`);
  const rows = sortRows(props.rows, columns, sort);
  const span = columns.length + (selection === undefined ? 0 : 1);
  const message = error ?? (rows.length === 0 ? empty : null);
  return (
    <div className="ui-table-block">
      <SortBar id={id} columns={columns} sort={sort} path={path} params={params} lang={lang} />
      <div className="ui-table-frame" role="region" aria-labelledby={`${id}-caption`} tabIndex={0}>
        <table className="ui-table" id={id} data-select={selection === undefined ? undefined : ""}>
          <caption id={`${id}-caption`} className={captionHidden ? "sr-only" : "ui-caption"}>
            {caption}
          </caption>
          <thead>
            <tr>
              {selection === undefined ? null : (
                <th scope="col" className="ui-check">
                  <span className="sr-only">{WORDS[lang].select}</span>
                </th>
              )}
              {columns.map((column) => (
                <Header key={column.key} column={column} sort={sort} path={path} params={params} lang={lang} />
              ))}
            </tr>
          </thead>
          <tbody>
            {message === null ? (
              rows.map((row) => {
                const key = rowKey(row);
                const isCurrent = current !== null && key === current;
                return (
                  <tr key={key} data-current={isCurrent ? "" : undefined}>
                    {selection === undefined ? null : (
                      <td className="ui-check">
                        <label className="ui-check-hit">
                          <input type="checkbox" form={selection.formId} name={selection.name} value={key} aria-label={selection.label(row)} />
                          <span className="ui-check-tick" aria-hidden="true" />
                        </label>
                      </td>
                    )}
                    {columns.map((column) => (
                      <Cell key={column.key} column={column} row={row} href={rowHref?.(row)} isCurrent={isCurrent} />
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={span} className={error === undefined ? "ui-table-empty" : "ui-table-error"}>
                  {message}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages === undefined ? null : <Pager lang={lang} pages={pages} />}
    </div>
  );
}
