import type { Dictionary } from "@/i18n";

/*
 * The legend of the register, in figures (STORYBOARD b.2). Only the J0 figures approved by the founder appear here,
 * each with its source and its limit. Figures are written, never counted up from zero: a register has no spinning
 * digits. The source shares are drawn at their real length from the first paint.
 */
export function Study({ t }: { readonly t: Dictionary }) {
  const f = t.study.facts;
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
            <figcaption className="muted small">{f.sources.label}</figcaption>
            <ul>
              {t.study.shares.map((share) => (
                <li key={share.domain}>
                  <code>{share.domain}</code>
                  <span className="share-bar" aria-hidden="true">
                    <span style={{ "--w": share.width } as React.CSSProperties} />
                  </span>
                  <b className="num">{share.value}</b>
                </li>
              ))}
            </ul>
          </figure>
        </div>

        <p className="study-source">{t.study.source}</p>
        <p className="small muted measure">{t.study.limits}</p>
      </div>
    </section>
  );
}
