import type { ClientReportInput } from "@proofseen/deliverable";
import type { StageCount } from "@proofseen/stats";
import { Interval } from "@/components/Interval";
import type { Dictionary, Lang } from "@/i18n";
import { count, date, range } from "@/lib/format";

interface FunnelMatrixProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly report: ClientReportInput;
}

type EngineStage = "retrieved" | "named" | "top5" | "cited";
const ROWS: readonly { readonly code: "E2" | "E3" | "E4" | "E5"; readonly key: EngineStage }[] = [
  { code: "E2", key: "retrieved" },
  { code: "E3", key: "named" },
  { code: "E4", key: "top5" },
  { code: "E5", key: "cited" },
];

/**
 * The funnel, stage by engine, as a real table: rows are the questions a recruiter's engine answers, columns the
 * engines. Every cell carries the raw count and the 95 % range; the drawing repeats them, it never replaces them.
 */
export function FunnelMatrix({ lang, t, report }: FunnelMatrixProps) {
  const stages = t.method.stages;
  const blocking = report.plan.blockingStage;
  const cell = (stage: StageCount, draws: number): string =>
    `${t.overview.times(count(stage.successes, lang), count(draws, lang))} · ${range(stage.interval, lang)}`;
  const e1 = stages[0];
  return (
    <div className="funnel-wrap">
      <table className="funnel">
        <caption className="sr-only">{t.overview.funnelCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.overview.stage}</th>
            {report.funnel.map((engine) => (
              <th scope="col" key={engine.engine}>
                {t.ws.engines[engine.engine] ?? engine.engine}
                <span className="muted small num"> · {count(engine.draws, lang)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr data-blocking={blocking === "E1" || undefined}>
            <th scope="row">
              <span className="funnel-code num">E1</span>
              <span>{e1?.question}</span>
            </th>
            <td colSpan={report.funnel.length} data-label={t.overview.engineIndependent}>
              {report.indexation === null
                ? t.overview.notMeasured
                : t.overview.indexation(report.indexation.pagesIndexed, report.indexation.pagesDeclared, date(report.indexation.checkedAt, lang))}
              <span className="muted small funnel-e1-note"> {t.overview.engineIndependent}</span>
            </td>
          </tr>
          {ROWS.map((row) => (
            <tr key={row.code} data-blocking={blocking === row.code || undefined}>
              <th scope="row">
                <span className="funnel-code num">{row.code}</span>
                <span>{stages.find((stage) => stage.code === row.code)?.question}</span>
              </th>
              {report.funnel.map((engine) => (
                <td key={engine.engine} data-label={t.ws.engines[engine.engine] ?? engine.engine}>
                  <Interval value={engine[row.key].interval} label={cell(engine[row.key], engine.draws)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ws-note">{t.overview.legend}</p>
    </div>
  );
}
