import type { WaveView } from "@proofseen/db";
import "@/styles/visibility.css";
import type { Lang } from "@/i18n";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import { count, day, percent, range } from "@/lib/format";
import { FUNNEL_STEPS, funnelOf, type EngineFunnel, type StepView } from "@/lib/visibility-view";
import { engineLabel } from "./engine-label";

interface Props {
  readonly lang: Lang;
  readonly v: VisibilityDictionary;
  readonly wave: WaveView;
}

function Step({ lang, v, step }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly step: StepView }) {
  const share = step.share ?? 0;
  return (
    <li className="vis-step" data-step={step.step}>
      <span className="vis-step-line">
        <span>{v.latest.steps[step.step].label}</span>
        <span>
          <b>{v.latest.outOf(count(step.count, lang), count(step.draws, lang))}</b>
          {step.share === null ? null : ` · ${percent(step.share, lang)}`}
        </span>
      </span>
      <span className="vis-bar" aria-hidden="true">
        <span style={{ "--share": `${(share * 100).toFixed(1)}%` } as React.CSSProperties} />
      </span>
      {step.interval === null ? null : (
        <span className="vis-range">
          {v.latest.range} {range(step.interval, lang)}
        </span>
      )}
    </li>
  );
}

function EngineCard({ lang, v, funnel }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly funnel: EngineFunnel }) {
  const id = `engine-${funnel.engine}`;
  return (
    <article className="vis-engine" aria-labelledby={id}>
      <header className="vis-engine-head">
        <h3 id={id}>{engineLabel(funnel.engine, v)}</h3>
        <span className="muted small">{v.latest.answers(count(funnel.draws, lang))}</span>
      </header>
      {funnel.draws === 0 ? (
        <p className="muted small">{v.latest.noAnswer}</p>
      ) : (
        <ol className="vis-steps">
          {funnel.steps.map((step) => (
            <Step key={step.step} lang={lang} v={v} step={step} />
          ))}
        </ol>
      )}
    </article>
  );
}

/** The latest measured wave, engine by engine: each step of the funnel as a count of answers, its share and its range. */
export function LatestWave({ lang, v, wave }: Props) {
  const engines = wave.engines.map((result) => engineLabel(result.engine, v)).join(", ");
  return (
    <section className="panel" aria-labelledby="latest-wave">
      <h2 id="latest-wave">{v.latest.title}</h2>
      <p className="muted measure">
        {v.latest.measuredOn(day(wave.measuredAt, lang))}. {v.latest.engines(engines)}
      </p>
      <div className="vis-engines">
        {wave.engines.map((result) => (
          <EngineCard key={result.engine} lang={lang} v={v} funnel={funnelOf(result)} />
        ))}
      </div>
      <h3 className="vis-group">{v.latest.stepsTitle}</h3>
      <dl className="vis-legend">
        {FUNNEL_STEPS.map((step) => (
          <div key={step}>
            <dt>{v.latest.steps[step].label}</dt>
            <dd>{v.latest.steps[step].what}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small measure">{v.waves.note}</p>
    </section>
  );
}
