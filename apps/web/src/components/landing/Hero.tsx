import Link from "next/link";
import type { AnswersSnapshot } from "@/data/schema";
import type { Dictionary, Lang } from "@/i18n";
import { Registre } from "./Registre";

interface HeroProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly answers: AnswersSnapshot | null;
}

/*
 * The opening (STORYBOARD b.1): what the house does, in one sentence, beside the register of our own measure. Nothing
 * moves before the headline is painted; the headline is the LCP. "See the freelancers" rather than the missions: the
 * mission list is empty today, and the first door must not open on an empty room.
 */
export function Hero({ lang, t, answers }: HeroProps) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title">{t.hero.title}</h1>
          <p className="hero-lead pretty">{t.hero.lead}</p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href={`/${lang}/inscription`}>
              {t.hero.primary}
            </Link>
            <a className="btn" href={`/${lang}/freelances`}>
              {t.hero.secondary}
            </a>
          </div>
        </div>
        {answers === null ? null : <Registre lang={lang} t={t.field} answers={answers} />}
      </div>
    </section>
  );
}
