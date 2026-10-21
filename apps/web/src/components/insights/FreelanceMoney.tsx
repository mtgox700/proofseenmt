import type { FreelanceDashboard, FreelanceInsights } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { AccountDictionary } from "@/i18n/market/account-fr";
import type { InsightsDictionary } from "@/i18n/market/insights-fr";
import { seriesSummary } from "@/lib/chart";
import { colon, count, money } from "@/lib/format";
import { BarChart } from "./BarChart";
import { FactList } from "./FactList";
import { longMonth, shortMonth } from "./labels";

interface FreelanceMoneyProps {
  readonly lang: Lang;
  readonly d: InsightsDictionary;
  readonly b: AccountDictionary["dashboard"];
  readonly board: FreelanceDashboard;
  readonly revenue: FreelanceInsights["revenue"];
}

/** What was paid out and what is held, in total and month by month; invoices and reviews. Zeros are shown as zeros. */
export function FreelanceMoney({ lang, d, b, board, revenue }: FreelanceMoneyProps) {
  const m = d.money;
  const facts = [
    {
      label: b.received,
      value: board.money === null ? b.noMoneyValue : money(board.money.receivedCents, board.money.currency, lang),
      foot: board.money === null ? b.noMoney : `${money(board.money.heldCents, board.money.currency, lang)} ${b.held}`,
    },
    { label: m.invoices, value: count(board.invoices, lang) },
    { label: m.reviews, value: count(board.reviews, lang) },
  ];
  return (
    <section className="ws-block" aria-labelledby="money-title">
      <h2 id="money-title">{m.title}</h2>
      <p className="muted small measure">{m.lead}</p>
      <FactList facts={facts} />
      {revenue === null ? (
        <p className="muted">{m.severalCurrencies}</p>
      ) : (
        <MonthlyRevenue lang={lang} d={d} revenue={revenue} />
      )}
    </section>
  );
}

function MonthlyRevenue({ lang, d, revenue }: { readonly lang: Lang; readonly d: InsightsDictionary; readonly revenue: NonNullable<FreelanceInsights["revenue"]> }) {
  const m = d.money;
  const amount = (cents: number): string => money(cents, revenue.currency, lang);
  const points = revenue.months.map((month) => ({ label: longMonth(month.month, lang), value: month.receivedCents }));
  const { total, peak } = seriesSummary(points);
  return (
    <>
      <BarChart
        lang={lang}
        id="revenue-chart"
        title={m.chartLabel}
        figure={amount(total)}
        summary={`${m.chartLabel}${colon(lang)}${amount(total)}${peak === null ? "" : ` (${peak.label}${colon(lang)}${amount(peak.value)})`}`}
        points={points}
        format={amount}
        firstLabel={shortMonth(revenue.months[0]?.month ?? "", lang)}
        lastLabel={shortMonth(revenue.months.at(-1)?.month ?? "", lang)}
      />
      <div className="table-scroll" tabIndex={0} role="region" aria-label={m.caption}>
        <table className="ops">
          <caption className="sr-only">{m.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{m.month}</th>
              <th scope="col" className="num-col">
                {m.received}
              </th>
              <th scope="col" className="num-col">
                {m.held}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...revenue.months].reverse().map((month) => (
              <tr key={month.month}>
                <th scope="row">{longMonth(month.month, lang)}</th>
                <td className="num num-col">{amount(month.receivedCents)}</td>
                <td className="num num-col">{amount(month.heldCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
