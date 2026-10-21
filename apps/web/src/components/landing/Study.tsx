import { J0_CITATIONS, SHOWN_SHARES } from "@/data/j0-citations";
import type { Dictionary, Lang } from "@/i18n";
import { count, percent } from "@/lib/format";

/*
 * The legend of the register, in figures (STORYBOARD b.2). Only the J0 figures approved by the founder appear here,
 * each with its source and its limit. Figures are written, never counted up from zero: a register has no spinning
 * digits. The source shares are drawn at their real length from the first paint, and each one carries its raw count
 * over the same total: a percentage alone lies by omission.
 */

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);

export function Study({ lang, t }: { readonly lang: Lang; readonly t: Dictionary }) {
  const f = t.study.facts;
  const total = count(J0_CITATIONS.total, lang);
  return (
    <section className="section study" id="mesure" aria-labelledby="study-title">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">{t.study.kicker}</p>
          <h2 id="study-title">{t.study.title}</h2>
          <p className="muted measure pretty">{t.study.lead}</p>
        </div>

        <div className="study-grid">
          <div className="study-zero">
            <p className="study-big num">{f.zero.value}</p>
            <p className="study-range num">
              <span className="glyph" aria-hidden="true" />
              {f.zero.range}
            </p>
            <p className="muted">{f.zero.label}</p>
          </div>

          <dl className="study-facts">
            {[f.answers, f.silent, f.agreement].map((fact) => (
              <div key={fact.value}>
                <dt className="num">{fact.value}</dt>
                <dd className="muted">{fact.label}</dd>
              </div>
            ))}
          </dl>

          <figure className="study-shares">
            <figcaption className="muted small">{fill(f.sources.label, { total, answers: count(J0_CITATIONS.answers, lang) })}</figcaption>
            <ul>
              {SHOWN_SHARES.map((domain) => {
                const hits = J0_CITATIONS.platforms[domain];
                const share = hits / J0_CITATIONS.total;
                return (
                  <li key={domain}>
                    <code>{domain}</code>
                    <span className="share-bar" aria-hidden="true">
                      <span style={{ "--w": share } as React.CSSProperties} />
                    </span>
                    <b className="num">{percent(share, lang)}</b>
                    <small className="share-count muted num">{fill(f.sources.count, { hits: count(hits, lang), total })}</small>
                  </li>
                );
              })}
            </ul>
          </figure>
        </div>

        <p className="study-source">{t.study.source}</p>
        <p className="small muted measure">{t.study.limits}</p>
      </div>
    </section>
  );
}
