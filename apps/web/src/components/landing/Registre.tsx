import type { AnswersSnapshot } from "@/data/schema";
import type { Dictionary, Lang } from "@/i18n";
import { SOURCE_CATEGORIES } from "@/lib/answers";
import { count, percent } from "@/lib/format";
import { buildRegistre, categoryTotal } from "@/lib/registre";
import { PlayOnView } from "./PlayOnView";

interface RegistreProps {
  readonly lang: Lang;
  readonly t: Dictionary["field"];
  readonly answers: AnswersSnapshot;
  /**
   * The home page's version (Kensa M11, five figures at most): no share without a source per engine, no count per
   * chip, a legend without numbers. Every count stays in the table, folded under its summary.
   */
  readonly compact?: boolean;
}

/** Earliest start of the reading rule (STORYBOARD b.1): after the headline has been painted. */
const RELEVE_AT_MS = 800;

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);

/*
 * The opening figure, "le registre" (STORYBOARD b.1, CONCEPT §3 "le relevé"): the 780 real answers of the founder's J0
 * wave, one slot each, rendered on the server as one SVG. The source filter is a group of radio buttons read by CSS
 * (`:has()`), so it works without JavaScript; the table under it says the same in words, for screen readers and robots.
 * No slot is green: the founder is cited in none of them, and the line under the figure says so with the real count.
 */
export function Registre({ lang, t, answers, compact = false }: RegistreProps) {
  const registre = buildRegistre(answers.answers, answers.engines.length);
  const engines = answers.engines.map((engine) => t.engines[engine] ?? engine);
  const present = SOURCE_CATEGORIES.filter((category) => categoryTotal(registre, category) > 0);
  const n = count(registre.total, lang);
  const engineTotal = (i: number): number => Object.values(registre.counts[i] ?? {}).reduce((sum, v) => sum + v, 0);

  return (
    <figure className="registre" aria-labelledby="registre-title">
      <figcaption className="rg-head">
        <strong id="registre-title">{fill(t.title, { n })}</strong>
        <span className="rg-trace">{t.trace}</span>
      </figcaption>

      <div className="rg-board">
        <div className="rg-engines" aria-hidden="true">
          {engines.map((engine, i) => (
            <span key={engine}>
              {engine}
              {compact ? null : <small>{fill(t.noSource, { pct: percent((registre.counts[i]?.none ?? 0) / Math.max(1, engineTotal(i)), lang) })}</small>}
            </span>
          ))}
        </div>
        <PlayOnView className="rg-play" threshold={0.4} notBefore={RELEVE_AT_MS}>
          <svg
            className="rg-svg"
            viewBox={registre.viewBox}
            role="img"
            aria-label={t.summary}
            style={{ "--rg-rise": `${registre.rise}px` } as React.CSSProperties}
          >
            <path className="rg-frame" d={registre.frame} />
            <g className="rg-slots" strokeDasharray="4 1">
              {registre.paths.map((path) => (
                <path key={path.category} className={`rg-cat rg-${path.category}`} strokeWidth={path.height} d={path.d} />
              ))}
            </g>
            {registre.rules.map((rule, i) => (
              <path key={rule} className="rg-rule" style={{ "--i": i } as React.CSSProperties} d={rule} />
            ))}
          </svg>
        </PlayOnView>
      </div>

      <p className="rg-key">{compact ? t.keyCompact : fill(t.key, { targets: String(registre.targets), controls: String(registre.controls) })}</p>

      <p className="rg-founder">
        <span className="rg-cartouche" aria-hidden="true" />
        <span>
          {t.founder} <b className="num">{fill(t.founderCount, { hits: count(categoryTotal(registre, "you"), lang), n })}</b>
        </span>
      </p>

      <fieldset className="rg-legend">
        <legend>{t.filter}</legend>
        <div className="rg-chips">
          <label>
            <input className="sr-only" type="radio" name="rg-source" value="all" defaultChecked />
            <span>{t.all}</span>
            {compact ? null : <b>{n}</b>}
          </label>
          {present.map((category) => (
            <label key={category}>
              <input className="sr-only" type="radio" name="rg-source" value={category} />
              <span className={`rg-sw rg-sw-${category}`} aria-hidden="true" />
              <span>{t.categories[category]}</span>
              {compact ? null : <b>{count(categoryTotal(registre, category), lang)}</b>}
            </label>
          ))}
        </div>
      </fieldset>

      <details className="rg-table">
        <summary>{t.table}</summary>
        {/* A region that scrolls sideways on a phone: it takes the keyboard focus and carries a name. */}
        <div className="rg-scroll" role="region" tabIndex={0} aria-label={t.table}>
          <table>
            <caption>{t.summary}</caption>
            <thead>
              <tr>
                <th scope="col">{t.tableSource}</th>
                {engines.map((engine) => (
                  <th key={engine} scope="col">
                    {engine}
                  </th>
                ))}
                <th scope="col">{t.tableTotal}</th>
              </tr>
            </thead>
            <tbody>
              {present.map((category) => (
                <tr key={category}>
                  <th scope="row">{t.categories[category]}</th>
                  {registre.counts.map((engine, i) => (
                    <td key={engines[i]}>{count(engine[category], lang)}</td>
                  ))}
                  <td>{count(categoryTotal(registre, category), lang)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t.tableTotal}</th>
                {engines.map((engine, i) => (
                  <td key={engine}>{count(engineTotal(i), lang)}</td>
                ))}
                <td>{n}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </figure>
  );
}
