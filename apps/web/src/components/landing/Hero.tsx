import Link from "next/link";
import type { AnswersSnapshot } from "@/data/schema";
import type { Dictionary, Lang } from "@/i18n";
import { AnswerField, type FieldPoint } from "./AnswerField";

interface HeroProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  readonly answers: AnswersSnapshot | null;
}

export function Hero({ lang, t, answers }: HeroProps) {
  const points: FieldPoint[] = (answers?.answers ?? []).map((a) => ({
    engine: a.engine,
    category: a.category,
    offer: a.offer,
    control: a.control,
    domains: a.domains,
    other: a.other,
  }));
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title">
            {t.hero.titleStart} <em>{t.hero.titleEmphasis}</em>
          </h1>
          <p className="hero-lead pretty">{t.hero.lead}</p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href={`/${lang}/inscription`}>
              {t.hero.primary}
            </Link>
            <a className="btn" href={`/${lang}/missions`}>
              {t.hero.secondary}
            </a>
          </div>
        </div>
        {answers === null ? null : (
          <AnswerField t={t.field} engines={answers.engines.map((engine) => t.field.engines[engine] ?? engine)} offers={answers.offers} points={points} />
        )}
      </div>
    </section>
  );
}
