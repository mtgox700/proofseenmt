import type { PublicProfile } from "@proofseen/profiles";
import Link from "next/link";
import { Availability } from "@/components/workspace/Availability";
import type { Dictionary, Lang } from "@/i18n";
import { date } from "@/lib/format";

interface CompaniesProps {
  readonly lang: Lang;
  readonly t: Dictionary;
  /** The freshest published profile, shown as the real directory card it is (never a mock-up). */
  readonly profile: PublicProfile | null;
}

export function Companies({ lang, t, profile }: CompaniesProps) {
  return (
    <section className="section companies" id="entreprises" aria-labelledby="companies-title">
      <div className="wrap companies-grid">
        <div>
          <h2 id="companies-title">{t.companies.title}</h2>
          <p className="muted measure pretty companies-text">{t.companies.text}</p>
          <ul className="bullets companies-points">
            {t.companies.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <Link className="btn btn-primary" href={`/${lang}/entreprise`}>
            {t.companies.cta}
          </Link>
        </div>
        {profile === null ? null : (
          <Link className="profile-card" href={`/${lang}/entreprise/${profile.id}`} aria-label={`${profile.handle}, ${profile.headline[lang]}`}>
            <span className="profile-card-top">
              <span className="profile-card-handle">{profile.handle}</span>
              <Availability lang={lang} t={t} availability={profile.availability} />
            </span>
            <span className="profile-card-headline">{profile.headline[lang]}</span>
            <span className="muted small">
              {profile.area} · {profile.seniority}
            </span>
            <span className="skills" aria-hidden="true">
              {profile.skills.slice(0, 6).map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </span>
            <span className="profile-card-facts">
              <span>
                <span className="muted small">{t.directory.missions}</span>
                <b>{profile.verifiedMissions === 0 ? t.directory.missionsNone : profile.verifiedMissions}</b>
              </span>
              <span>
                <span className="muted small">{t.directory.updated}</span>
                <b>{date(profile.availability.updatedAt, lang)}</b>
              </span>
            </span>
            <span className="profile-card-id">
              <code>{profile.id}</code>
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
