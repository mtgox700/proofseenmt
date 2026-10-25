import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeChips, clearHref, fieldValue, FilterBar, type FilterField } from "../src/components/ui/filter/FilterBar";
import { DataTable, type DataTableProps } from "../src/components/ui/table/DataTable";
import { cardPlace, checkColumns, parseSort, sortHref, sortRows, type Column } from "../src/components/ui/table/table-state";
import { hrefWith, param } from "../src/components/ui/url";

/*
 * The list primitives of the Tower (LEGENDS_P2_CONCEPT §B.7): DataTable and FilterBar, drawn by the server, whose whole
 * state is the address. Example rows only: references in the shape of the product, no real person or amount.
 */

const NARROW = String.fromCharCode(0x202f);
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "styles", "ui.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

interface Item {
  readonly id: string;
  readonly ref: string;
  readonly queue: string;
  readonly subject: string;
  readonly waitingHours: number;
  readonly due: Date;
}

const ITEMS: readonly Item[] = [
  { id: "a1", ref: "FR-EX010", queue: "Attestations", subject: "Attestation URSSAF déclarée", waitingHours: 5, due: new Date("2026-10-30T09:00:00Z") },
  { id: "b2", ref: "FR-EX002", queue: "Litiges", subject: "Litige de paiement ouvert", waitingHours: 72, due: new Date("2026-10-26T09:00:00Z") },
  { id: "c3", ref: "FR-EX003", queue: "Attestations", subject: "Attestation URSSAF déclarée", waitingHours: 5, due: new Date("2026-11-02T09:00:00Z") },
];

const COLUMNS: readonly Column<Item>[] = [
  { key: "ref", label: "Référence", cell: (r) => r.ref, sortBy: (r) => r.ref, rowHeader: true },
  { key: "file", label: "File", cell: (r) => r.queue },
  { key: "sujet", label: "Sujet", cell: (r) => r.subject, truncate: true, card: "body" },
  { key: "attente", label: "Attente (h)", cell: (r) => String(r.waitingHours), sortBy: (r) => r.waitingHours, numeric: true, card: "aside" },
  { key: "echeance", label: "Échéance", cell: (r) => r.due.toISOString().slice(0, 10), sortBy: (r) => r.due, numeric: true, card: "end" },
];

const table = (overrides: Partial<DataTableProps<Item>> = {}): string =>
  renderToStaticMarkup(
    createElement(DataTable<Item>, {
      lang: "fr",
      id: "file",
      caption: "Éléments en attente",
      columns: COLUMNS,
      rows: ITEMS,
      rowKey: (r) => r.id,
      path: "/fr/app/operateur",
      params: { q: "attest" },
      sort: null,
      empty: "Rien n'attend.",
      ...overrides,
    }),
  );

const order = (html: string): string[] => [...html.matchAll(/>(FR-EX\d{3})</g)].map((m) => m[1] as string);

describe("the address holds the view", () => {
  it("reads the first value of a parameter, trimmed, and treats an empty one as absent", () => {
    expect(param({ q: ["  a ", "b"] }, "q")).toBe("a");
    expect(param({ q: "   " }, "q")).toBeNull();
    expect(param({}, "q")).toBeNull();
  });

  it("changes some parameters and keeps the others in their order, repeated ones included", () => {
    expect(hrefWith("/p", { a: "1", t: ["x", "y"], b: "2" }, { a: null, c: "3" })).toBe("/p?t=x&t=y&b=2&c=3");
    expect(hrefWith("/p", { q: "" }, {})).toBe("/p");
    expect(hrefWith("/p", { q: "a b" }, { voir: "x" })).toBe("/p?q=a+b&voir=x");
  });
});

