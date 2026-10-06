import type { Comparison } from "@proofseen/deliverable";
import type { Dictionary, Lang } from "@/i18n";
import { count, points } from "@/lib/format";

interface ComparisonViewProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly comparison: Comparison;
}

/**
 * Change between two measures, with the engines' drift printed next to the client's change, never below it or in a
 * footnote. The verdict comes first: it says what the figures allow, and stays silent when they allow nothing.
 */
export function ComparisonView({ lang, t, comparison }: ComparisonViewProps) {
  const drift = comparison.controlDrift;
  const driftText = drift === null ? t.evolution.driftNone : t.evolution.driftValue(points(drift.delta, lang));
  return (
    <div className="ws-block">
      <p className={`verdict verdict-${comparison.verdict}`}>{t.evolution.verdict[comparison.verdict]}</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.evolution.title}>
        <table className="compare">
          <thead>
            <tr>
              <th scope="col">{t.evolution.cols.stage}</th>
              <th scope="col" className="num-col">{t.evolution.cols.before}</th>
              <th scope="col" className="num-col">{t.evolution.cols.after}</th>
              <th scope="col" className="num-col">{t.evolution.cols.delta}</th>
              <th scope="col">{t.evolution.cols.drift}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.stages.map((stage, i) => (
              <tr key={stage.stage}>
                <th scope="row">{t.evolution.stages[stage.stage]}</th>
                <td className="num num-col">{`${count(stage.before.successes, lang)} / ${count(stage.before.draws, lang)}`}</td>
                <td className="num num-col">{`${count(stage.after.successes, lang)} / ${count(stage.after.draws, lang)}`}</td>
                <td className="num num-col">
                  <strong>{points(stage.delta, lang)}</strong>
                </td>
                {i === 0 ? (
                  <td rowSpan={comparison.stages.length} className="num compare-drift" data-flagged={drift?.flagged || undefined}>
                    {driftText}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ws-note">{t.evolution.unit}</p>
    </div>
  );
}
