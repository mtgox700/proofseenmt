import type { FreelanceWorkspace } from "@/data/schema";
import type { Dictionary, Lang } from "@/i18n";
import { count, percent, range, shareWithRange } from "@/lib/format";

interface SourceMapProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly counts: FreelanceWorkspace["sourceCounts"];
}

/**
 * Where the answers point. Only platform domains are named (REQ-M2-05); every other domain is one anonymous line.
 * Each share is a proportion of counted citations, so it gets a count and a Wilson range like any other rate.
 */
export function SourceMap({ lang, t, counts }: SourceMapProps) {
  const platforms = Object.entries(counts.platform).sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  const total = platforms.reduce((sum, [, n]) => sum + n, 0) + counts.client + counts.other;
  const rows: { key: string; label: React.ReactNode; n: number }[] = [
    ...platforms.map(([domain, n]) => ({ key: domain, label: <code>{domain}</code>, n })),
    { key: "client", label: t.report.clientDomains, n: counts.client },
    { key: "other", label: t.report.otherDomains, n: counts.other },
  ];
  return (
    <div className="ws-block">
      <p className="ws-note">{t.report.sourcesLead(count(total, lang))}</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.report.sourcesTitle}>
        <table className="sources">
          <thead>
            <tr>
              <th scope="col">{t.report.sourceCols.domain}</th>
              <th scope="col" className="num-col">{t.report.sourceCols.count}</th>
              <th scope="col" className="num-col">{t.report.sourceCols.share}</th>
              <th scope="col">{t.report.sourceCols.range}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const interval = shareWithRange(row.n, total);
              return (
                <tr key={row.key} data-quiet={row.key === "other" || row.key === "client" || undefined}>
                  <th scope="row">{row.label}</th>
                  <td className="num num-col">{count(row.n, lang)}</td>
                  <td className="num num-col">{interval === null ? "" : percent(interval.p, lang)}</td>
                  <td className="num">
                    <span className="share-cell">
                      <span className="share-track" aria-hidden="true">
                        {interval === null ? null : (
                          <span
                            className="share-range"
                            style={{ left: `${interval.low * 100}%`, width: `max(${(interval.high - interval.low) * 100}%, 2px)` }}
                          />
                        )}
                      </span>
                      <span className="small">{range(interval, lang)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
