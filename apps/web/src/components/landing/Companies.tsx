import type { Dictionary, Lang } from "@/i18n";

interface CompaniesProps {
  readonly lang: Lang;
  readonly t: Dictionary;
}

/*
 * The company side, in words, and the way to the public directory of published profiles (STORYBOARD b.7). No sample
 * card and no counter: a profile shown here would have to come from the database, and the directory already shows
 * them as they are. Posting a mission needs an account; the link says where it leads.
 */
export function Companies({ lang, t }: CompaniesProps) {
  return (
    <section className="section companies" id="entreprises" aria-labelledby="companies-title">
      <div className="wrap companies-grid">
        <div>
          <h2 id="companies-title">{t.companies.title}</h2>
          <p className="muted measure pretty companies-text">{t.companies.text}</p>
        </div>
        <div className="companies-side">
          <ul className="bullets">
            {t.companies.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="companies-actions">
            <a className="btn" href={`/${lang}/freelances`}>
              {t.companies.cta}
            </a>
            <a className="text-link" href={`/${lang}/app/missions/nouvelle`}>
              {t.companies.publish}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
