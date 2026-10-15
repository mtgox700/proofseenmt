import "@/styles/insights.css";
import { companyInsights, dashboards, type ApplicationStatus, type CompanyInsights, type JobPostStatus } from "@proofseen/db";
import type { Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { seriesSummary } from "@/lib/chart";
import { count } from "@/lib/format";
import type { Market } from "@/lib/market";
import { BarChart } from "./BarChart";
import { CompanySpend } from "./CompanySpend";
import { CountsTable, statusRows } from "./CountsTable";
import { FactList } from "./FactList";
import { longMonth, shortMonth } from "./labels";

const MISSION_ORDER: readonly JobPostStatus[] = ["draft", "open", "closed"];
const APPLICATION_ORDER: readonly ApplicationStatus[] = ["submitted", "shortlisted", "hired", "declined", "withdrawn"];

function Published({ lang, m, insights }: { readonly lang: Lang; readonly m: MarketDictionary; readonly insights: CompanyInsights }) {
  const c = m.insights.company;
  const points = insights.publishedByMonth.map((month) => ({ label: longMonth(month.month, lang), value: month.count }));
  const { total, peak } = seriesSummary(points);
  return (
    <div className="insight-block">
      <BarChart
        id="published-chart"
        title={c.published}
        figure={count(total, lang)}
        summary={`${c.publishedCaption} — ${count(total, lang)}${peak === null ? "" : ` (${peak.label} — ${count(peak.value, lang)})`}`}
        points={points}
        format={(value) => count(value, lang)}
        firstLabel={shortMonth(insights.publishedByMonth[0]?.month ?? "", lang)}
        lastLabel={shortMonth(insights.publishedByMonth.at(-1)?.month ?? "", lang)}
        tone="info"
      />
      <details className="chart-details">
        <summary>{c.publishedCaption}</summary>
        <table className="ops">
          <thead>
            <tr>
              <th scope="col">{c.month}</th>
              <th scope="col" className="num-col">
                {c.count}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...insights.publishedByMonth].reverse().map((month) => (
              <tr key={month.month}>
                <th scope="row">{longMonth(month.month, lang)}</th>
                <td className="num num-col">{count(month.count, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/**
 * The company's home figures: hiring by stage and response time, spending by month and cost centre, team activity,
 * contracts and invoices. For members only (checked inside each query); `null` for anyone else.
 */
export async function CompanyHomeBoard({ lang, market, organisationId }: { readonly lang: Lang; readonly market: Market; readonly organisationId: string }) {
  const m = marketDictionary(lang);
  const c = m.insights.company;
  const [insights, board] = await Promise.all([
    companyInsights(market.db).forCompany(market.actor, organisationId, new Date()),
    dashboards(market.db).company(market.actor, organisationId),
  ]);
  if (insights === null || board === null) return null;
  const contracts = Object.values(board.contracts).reduce((sum, value) => sum + (value ?? 0), 0);
  return (
    <>
      <section className="ws-block" aria-labelledby="recruiting-title">
        <h2 id="recruiting-title">{c.recruitingTitle}</h2>
        <FactList
          facts={[
            {
              label: c.firstResponse,
              value: insights.firstResponse === null ? "—" : c.firstResponseValue(insights.firstResponse.medianDays, insights.firstResponse.decided),
              foot: insights.firstResponse === null ? c.firstResponseNone : c.firstResponseHint,
            },
            { label: m.account.dashboard.openApplications, value: count(board.openApplications, lang) },
            { label: c.contracts, value: count(contracts, lang), foot: m.account.dashboard.contractsFoot(board.contracts.active ?? 0, board.contracts.pending_signatures ?? 0) },
            { label: c.invoices, value: count(board.invoices, lang) },
          ]}
        />
        <div className="insight-columns">
          <CountsTable id="company-missions" lang={lang} title={c.missions} labelHeader={m.insights.work.status} countHeader={m.insights.work.count} rows={statusRows(MISSION_ORDER, m.missions.status, insights.missions)} />
          <CountsTable id="company-applications" lang={lang} title={c.applications} labelHeader={m.insights.work.status} countHeader={m.insights.work.count} rows={statusRows(APPLICATION_ORDER, m.missions.applicationStatus, insights.applications)} />
        </div>
        <Published lang={lang} m={m} insights={insights} />
      </section>
      <CompanySpend lang={lang} c={c} spend={insights.spend} />
      <section className="ws-block" aria-labelledby="team-title">
        <h2 id="team-title">{c.teamTitle}</h2>
        <p className="muted small measure">{c.teamLead}</p>
        <FactList
          facts={[
            { label: c.searches, value: count(insights.team.searches, lang) },
            { label: c.listsCreated, value: count(insights.team.listsCreated, lang) },
            { label: c.profilesAdded, value: count(insights.team.profilesAdded, lang) },
          ]}
        />
      </section>
    </>
  );
}
