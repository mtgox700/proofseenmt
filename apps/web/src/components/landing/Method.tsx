import type { ClientReportInput } from "@proofseen/deliverable";
import { InView } from "@/components/motion/InView";
import type { Dictionary, Lang } from "@/i18n";
import { date } from "@/lib/format";

interface MethodProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly report: ClientReportInput | null;
}

/*
 * The funnel E1 to E5, drawn as narrowing stages that light up one after the other when the section is seen. The
 * narrowing is a diagram of the method, not data; the one data point is real: the stage where our own profile stops.
 */
export function Method({ lang, t, report }: MethodProps) {
  const blocking = report?.plan.blockingStage ?? null;
  const indexation = report?.indexation ?? null;
  return (
    <section className="section" id="methode" aria-labelledby="method-title">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">{t.method.kicker}</p>
          <h2 id="method-title">{t.method.title}</h2>
          <p className="muted measure pretty">{t.method.lead}</p>
        </div>
        <InView as="ol" className="funnel-stages">
          {t.method.stages.map((stage, i) => (
            <li key={stage.code} style={{ "--i": i } as React.CSSProperties} data-stop={stage.code === blocking || undefined}>
              <span className="stage-bar" aria-hidden="true" />
              <span className="stage-code num">{stage.code}</span>
              <span className="stage-text">
                <strong>{stage.name}</strong>
                <span className="muted">{stage.question}</span>
              </span>
              {stage.code === blocking ? (
                <span className="stage-stop">
                  <span className="tag tag-signal">{t.method.stopLabel}</span>
                  {indexation === null ? null : <span className="small num">{t.method.stopDetail(indexation.pagesIndexed, indexation.pagesDeclared, date(indexation.checkedAt, lang))}</span>}
                </span>
              ) : null}
            </li>
          ))}
        </InView>
        <p className="small muted funnel-note">{t.method.diagramNote}</p>
        <dl className="rules">
          {t.method.rules.map((rule) => (
            <div key={rule.title}>
              <dt>{rule.title}</dt>
              <dd className="muted">{rule.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
