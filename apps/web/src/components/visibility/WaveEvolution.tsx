import "@/styles/visibility.css";
import type { Lang } from "@/i18n";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import { count, day, points } from "@/lib/format";
import type { EngineChange, Evolution, Tally } from "@/lib/visibility-view";
import { engineLabel } from "./engine-label";

interface Props {
  readonly lang: Lang;
  readonly v: VisibilityDictionary;
  readonly evolution: Evolution;
}

/** Raw counts only: a share shown here would need its range, which the latest-wave cards already give. */
const tallyText = (t: Tally | null, lang: Lang, v: VisibilityDictionary): string =>
  t === null ? v.evolution.none : v.latest.outOf(count(t.count, lang), count(t.draws, lang));

function Delta({ lang, v, delta }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly delta: number | null }) {
  if (delta === null) return <span className="muted">{v.evolution.none}</span>;
  return (
    <span className="vis-delta" data-sign={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
      {points(delta, lang)}
    </span>
  );
}

function EngineTable({ lang, v, change }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly change: EngineChange }) {
  const e = v.evolution;
  const name = engineLabel(change.engine, v);
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={name}>
      <table className="ops">
        <caption>
          {name}
          {change.kind === "both" ? null : <span className="muted small"> · {e.kinds[change.kind]}</span>}
        </caption>
        <thead>
          <tr>
            <th scope="col">{e.step}</th>
            <th scope="col" className="num-col">{e.previous}</th>
            <th scope="col" className="num-col">{e.current}</th>
            <th scope="col" className="num-col">{e.change}</th>
          </tr>
        </thead>
        <tbody>
          {change.steps.map((step) => (
            <tr key={step.step}>
              <th scope="row">{v.latest.steps[step.step].label}</th>
              <td className="num num-col">{tallyText(step.previous, lang, v)}</td>
              <td className="num num-col">{tallyText(step.current, lang, v)}</td>
              <td className="num num-col">
                <Delta lang={lang} v={v} delta={step.delta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The change between the two latest waves, engine by engine: both raw counts and the gap in share points. */
export function WaveEvolution({ lang, v, evolution }: Props) {
  return (
    <section className="panel" aria-labelledby="wave-evolution">
      <h2 id="wave-evolution">{v.evolution.title}</h2>
      <p className="muted measure">{v.evolution.lead(day(evolution.previous.measuredAt, lang), day(evolution.current.measuredAt, lang))}</p>
      {evolution.engines.map((change) => (
        <EngineTable key={change.engine} lang={lang} v={v} change={change} />
      ))}
    </section>
  );
}
