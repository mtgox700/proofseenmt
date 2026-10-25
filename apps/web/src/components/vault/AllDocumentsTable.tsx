import "@/styles/vault.css";
import type { DocumentSummary } from "@proofseen/db";
import { FilterBar, type FilterField } from "@/components/ui/filter/FilterBar";
import { DataTable } from "@/components/ui/table/DataTable";
import type { Column, SortState } from "@/components/ui/table/table-state";
import { hrefWith, PAGE_PARAM, type SearchParams } from "@/components/ui/url";
import { machineDate, writtenDate } from "@/components/ui/when";
import type { Lang } from "@/i18n/types";
import { SEP } from "@/i18n/market/vault-fr";
import { vaultText } from "@/lib/vault/dictionary";
import { authorLabel } from "@/lib/vault/versions";
import { VaultStamp } from "./VaultStamp";

/*
 * E6, « Tous mes documents » (storyboard L1.6, §4 E6): the DataTable of the Tower over `documents(db).listMine`, its
 * state in the address (sort, filters, page), readable without a script; on a phone the rows become cards: the
 * fingerprint above, then the document and its version, then who filed it and when. Sorted by the date of filing,
 * never by a person (the primitive refuses a ranking column anyway).
 */

export const SORT_KEY = "depose";

export interface AllDocumentsTableProps {
  readonly lang: Lang;
  readonly path: string;
  readonly params: SearchParams;
  readonly items: readonly DocumentSummary[];
  /** The counterpart of each contract the person is a party of, to name a document's affair. */
  readonly affairName: (document: DocumentSummary) => string | null;
  readonly types: readonly string[];
  readonly sort: SortState;
  readonly total: number;
  readonly page: number;
  readonly pages: number;
  readonly pageSize: number;
  readonly filtered: boolean;
  readonly error: boolean;
}

export function AllDocumentsTable(props: AllDocumentsTableProps) {
  const { lang, path, params, items, affairName, types, sort, total, page, pages, pageSize, filtered, error } = props;
  const t = vaultText(lang);
  const a = t.all;
  const typeName = (type: string) => t.card.types[type as keyof typeof t.card.types] ?? type;
  const columns: readonly Column<DocumentSummary>[] = [
    {
      key: "document",
      label: a.columns.document,
      rowHeader: true,
      cell: (row) => {
        const name = affairName(row);
        return name === null ? typeName(row.type) : `${typeName(row.type)}${SEP}${name}`;
      },
    },
    {
      key: "version",
      label: a.columns.version,
      numeric: true,
      card: "end",
      cell: (row) => (
        <>
          <span className="vault-phone-only">{`${a.columns.version} `}</span>
          {row.latest?.number ?? 0}
        </>
      ),
    },
    {
      key: "empreinte",
      label: a.columns.digest,
      card: "label",
      cell: (row) => (row.latest === null ? null : <VaultStamp lang={lang} contentDigest={row.latest.contentDigest} size={16} subject={t.card.subject(row.type, row.latest.number)} />),
    },
    {
      key: SORT_KEY,
      label: a.columns.filed,
      numeric: true,
      card: "aside",
      sortBy: (row) => row.latest?.createdAt ?? row.createdAt,
      cell: (row) => {
        const at = row.latest?.createdAt ?? row.createdAt;
        return <time dateTime={machineDate(at, "minute")}>{writtenDate(at, lang, "day")}</time>;
      },
    },
    {
      key: "par",
      label: a.columns.by,
      card: "body",
      cell: (row) =>
        row.latest === null ? null : (
          <>
            <span className="vault-phone-only">{`${a.columns.by.toLocaleLowerCase(lang)} `}</span>
            {authorLabel(row.latest, t.who)}
          </>
        ),
    },
  ];
  const fields: readonly FilterField[] = [
    { kind: "select", name: "sorte", label: a.filters.type, anyLabel: a.filters.typeAny, options: types.map((type) => ({ value: type, label: typeName(type) })) },
    { kind: "select", name: "par", label: a.filters.by, anyLabel: a.filters.byAny, options: [{ value: "vous", label: a.filters.you }, { value: "autre", label: a.filters.other }] },
  ];
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const empty = filtered ? (
    <p>
      {a.emptyFiltered}{" "}
      <a href={hrefWith(path, params, { sorte: null, par: null, [PAGE_PARAM]: null })}>{a.clear}</a>
    </p>
  ) : (
    <>
      <p>{a.empty.title}</p>
      <p>{a.empty.body}</p>
    </>
  );
  return (
    <div className="vault-section">
      <FilterBar lang={lang} id="docs-filtres" path={path} params={params} fields={fields} keep={["tri"]} />
      <DataTable
        lang={lang}
        id="docs"
        caption={sort.direction === "ascending" ? a.captionOldest : a.caption}
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        rowHref={(row) => `/${lang}/app/documents/${row.id}`}
        path={path}
        params={params}
        sort={sort}
        empty={empty}
        error={error ? t.errors.server : undefined}
        pages={{
          ...(total === 0 ? {} : { summary: a.range(first, last, total) }),
          ...(page > 1 ? { prev: hrefWith(path, params, { [PAGE_PARAM]: String(page - 1) }) } : {}),
          ...(page < pages ? { next: hrefWith(path, params, { [PAGE_PARAM]: String(page + 1) }) } : {}),
        }}
      />
    </div>
  );
}
