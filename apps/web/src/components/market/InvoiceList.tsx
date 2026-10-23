import type { InvoiceRecord } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import { day, money } from "@/lib/format";

interface InvoiceListProps {
  readonly lang: Lang;
  readonly d: DealsDictionary["invoices"];
  readonly invoices: readonly InvoiceRecord[];
  readonly headingLevel: 2 | 3;
}

/** Invoices as a table: number, kind, issuer, date, total, and the two documents (readable page, structured XML). */
export function InvoiceList({ lang, d, invoices, headingLevel }: InvoiceListProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="ws-block" aria-labelledby="invoices-title">
      <Heading id="invoices-title">{d.title}</Heading>
      <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="invoices-title">
        <table className="ops">
          <thead>
            <tr>
              <th scope="col">{d.number}</th>
              <th scope="col">{d.issuedOn}</th>
              <th scope="col" className="num-col">
                {d.total}
              </th>
              <th scope="col">
                <span className="sr-only">{d.open}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <th scope="row">
                  <code>{invoice.number}</code>
                  <span className="muted small"> · {d.kinds[invoice.kind]} · {invoice.seller.legalName}</span>
                </th>
                <td>{day(invoice.issuedAt, lang)}</td>
                <td className="num num-col">{money(invoice.totalCents, invoice.currency, lang)}</td>
                <td>
                  <a className="invoice-link" href={`/api/invoices/${invoice.id}`}>
                    {d.open}
                  </a>{" "}
                  ·{" "}
                  <a className="invoice-link" href={`/api/invoices/${invoice.id}?format=cii`}>
                    {d.xml}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
