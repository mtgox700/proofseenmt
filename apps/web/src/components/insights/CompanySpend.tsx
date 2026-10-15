import type { CompanyInsights } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { InsightsDictionary } from "@/i18n/market/insights-fr";
import { seriesSummary } from "@/lib/chart";
import { money } from "@/lib/format";
import { BarChart } from "./BarChart";
import { longMonth, shortMonth } from "./labels";

interface CompanySpendProps {
  readonly lang: Lang;
  readonly c: InsightsDictionary["company"];
  readonly spend: CompanyInsights["spend"];
}

type Spend = NonNullable<CompanyInsights["spend"]>;

function ByCostCentre({ c, spend, amount }: { readonly c: InsightsDictionary["company"]; readonly spend: Spend; readonly amount: (cents: number) => string }) {
  return (
    <div className="insight-block">
      <h3 id="cost-centres-title">{c.costCentres}</h3>
      {spend.costCentres.length === 0 ? (
        <p className="muted">{c.noSpend}</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="cost-centres-title">
          <table className="ops">
            <thead>
              <tr>
                <th scope="col">{c.costCentre}</th>
                <th scope="col" className="num-col">
                  {c.paid}
                </th>
                <th scope="col" className="num-col">
                  {c.held}
                </th>
              </tr>
            </thead>
            <tbody>
              {spend.costCentres.map((centre) => (
                <tr key={centre.costCenter ?? ""}>
                  <th scope="row">{centre.costCenter ?? <span className="muted">{c.noCostCentre}</span>}</th>
                  <td className="num num-col">{amount(centre.paidCents)}</td>
                  <td className="num num-col">{amount(centre.heldCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Spending per month (paid out and held) over 12 months, and per cost centre. Zeros are shown as zeros. */
export function CompanySpend({ lang, c, spend }: CompanySpendProps) {
  if (spend === null) {
    return (
      <section className="ws-block" aria-labelledby="spend-title">
        <h2 id="spend-title">{c.spendTitle}</h2>
        <p className="muted">{c.severalCurrencies}</p>
      </section>
    );
  }
  const amount = (cents: number): string => money(cents, spend.currency, lang);
  const points = spend.months.map((month) => ({ label: longMonth(month.month, lang), value: month.paidCents + month.heldCents }));
  const { total, peak } = seriesSummary(points);
  return (
    <section className="ws-block" aria-labelledby="spend-title">
      <h2 id="spend-title">{c.spendTitle}</h2>
      <p className="muted small measure">{c.spendLead}</p>
      <BarChart
        id="spend-chart"
        title={c.spendChart}
        figure={amount(total)}
        summary={`${c.spendChart} — ${amount(total)}${peak === null ? "" : ` (${peak.label} — ${amount(peak.value)})`}`}
        points={points}
        format={amount}
        firstLabel={shortMonth(spend.months[0]?.month ?? "", lang)}
        lastLabel={shortMonth(spend.months.at(-1)?.month ?? "", lang)}
        tone="signal"
      />
      <div className="table-scroll" tabIndex={0} role="region" aria-label={c.spendCaption}>
        <table className="ops">
          <caption className="sr-only">{c.spendCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{c.month}</th>
              <th scope="col" className="num-col">
                {c.paid}
              </th>
              <th scope="col" className="num-col">
                {c.held}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...spend.months].reverse().map((month) => (
              <tr key={month.month}>
                <th scope="row">{longMonth(month.month, lang)}</th>
                <td className="num num-col">{amount(month.paidCents)}</td>
                <td className="num num-col">{amount(month.heldCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ByCostCentre c={c} spend={spend} amount={amount} />
    </section>
  );
}
