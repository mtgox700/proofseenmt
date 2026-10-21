import type { Dictionary } from "@/i18n";

interface MethodProps {
  readonly t: Dictionary;
}

/*
 * The five steps E1 to E5 (STORYBOARD b.5), always rendered in their final state: no reveal, no observer, nothing
 * that waits for a scroll. A vertical rule (the trace) with one notch per step; the notches shorten from E1 to E5, a
 * diagram of the narrowing that the section names as a diagram, not as data.
 */
export function Method({ t }: MethodProps) {
  return (
    <section className="section" id="methode" aria-labelledby="method-title">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">{t.method.kicker}</p>
          <h2 id="method-title">{t.method.title}</h2>
          <p className="muted measure pretty">{t.method.lead}</p>
        </div>
        <ol className="steps">
          {t.method.stages.map((stage, i) => (
            <li key={stage.code} style={{ "--i": i } as React.CSSProperties}>
              <span className="step-notch" aria-hidden="true" />
              <span className="step-code">{stage.code}</span>
              <strong className="step-name">{stage.name}</strong>
              <span className="step-question muted">{stage.question}</span>
            </li>
          ))}
        </ol>
        <p className="small muted steps-note">{t.method.diagramNote}</p>
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