describe("the sort is chosen by the reader, never on a score of a person", () => {
  it("refuses a sortable column that ranks people, but lets it be shown", () => {
    const rank = (label: string, key = "k"): Column<Item>[] => [{ key, label, cell: () => "", sortBy: () => 0 }];
    for (const label of ["Score", "Classement", "Note", "Rating", "Rang"]) expect(() => checkColumns(rank(label)), label).toThrow(/ranks people/);
    expect(() => checkColumns(rank("Profil", "score-ia"))).toThrow(/ranks people/);
    expect(() => checkColumns([{ key: "note", label: "Note", cell: () => "" }])).not.toThrow();
  });

  it("refuses unsafe or repeated keys, an empty header, two row headers, two giving columns, two cells in one card place", () => {
    expect(() => checkColumns([{ key: "Bad Key", label: "x", cell: () => "" }])).toThrow(/lower case/);
    expect(() => checkColumns([...COLUMNS, COLUMNS[0] as Column<Item>])).toThrow(/used twice/);
    expect(() => checkColumns([{ key: "x", label: " ", cell: () => "" }])).toThrow(/visible header/);
    expect(() => checkColumns([{ key: "a", label: "A", cell: () => "", rowHeader: true }, { key: "b", label: "B", cell: () => "", rowHeader: true }])).toThrow(/one row header/);
    expect(() => checkColumns([{ key: "a", label: "A", cell: () => "", truncate: true }, { key: "b", label: "B", cell: () => "", truncate: true }])).toThrow(/gives way/);
    expect(() => checkColumns([{ key: "a", label: "A", cell: () => "", card: "end" }, { key: "b", label: "B", cell: () => "", card: "end" }])).toThrow(/one column/);
    expect(() => checkColumns([])).toThrow();
    expect(COLUMNS.map(cardPlace)).toEqual(["title", null, "body", "aside", "end"]);
  });

  it("reads the sort from the address only when it names a sortable column", () => {
    expect(parseSort({ tri: "echeance" }, COLUMNS)).toEqual({ key: "echeance", direction: "ascending" });
    expect(parseSort({ tri: "-attente" }, COLUMNS)).toEqual({ key: "attente", direction: "descending" });
    expect(parseSort({ tri: "file" }, COLUMNS)).toBeNull();
    expect(parseSort({ tri: "<script>" }, COLUMNS)).toBeNull();
    expect(parseSort({}, COLUMNS)).toBeNull();
  });

  it("links a header to ascending first, then flips, and goes back to the first page", () => {
    const params = { q: "attest", page: "3" };
    expect(sortHref("/p", params, "echeance", null)).toBe("/p?q=attest&tri=echeance");
    expect(sortHref("/p", params, "echeance", { key: "echeance", direction: "ascending" })).toBe("/p?q=attest&tri=-echeance");
    expect(sortHref("/p", params, "echeance", { key: "echeance", direction: "descending" })).toBe("/p?q=attest&tri=echeance");
  });

  it("sorts text naturally, numbers and dates by value, and keeps equal rows in their order", () => {
    expect(sortRows(ITEMS, COLUMNS, { key: "ref", direction: "ascending" }).map((r) => r.ref)).toEqual(["FR-EX002", "FR-EX003", "FR-EX010"]);
    expect(sortRows(ITEMS, COLUMNS, { key: "attente", direction: "ascending" }).map((r) => r.id)).toEqual(["a1", "c3", "b2"]);
    expect(sortRows(ITEMS, COLUMNS, { key: "attente", direction: "descending" }).map((r) => r.id)).toEqual(["b2", "a1", "c3"]);
    expect(sortRows(ITEMS, COLUMNS, { key: "echeance", direction: "descending" }).map((r) => r.id)).toEqual(["c3", "a1", "b2"]);
    expect(sortRows(ITEMS, COLUMNS, null)).toBe(ITEMS);
  });
});

