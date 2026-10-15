import Link from "next/link";
import type { WaveView } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { InsightsDictionary } from "@/i18n/market/insights-fr";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import { count, day } from "@/lib/format";
import { engineLabel } from "../visibility/engine-label";

interface AiCitationsProps {
  readonly lang: Lang;
  readonly d: InsightsDictionary;
  readonly v: VisibilityDictionary;
  /** Latest measurements first. */
  readonly waves: readonly WaveView[];
}

/** Citations per engine at each of the latest measurements: counts out of the questions asked, never a score. */
export function AiCitations({ lang, d, v, waves }: AiCitationsProps) {
  const a = d.ai;
  return (
    <div className="insight-block">
      <h3 id="ai-citations-title">{a.title}</h3>
      <p className="muted small measure">{a.lead}</p>
      {waves.length === 0 ? (
        <p className="muted">{a.none}</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="ai-citations-title">
          <table className="ops">
            <thead>
              <tr>
                <th scope="col">{a.measuredOn}</th>
                <th scope="col">{a.engine}</th>
                <th scope="col" className="num-col">
                  {a.cited}
                </th>
              </tr>
            </thead>
            <tbody>
              {waves.flatMap((wave) =>
                wave.engines.map((engine, i) => (
                  <tr key={`${wave.waveId}:${engine.engine}`}>
                    {i === 0 ? (
                      <th scope="rowgroup" rowSpan={wave.engines.length}>
                        {day(wave.measuredAt, lang)}
                      </th>
                    ) : null}
                    <td>{engineLabel(engine.engine, v)}</td>
                    <td className="num num-col">{a.of(count(engine.cited, lang), count(engine.draws, lang))}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="small">
        <Link href={`/${lang}/app/visibilite`}>{a.link}</Link>
      </p>
    </div>
  );
}
