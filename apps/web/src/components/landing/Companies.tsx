import type { Dictionary, Lang } from "@/i18n";

interface CompaniesProps {
  readonly lang: Lang;
  readonly t: Dictionary;
}

/*
 * The company side, in words, and the way to the public directory of published profiles. No sample card: a profile
 * shown here would have to come from the database, and the directory already shows them as they are.
 */
export function Companies({ lang, t }: CompaniesProps) {
  return (
    <section className="section companies" id="entreprises" aria-labelledby="companies-title">
      <div className="wrap">
        <h2 id="companies-title">{t.companies.title}</h2>
        <p className="muted measure pretty companies-text">{t.companies.text}</p>
        <ul className="bullets companies-points">
          {t.companies.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <a className="btn btn-primary" href={`/${lang}/freelances`}>
          {t.companies.cta}
        </a>
      </div>
    </section>
  );
}
