import type { Lang } from "@/i18n";
import { count } from "@/lib/format";

interface CountsTableProps {
  readonly id: string;
  readonly lang: Lang;
  readonly title: string;
  readonly labelHeader: string;
  readonly countHeader: string;
  /** In the order to show; a status with no row is shown at zero. */
  readonly rows: readonly { readonly key: string; readonly label: string; readonly value: number }[];
}

/** Counts by stage, as a small table: every stage listed, zeros included, in the order of the process. */
export function CountsTable({ id, lang, title, labelHeader, countHeader, rows }: CountsTableProps) {
  return (
    <div className="insight-block">
      <h3 id={id}>{title}</h3>
      <table className="ops" aria-labelledby={id}>
        <thead>
          <tr>
            <th scope="col">{labelHeader}</th>
            <th scope="col" className="num-col">
              {countHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td className="num num-col">{count(row.value, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rows for a closed vocabulary of statuses, labelled, zeros included. */
export const statusRows = <K extends string>(order: readonly K[], labels: Readonly<Record<K, string>>, counts: Readonly<Partial<Record<K, number>>>) =>
  order.map((key) => ({ key, label: labels[key], value: counts[key] ?? 0 }));
