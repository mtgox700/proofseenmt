import { ORDERING_NOTE } from "@proofseen/profiles";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { Availability } from "@/components/workspace/Availability";
import { getSource } from "@/data/file-source";
import { dictionary, isLang } from "@/i18n";
import { parseCriteria, runSearch } from "@/lib/directory";
import { count, date } from "@/lib/format";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Filters live in the query string: this page is rendered per request, never frozen at build time. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).directory.title } : {};
}

/*
 * Recruiter search. A plain GET form: it works without JavaScript, the URL is shareable, and the back button restores
 * the filters. Results are ordered by freshness or by identifier only (AI Act, Annex III point 4): no score, no rank.
 */
export default async function DirectoryPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const criteria = parseCriteria(await searchParams);
  const snapshot = await getSource().profiles();
  const results = runSearch(snapshot.profiles, criteria);
  const f = t.directory.form;

  return (
    <>
      <header>
        <h1>{t.directory.title}</h1>
        <p className="muted measure">{t.directory.lead}</p>
      </header>

      <form className="filters" method="get" role="search" aria-label={t.directory.title}>
        <div className="field">
          <label htmlFor="skill">{f.skill}</label>
          <input id="skill" name="skill" type="search" defaultValue={criteria.skill ?? ""} maxLength={60} autoComplete="off" aria-describedby="skill-hint" />
          <p id="skill-hint" className="field-hint">{f.skillHint}</p>
        </div>
        <div className="field">
          <label htmlFor="area">{f.area}</label>
          <input id="area" name="area" type="search" defaultValue={criteria.area ?? ""} maxLength={60} autoComplete="address-level2" aria-describedby="area-hint" />
          <p id="area-hint" className="field-hint">{f.areaHint}</p>
        </div>
        <div className="field">
          <label htmlFor="sort">{f.sort}</label>
          <select id="sort" name="sort" defaultValue={criteria.sort}>
            <option value="freshness">{t.directory.sort.freshness}</option>
            <option value="id">{t.directory.sort.id}</option>
          </select>
        </div>
        <div className="field field-check">
          <input id="available" name="available" type="checkbox" value="1" defaultChecked={criteria.availableOnly} />
          <label htmlFor="available">{f.available}</label>
        </div>
        <div className="filters-actions">
          <button type="submit" className="btn btn-primary">{f.submit}</button>
          <Link className="btn" href={`/${lang}/entreprise`}>{f.reset}</Link>
        </div>
      </form>

      <section className="ws-block" aria-labelledby="results-title">
        <div className="results-head">
          <h2 id="results-title" className="num" aria-live="polite">{t.directory.results(results.length)}</h2>
          <p className="ws-note">{criteria.sort === "id" ? t.directory.idNote : ORDERING_NOTE[lang]}</p>
        </div>

        {results.length === 0 ? (
          <EmptyState title={t.directory.empty} headingLevel={3}>
            <p>
              <Link href={`/${lang}/entreprise`}>{f.reset}</Link>
            </p>
          </EmptyState>
        ) : (
          <ul className="profiles profiles-grid">
            {results.map((profile) => (
              <li key={profile.id}>
                <article aria-labelledby={`p-${profile.id}`}>
                  <div className="profile-row-head">
                    <h3 id={`p-${profile.id}`}>
                      <Link href={`/${lang}/entreprise/${profile.id}`}>{profile.handle}</Link>
                    </h3>
                    <code className="muted">{profile.id}</code>
                    <Availability lang={lang} t={t} availability={profile.availability} />
                  </div>
                  <p>{profile.headline[lang]}</p>
                  <p className="muted small">
                    {profile.area} · {profile.seniority}
                  </p>
                  <ul className="skills" aria-label={t.profile.skills}>
                    {profile.skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                  <dl className="profile-facts">
                    <div>
                      <dt>{t.directory.missions}</dt>
                      <dd className="num">{profile.verifiedMissions === 0 ? t.directory.missionsNone : count(profile.verifiedMissions, lang)}</dd>
                    </div>
                    <div>
                      <dt>{t.directory.rate}</dt>
                      <dd className="num">{profile.rate === null ? t.directory.rateNone : `${count(profile.rate.min, lang)} - ${count(profile.rate.max, lang)} €`}</dd>
                    </div>
                    <div>
                      <dt>{t.directory.updated}</dt>
                      <dd>{date(profile.availability.updatedAt, lang)}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
