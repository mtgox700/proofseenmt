import type { DailyAudience, FreelanceInsights } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { InsightsDictionary } from "@/i18n/market/insights-fr";
import { seriesSummary } from "@/lib/chart";
import { count } from "@/lib/format";
import { BarChart } from "./BarChart";
import { longDay, shortDay } from "./labels";

type Series = keyof Omit<DailyAudience, "day">;

const SERIES: readonly Series[] = ["views", "searchAppearances", "directoryAppearances", "listAdds"];

interface AudienceProps {
  readonly lang: Lang;
  readonly d: InsightsDictionary;
  readonly insights: FreelanceInsights;
  readonly published: boolean;
}

function SeriesChart({ lang, d, days, series }: { readonly lang: Lang; readonly d: InsightsDictionary; readonly days: readonly DailyAudience[]; readonly series: Series }) {
  const a = d.audience;
  const points = days.map((day) => ({ label: longDay(day.day, lang), value: day[series] }));
  const { total, peak } = seriesSummary(points);
  const label = a.series[series];
  return (
    <BarChart
      id={`audience-${series}`}
      title={label}
      figure={count(total, lang)}
      summary={a.summary(label, total, peak === null ? null : a.peak(peak.value, peak.label))}
      points={points}
      format={(value) => count(value, lang)}
      firstLabel={shortDay(days[0]?.day ?? "", lang)}
      lastLabel={shortDay(days.at(-1)?.day ?? "", lang)}
      tone={series === "views" ? "proof" : series === "listAdds" ? "signal" : "info"}
    />
  );
}

/** The whole series as a table, newest day first: the charts' accessible equivalent, folded by default. */
function AudienceTable({ lang, d, days }: { readonly lang: Lang; readonly d: InsightsDictionary; readonly days: readonly DailyAudience[] }) {
  const a = d.audience;
  return (
    <details className="chart-details">
      <summary>{a.showTable}</summary>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={a.tableCaption}>
        <table className="ops">
          <caption className="sr-only">{a.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{a.day}</th>
              {SERIES.map((series) => (
                <th key={series} scope="col" className="num-col">
                  {a.series[series]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.day}>
                <th scope="row">{longDay(day.day, lang)}</th>
                {SERIES.map((series) => (
                  <td key={series} className="num num-col">
                    {count(day[series], lang)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Keywords({ lang, d, insights }: { readonly lang: Lang; readonly d: InsightsDictionary; readonly insights: FreelanceInsights }) {
  const a = d.audience;
  return (
    <div className="insight-block">
      <h3 id="keywords-title">{a.keywordsTitle}</h3>
      <p className="muted small measure">{a.keywordsLead}</p>
      {insights.keywords.length === 0 ? (
        <p className="muted">{a.keywordsNone}</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="keywords-title">
          <table className="ops">
            <thead>
              <tr>
                <th scope="col">{a.keyword}</th>
                <th scope="col">{a.kinds.skill} / {a.kinds.city}</th>
                <th scope="col" className="num-col">
                  {a.appearances}
                </th>
              </tr>
            </thead>
            <tbody>
              {insights.keywords.map((k) => (
                <tr key={`${k.kind}:${k.keyword}`}>
                  <th scope="row">
                    <code>{k.keyword}</code>
                  </th>
                  <td>{a.kinds[k.kind]}</td>
                  <td className="num num-col">{count(k.appearances, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small measure">{a.noRanking}</p>
    </div>
  );
}

/** Ninety days of views, appearances and list additions, then the search filters that led companies to the profile. */
export function AudienceSection({ lang, d, insights, published }: AudienceProps) {
  const a = d.audience;
  return (
    <section className="ws-block" aria-labelledby="audience-title">
      <h2 id="audience-title">{a.title}</h2>
      <p className="muted small measure">{a.lead}</p>
      {published ? null : <p className="insight-note measure">{a.unpublished}</p>}
      <div className="chart-grid">
        {SERIES.map((series) => (
          <SeriesChart key={series} lang={lang} d={d} days={insights.days} series={series} />
        ))}
      </div>
      <AudienceTable lang={lang} d={d} days={insights.days} />
      <Keywords lang={lang} d={d} insights={insights} />
    </section>
  );
}
