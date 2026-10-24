import type { HomeCopy } from "@/content/home";
import type { Lang } from "@/i18n";
import { Photo } from "./Photo";

/*
 * S4, what "verified" means, and who says so. One photo (a hand signs: the proof comes from an act, not a claim)
 * and six facts. Each tick turns from outline to green as its line crosses the middle of the screen: a CSS view
 * timeline, no script (home-sections.css). Without support, without JavaScript or under reduced motion the ticks
 * are green from the first paint: green here names a fact verified by a third party, which is what each line is.
 */
export function Verified({ lang, copy }: { readonly lang: Lang; readonly copy: HomeCopy["verified"] }) {
  const method = lang === "fr" ? "/methode/" : "/en/method/";
  return (
    <section className="section vf" id="verifie" aria-labelledby="vf-title">
      <div className="wrap vf-grid">
        <figure className="vf-photo">
          <Photo name="contract-signature" alt={copy.photo.alt} sizes="(min-width: 64rem) 420px, 100vw" />
        </figure>
        <div className="vf-copy">
          <header className="section-head reveal">
            <p className="kicker">{copy.kicker}</p>
            <h2 id="vf-title">{copy.title}</h2>
            <p className="section-lead pretty">{copy.lead}</p>
          </header>
          <dl className="vf-list">
            {copy.rows.map((row) => (
              <div key={row.fact} className="vf-row">
                <dt>
                  <svg className="vf-tick" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <circle cx="8" cy="8" r="7" />
                    <path d="M4.6 8.3 7 10.6l4.4-5" />
                  </svg>
                  {row.fact}
                </dt>
                <dd>{row.by}</dd>
              </div>
            ))}
          </dl>
          <p className="vf-foot">{copy.foot}</p>
          <a className="text-link" href={method}>
            {copy.link}
          </a>
        </div>
      </div>
    </section>
  );
}
