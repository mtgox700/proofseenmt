import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderCta } from "@/components/order/OrderCta";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { dictionary, isLang } from "@/i18n";
import { paymentLinks, type OfferKey } from "@/lib/payment";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).order.metaTitle } : {};
}

/*
 * The order page: every commitment is printed above the button, never behind a link opened afterwards (US-P01). The
 * buttons lead to Stripe Payment Links once the acceptance box is ticked.
 */
export default async function OrderPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const o = t.order;
  const links = paymentLinks();

  return (
    <>
      <SiteHeader lang={lang} t={t} variant="site" />
      <main id="contenu" tabIndex={-1} className="wrap order">
        <p>
          <Link href={`/${lang}`}>{o.back}</Link>
        </p>
        <header className="order-head">
          <h1>{o.title}</h1>
          <p className="muted measure pretty">{o.lead}</p>
        </header>

        <div className="order-offers">
          {o.items.map((item) => (
            <article key={item.key} id={item.key} className="order-offer" aria-labelledby={`order-${item.key}`} data-featured={item.key === "turnkey" || undefined}>
              <header>
                <h2 id={`order-${item.key}`}>{item.name}</h2>
                <p className="offer-price">
                  <span className="num">{item.price}</span> <small className="muted">{item.unit}</small>
                </p>
                <p className="muted">{item.scope}</p>
              </header>
              <div className="order-lists">
                <div>
                  <h3>{o.includesTitle}</h3>
                  <ul className="bullets">
                    {item.includes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>{o.excludesTitle}</h3>
                  <ul className="order-excludes">
                    {item.excludes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <OrderCta
                href={links[item.key as OfferKey] ?? null}
                cta={item.cta}
                accept={o.accept}
                acceptFirst={o.acceptFirst}
                unavailable={o.unavailable}
                secure={o.secure}
              />
            </article>
          ))}
        </div>

        <section className="order-terms" aria-labelledby="terms-title">
          <h2 id="terms-title">{o.terms.title}</h2>
          <p>
            <strong>{o.terms.delivery}</strong>
          </p>
          <p>{o.terms.withdrawal}</p>
          <h3>{o.terms.refundTitle}</h3>
          <dl className="order-refunds">
            {o.terms.refunds.map((refund) => (
              <div key={refund.when}>
                <dt>{refund.when}</dt>
                <dd className="muted">{refund.then}</dd>
              </div>
            ))}
          </dl>
          <h3>{o.terms.neverTitle}</h3>
          <p>{o.terms.never}</p>
          <h3>{o.terms.noPromiseTitle}</h3>
          <ul className="bullets">
            {o.terms.noPromise.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