describe("DataTable", () => {
  it("is a real table: caption, column headers with scope, a row header, in a labelled region the keyboard can scroll", () => {
    const html = table();
    expect(html).toContain('<div class="ui-table-frame" role="region" aria-labelledby="file-caption" tabindex="0">');
    expect(html).toContain('<caption id="file-caption" class="ui-caption">Éléments en attente</caption>');
    expect(html.match(/<th scope="col"/g)).toHaveLength(5);
    expect(html.match(/<th scope="row" data-card="title">FR-EX\d{3}<\/th>/g)).toHaveLength(3);
    expect(html).toContain('<td class="ui-num" data-card="aside">72</td>');
    expect(table({ captionHidden: true })).toContain('<caption id="file-caption" class="sr-only">');
  });

  it("keeps the rows in the order they came in until the reader sorts", () => {
    expect(order(table())).toEqual(["FR-EX010", "FR-EX002", "FR-EX003"]);
    expect(table()).not.toContain("aria-sort");
  });

  it("sorts by a GET link, says so with aria-sort on that column only, and announces what the next click does", () => {
    const html = table({ sort: { key: "echeance", direction: "ascending" } });
    expect(order(html)).toEqual(["FR-EX002", "FR-EX010", "FR-EX003"]);
    expect(html.match(/aria-sort=/g)).toHaveLength(1);
    expect(html).toContain(
      '<th scope="col" class="ui-num" aria-sort="ascending" data-sortable=""><a class="ui-sort" data-dir="ascending" href="/fr/app/operateur?q=attest&amp;tri=-echeance">Échéance<span class="sr-only">, trier par ordre décroissant</span></a></th>',
    );
    expect(html).toContain('href="/fr/app/operateur?q=attest&amp;tri=ref"');
    // A column without sortBy is a plain header.
    expect(html).toContain('<th scope="col">File</th>');
  });

  it("shows the sort arrow of the sorted column only; another shows it under the pointer or the focus (K8)", () => {
    expect(css).toMatch(/\.ui-sort::after \{[^}]*border-block-start: 0\.3rem solid transparent;/);
    expect(css).toMatch(/\.ui-sort:focus-visible::after \{ border-block-start-color: var\(--ps-line-strong\); \}/);
    expect(css).toMatch(/\.ui-sort\[data-dir="ascending"\]::after \{[^}]*var\(--ps-text\)/);
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{[^@]*\.ui-sort:not\(\[data-dir\]\):hover::after/);
  });

  it("holds each row on one line: nothing wraps, the one giving column ends in an ellipsis, its text whole in a title (K1, K6)", () => {
    const html = table();
    expect(html).toContain('<td class="ui-trunc" data-card="body"><span title="Litige de paiement ouvert">Litige de paiement ouvert</span></td>');
    expect(css).toMatch(/\.ui-table th, \.ui-table td \{[^}]*white-space: nowrap;/);
    expect(css).toMatch(/\.ui-table \.ui-trunc \{[^}]*text-overflow: ellipsis;/);
    expect(css).toMatch(/\.ui-table \.ui-num \{[^}]*text-align: end; font-variant-numeric: tabular-nums/);
    // A row of 44 px: 11 px above and below a line of the small step.
    expect(css).toMatch(/\.ui-table th, \.ui-table td \{ padding: 0\.6875rem/);
  });

  it("opens a row through one stretched link on its row header, and marks the row open in the inspector", () => {
    const html = table({ rowHref: (r) => `/fr/app/operateur?voir=${r.id}`, current: "b2" });
    expect(html.match(/class="ui-row-link"/g)).toHaveLength(3);
    expect(html).toContain('<tr data-current=""><th scope="row" data-card="title"><a class="ui-row-link" aria-current="true" href="/fr/app/operateur?voir=b2">FR-EX002</a></th>');
    expect(html.match(/data-current/g)).toHaveLength(1);
  });

  it("selects with drawn boxes on native checkboxes tied to the page's form; the whole cell is the target (K3)", () => {
    const html = table({ selection: { formId: "lot", name: "ids", label: (r) => `Sélectionner ${r.ref}` } });
    expect(html).toContain('<table class="ui-table" id="file" data-select="">');
    expect(html).toContain('<th scope="col" class="ui-check"><span class="sr-only">Sélection</span></th>');
    expect(html).toContain(
      '<td class="ui-check"><label class="ui-check-hit"><input type="checkbox" form="lot" aria-label="Sélectionner FR-EX002" name="ids" value="b2"/><span class="ui-check-tick" aria-hidden="true"></span></label></td>',
    );
    expect(css).toMatch(/\.ui-check-hit \{[^}]*min-width: 2\.75rem; min-height: 2\.75rem;/);
    expect(css).toMatch(/\.ui-check-hit input \{[^}]*appearance: none;[^}]*border: 1\.5px solid var\(--ps-line-strong\)/);
    expect(css).toMatch(/\.ui-check-hit input:checked \{ background: var\(--ps-aura\);/);
  });

  it("becomes a card on a phone, the same markup: its queue as a label, reference and deadline, subject and age (K11, R1)", () => {
    const phone = /@media \(max-width: 47\.99rem\) \{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf(".ui-table-block")))?.[1] ?? "";
    expect(phone).toContain('grid-template-areas: "label label" "title end" "body aside"');
    expect(phone).toContain(".ui-table tbody tr > [data-card] { display: block; }");
    // No column headers over cards that have no columns: the « Trier par » control stands in.
    expect(phone).toContain(".ui-table thead { display: none; }");
    expect(phone).toContain(".ui-sortbar { display: flex;");
    expect(css).toMatch(/^\.ui-sortbar \{ display: none; \}/m);
    const labelled = renderToStaticMarkup(
      createElement(DataTable<Item>, { lang: "fr", id: "q", caption: "File", columns: COLUMNS.map((c) => (c.key === "file" ? { ...c, card: "label" as const } : c)), rows: ITEMS, rowKey: (r) => r.id, path: "/p", params: {}, sort: null, empty: "Rien." }),
    );
    expect(labelled).toContain('<td data-card="label">Litiges</td>');
    expect(table().match(/data-card="/g)).toHaveLength(12);
  });

  it("offers the same sort as « Trier par » on a phone: the same GET links, the one in use current and said in words (R1)", () => {
    const html = table({ sort: { key: "echeance", direction: "ascending" } });
    expect(html).toContain('<nav class="ui-sortbar" aria-labelledby="file-sortby"><p id="file-sortby" class="ui-sortbar-label">Trier par</p><ul>');
    expect(html).toContain(
      '<li><a class="ui-sort" data-dir="ascending" aria-current="true" href="/fr/app/operateur?q=attest&amp;tri=-echeance">Échéance<span class="sr-only">, trié par ordre croissant, trier par ordre décroissant</span></a></li>',
    );
    expect(html).toContain('<li><a class="ui-sort" href="/fr/app/operateur?q=attest&amp;tri=ref">Référence<span class="sr-only">, trier par ordre croissant</span></a></li>');
    // Only the sortable columns: « File » and « Sujet » are not offered.
    expect(/<nav class="ui-sortbar"[\s\S]*?<\/nav>/.exec(html)?.[0].match(/<li>/g)).toHaveLength(3);
  });

  it("gives the remaining width to the one column that gives way, its content width to every other (R4)", () => {
    expect(css).toMatch(/\.ui-table :is\(th, td\) \{ width: 1%; \}/);
    expect(css).toMatch(/\.ui-table \.ui-trunc \{ width: 100%; max-width: 0;/);
  });

  it("says when it is empty, and says an error in place of the rows, across every column", () => {
    expect(table({ rows: [] })).toContain('<td colSpan="5" class="ui-table-empty">Rien n&#x27;attend.</td>');
    const failed = table({ error: "La liste n'a pas pu être lue.", selection: { formId: "lot", name: "ids", label: (r) => r.ref } });
    expect(failed).toContain('<td colSpan="6" class="ui-table-error">');
    expect(order(failed)).toEqual([]);
  });

  it("paginates beyond fifty rows, says where the reader is, and offers a next page only when there is one (K7)", () => {
    const many = Array.from({ length: 51 }, (_, k) => ({ ...(ITEMS[0] as Item), id: `r${k}`, ref: `FR-EX${String(k).padStart(3, "0")}` }));
    expect(() => table({ rows: many })).toThrow(/50 rows at most/);
    expect(table({ pages: { prev: "/p?page=1", next: "/p?page=3", summary: "51 à 100 sur 140" } })).toContain(
      '<nav class="ui-pager" aria-label="Pages de la liste"><p class="ui-pager-summary">51 à 100 sur 140</p><a rel="prev" href="/p?page=1">Page précédente</a><a rel="next" href="/p?page=3">Page suivante</a></nav>',
    );
    const single = table({ pages: { summary: "1 à 3 sur 3" } });
    expect(single).toContain('<p class="ui-pager-summary">1 à 3 sur 3</p></nav>');
    expect(single).not.toContain("rel=");
    expect(table({ pages: {} })).not.toContain("ui-pager");
  });

  it("speaks English in English", () => {
    const html = table({ lang: "en", sort: { key: "ref", direction: "descending" } });
    expect(html).toContain(", sort ascending</span>");
  });
});

describe("FilterBar", () => {
  const FIELDS: readonly FilterField[] = [
    { kind: "search", name: "q", label: "Recherche", hint: "Une référence, par exemple FR-EX001" },
    {
      kind: "select",
      name: "type",
      label: "Type",
      options: [
        { value: "contrat", label: "Contrat" },
        { value: "devis", label: "Devis" },
      ],
    },
  ];
  const bar = (params: Record<string, string>, extra: object = {}): string =>
    renderToStaticMarkup(createElement(FilterBar, { lang: "fr", id: "f", path: "/fr/app/coffre", params, fields: FIELDS, ...extra }));

  it("is a GET search form whose fields are labelled, so it filters without JavaScript", () => {
    const html = bar({});
    expect(html).toContain('<form class="ui-filter-form" role="search" aria-label="Filtres" action="/fr/app/coffre" method="get">');
    expect(html).toContain('<label for="f-type">Type</label><select id="f-type" name="type">');
    expect(html).not.toContain("ui-chips");
  });

  it("puts an example under its field, described to screen readers, never as a placeholder that reads like a value (K16)", () => {
    const html = bar({});
    expect(html).toContain('<input id="f-q" type="search" autoComplete="off" aria-describedby="f-q-hint" name="q" value=""/><p id="f-q-hint" class="ui-hint">Une référence, par exemple FR-EX001</p>');
    expect(html).not.toContain("placeholder");
  });

  it("accepts only a select's own options from the address", () => {
    expect(fieldValue(FIELDS[1] as FilterField, { type: "devis" })).toBe("devis");
    expect(fieldValue(FIELDS[1] as FilterField, { type: "autre" })).toBeNull();
    expect(bar({ type: "autre" })).not.toContain("ui-chip");
  });

  it("writes each active filter as a chip that removes it, with the narrow space before the colon (K14)", () => {
    const params = { q: "nda", type: "contrat", tri: "-date", page: "2" };
    const chips = activeChips(FIELDS, params, "/p", "fr");
    expect(chips).toEqual([
      { name: "q", text: `Recherche${NARROW}: «${NARROW}nda${NARROW}»`, removeHref: "/p?type=contrat&tri=-date" },
      { name: "type", text: `Type${NARROW}: Contrat`, removeHref: "/p?q=nda&tri=-date" },
    ]);
    expect(clearHref(FIELDS, params, "/p")).toBe("/p?tri=-date");
    const html = bar(params);
    expect(html).toContain(`Type${NARROW}: Contrat<span class="sr-only">, retirer ce filtre</span>`);
    expect(html).toContain('<ul aria-label="Filtres actifs">');
    expect(html).toContain('class="ui-chips-clear" href="/fr/app/coffre?tri=-date">Tout effacer</a>');
    expect(activeChips(FIELDS, { q: "nda" }, "/p", "en")[0]?.text).toBe('Recherche: "nda"');
  });

  it("carries the sort through a new search, and names the saved view in use", () => {
    const html = bar({ tri: "-date" }, { keep: ["tri", "q"], views: [{ label: "À signer", href: "/fr/app/coffre?etat=a-signer", current: true }, { label: "Tout", href: "/fr/app/coffre" }] });
    expect(html).toContain('<input type="hidden" name="tri" value="-date"/>');
    expect(html).not.toContain('type="hidden" name="q"');
    expect(html).toContain('<nav class="ui-views" aria-label="Vues enregistrées">');
    expect(html).toContain('<a aria-current="page" href="/fr/app/coffre?etat=a-signer">À signer</a>');
    expect(html).toContain('<a href="/fr/app/coffre">Tout</a>');
  });
});
