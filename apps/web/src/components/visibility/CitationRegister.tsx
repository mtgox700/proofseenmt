import type { WaveView } from "@proofseen/db";
import "@/styles/app-registre.css";
import type { Lang } from "@/i18n";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import { citationRegister, CITED_HEIGHT, REST_HEIGHT, type EngineColumn } from "@/lib/citation-register";
import { count, day } from "@/lib/format";
import { engineLabel } from "./engine-label";

interface Props {
  readonly lang: Lang;
  readonly v: VisibilityDictionary;
  readonly wave: WaveView;
}

function Column({ lang, v, column }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly column: EngineColumn }) {
  const name = engineLabel(column.engine, v);
  const cited = count(column.cited, lang);
  const draws = count(column.draws, lang);
  return (
    <li className="cr-col">
      <p className="cr-engine">
        <span>{name}</span> <b className="num">{v.latest.outOf(cited, draws)}</b>
      </p>
      {column.draws === 0 ? (
        <p className="muted small">{v.latest.noAnswer}</p>
      ) : (
        <svg className="cr-svg" viewBox={column.viewBox} role="img" aria-label={v.register.engine(name, cited, draws)} style={{ "--cr-rise": `${column.rise}px` } as React.CSSProperties}>
          <path className="cr-frame" d={column.frame} />
          <g strokeDasharray="4 1">
            <path className="cr-rest" strokeWidth={REST_HEIGHT} d={column.restPath} />
            {column.citedPath === "" ? null : <path className="cr-cited" strokeWidth={CITED_HEIGHT} d={column.citedPath} />}
          </g>
          <path className="cr-rule" d={column.rule} />
        </svg>
      )}
    </li>
  );
}

/*
 * "Être cité" (CONNECTED_PLAN §2.1): the latest measurement as a register of the person's own answers, one slot per
 * answer, the cited ones green as on the storefront, the count always raw (n of N) and dated. At zero nothing lights
 * up and the line says so. The figure is a static SVG from the server; its reading rule runs down once in CSS, rests
 * on the foot rule without script and under reduced motion. The table under it says the same in words.
 */
export function CitationRegister({ lang, v, wave }: Props) {
  const r = v.register;
  const register = citationRegister(wave.engines);
  const cited = count(register.cited, lang);
  const draws = count(register.draws, lang);
  return (
    <section className="panel" aria-labelledby="citation-register">
      <h2 id="citation-register">{r.title}</h2>
      <figure className="cr" aria-labelledby="citation-register-caption">
        <figcaption id="citation-register-caption" className="cr-caption">
          {r.caption(cited, draws, day(wave.measuredAt, lang))}
        </figcaption>
        <ol className="cr-cols">
          {register.columns.map((column) => (
            <Column key={column.engine} lang={lang} v={v} column={column} />
          ))}
        </ol>
        <p className="cr-key">{r.key}</p>
        {register.cited === 0 ? (
          <p className="cr-none">
            <span className="cr-blank" aria-hidden="true" />
            <span>{r.none}</span>
          </p>
        ) : null}
        <details className="cr-table">
          <summary>{r.table}</summary>
          <div className="table-scroll" tabIndex={0} role="region" aria-label={r.table}>
            <table className="ops">
              <thead>
                <tr>
                  <th scope="col">{r.tableEngine}</th>
                  <th scope="col" className="num-col">
                    {r.tableDraws}
                  </th>
                  <th scope="col" className="num-col">
                    {r.tableCited}
                  </th>
                </tr>
              </thead>
              <tbody>
                {register.columns.map((column) => (
                  <tr key={column.engine}>
                    <th scope="row">{engineLabel(column.engine, v)}</th>
                    <td className="num num-col">{count(column.draws, lang)}</td>
                    <td className="num num-col">{count(column.cited, lang)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{r.tableTotal}</th>
                  <td className="num num-col">{draws}</td>
                  <td className="num num-col">{cited}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      </figure>
    </section>
  );
}
