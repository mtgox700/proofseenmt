import type { WaveView } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import { count, day } from "@/lib/format";
import { engineLabel } from "./engine-label";

/** Every stored wave, most recent first, as plain tables of counts: the record behind the latest result. */
export function WaveHistory({ lang, v, waves }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly waves: readonly WaveView[] }) {
  const w = v.waves;
  return (
    <section className="panel" aria-labelledby="measure-waves">
      <h2 id="measure-waves">{w.title}</h2>
      <p className="muted measure">{w.note}</p>
      {waves.length === 0 ? (
        <p className="muted">{w.empty}</p>
      ) : (
        waves.map((wave) => (
          <div key={wave.waveId} className="table-scroll" tabIndex={0} role="region" aria-label={w.measuredOn(day(wave.measuredAt, lang))}>
            <table className="ops">
              <caption>{w.measuredOn(day(wave.measuredAt, lang))}</caption>
              <thead>
                <tr>
                  <th scope="col">{w.engine}</th>
                  <th scope="col" className="num-col">{w.draws}</th>
                  <th scope="col" className="num-col">{w.retrieved}</th>
                  <th scope="col" className="num-col">{w.named}</th>
                  <th scope="col" className="num-col">{w.top5}</th>
                  <th scope="col" className="num-col">{w.cited}</th>
                </tr>
              </thead>
              <tbody>
                {wave.engines.map((result) => (
                  <tr key={result.engine}>
                    <th scope="row">{engineLabel(result.engine, v)}</th>
                    <td className="num num-col">{count(result.draws, lang)}</td>
                    <td className="num num-col">{count(result.retrieved, lang)}</td>
                    <td className="num num-col">{count(result.named, lang)}</td>
                    <td className="num num-col">{count(result.top5, lang)}</td>
                    <td className="num num-col">{count(result.cited, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}
