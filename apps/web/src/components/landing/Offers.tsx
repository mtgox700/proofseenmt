import Link from "next/link";
import { InView } from "@/components/motion/InView";
import type { Dictionary, Lang } from "@/i18n";

/** Two offers, the complete one set apart; each leads to the order page where every commitment is printed. */
export function Offers({ lang, t }: { readonly lang: Lang; readonly t: Dictionary }) {
  const keys = ["audit", "turnkey"] as const;
  return (
    <section className="section" id="offres" aria-labelledby="offers-title">
      <div className="wrap">
        <div className="section-head">
          <h2 id="offers-title">{t.offers.title}</h2>
        </div>
        <InView className="offers">
          {t.offers.list.map((offer, i) => {
            const key = keys[i] ?? "audit";
            const featured = key === "turnkey";
            return (
              <article key={offer.name} className="offer" data-featured={featured || undefined} style={{ "--i": i } as React.CSSProperties} aria-labelledby={`offer-${key}`}>
                {featured ? <span className="offer-ribbon">{t.offers.recommended}</span> : null}
                <h3 id={`offer-${key}`}>{offer.name}</h3>
                <p className="offer-price">
                  <span className="num">{offer.price}</span> <small className="muted">{offer.unit}</small>
                </p>
                <ul className="bullets">
                  {offer.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link className={featured ? "btn btn-primary" : "btn"} href={`/${lang}/commande#${key}`}>
                  {offer.cta}
                </Link>
              </article>
            );
          })}
        </InView>
        <p className="small muted measure offers-legal">{t.offers.legal}</p>
      </div>
    </section>
  );
}
