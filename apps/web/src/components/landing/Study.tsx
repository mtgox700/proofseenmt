import Link from "next/link";
import { CountUp } from "@/components/motion/CountUp";
import { InView } from "@/components/motion/InView";
import type { Dictionary, Lang } from "@/i18n";

const LOCALE: Readonly<Record<Lang, string>> = { fr: "fr-FR", en: "en-GB" };

/*
 * Measured on ourselves first. Only the J0 figures approved by the founder appear here, each with its source and its
 * limit. The figures count up once when seen; the source shares grow from zero to their observed proportion.
 */
export function Study({ lang, t }: { readonly lang: Lang; readonly t: Dictionary }) {
  const f = t.study.facts;
  const pctSuffix = lang === "fr" ? " %" : "%";
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
            <div>
              <dt>
                <CountUp display={f.answers.value} to={780} locale={LOCALE[lang]} />
              </dt>
              <dd className="muted">{f.answers.label}</dd>
            </div>
            <div>
              <dt>
                <CountUp display={f.silent.value} to={90.8} decimals={1} locale={LOCALE[lang]} suffix={pctSuffix} />
              </dt>
              <dd className="muted">{f.silent.label}</dd>
            </div>
            <div>
              <dt className="num">{f.agreement.value}</dt>
              <dd className="muted">{f.agreement.label}</dd>
            </div>
          </dl>

          <InView as="figure" className="study-shares">
            <figcaption className="muted small">{f.sources.label}</figcaption>
            <ul>
              {t.study.shares.map((share, i) => (
                <li key={share.domain} style={{ "--i": i } as React.CSSProperties}>
                  <code>{share.domain}</code>
                  <span className="share-bar" aria-hidden="true">
                    <span style={{ "--w": share.width } as React.CSSProperties} />
                  </span>
                  <b className="num">{share.value}</b>
                </li>
              ))}
            </ul>
          </InView>
        </div>

        <p className="small muted measure study-source">{t.study.source}</p>
        <p className="small muted measure">{t.study.limits}</p>
        <p className="study-link">
          <Link href={`/${lang}/freelance`}>{t.study.open}</Link>
        </p>
      </div>
    </section>
  );
}
