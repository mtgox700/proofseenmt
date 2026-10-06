import { CONTACT_NOTE, EVIDENCE_KINDS, LABELS } from "@proofseen/profiles";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestProfile } from "@/components/app/RequestProfile";
import { EmptyState } from "@/components/EmptyState";
import { Availability } from "@/components/workspace/Availability";
import { getSource } from "@/data/file-source";
import { dictionary, isLang, LANGS, type Lang } from "@/i18n";
import { date } from "@/lib/format";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
}

export const dynamicParams = false;

/** The contact block depends on who is signed in: rendered per request. */
export const dynamic = "force-dynamic";

export async function generateStaticParams(): Promise<{ lang: Lang; id: string }[]> {
  const { profiles } = await getSource().profiles();
  return LANGS.flatMap((lang) => profiles.map((profile) => ({ lang, id: profile.id })));
}

/** The package writes "Facture — nous contrôlons…": the term becomes the label, the rest a sentence. */
const capitalise = (text: string): string => text.charAt(0).toLocaleUpperCase("fr") + text.slice(1);

const findProfile = async (id: string) => (await getSource().profiles()).profiles.find((profile) => profile.id === id) ?? null;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, id } = await params;
  const profile = await findProfile(id);
  return isLang(lang) && profile !== null ? { title: `${profile.handle} · ${profile.id}` } : {};
}

/*
 * A freelancer's page, as a recruiter sees it: the missions and HOW each was verified, never the document itself.
 * The method texts are the ones the public profile pages already publish (@proofseen/profiles), not a second copy.
 */
export default async function ProfilePage({ params }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const profile = await findProfile(id);
  if (profile === null) notFound();
  const t = dictionary(lang);
  const method = LABELS[lang];

  return (
    <>
      <p>
        <Link href={`/${lang}/entreprise`}>{t.profile.back}</Link>
      </p>
      <header>
        <h1>{profile.handle}</h1>
        <p className="profile-headline">{profile.headline[lang]}</p>
        <div className="profile-row-head">
          <code className="muted">{profile.id}</code>
          <Availability lang={lang} t={t} availability={profile.availability} />
          <span className="muted small">
            {t.directory.updated} {date(profile.availability.updatedAt, lang)}
          </span>
        </div>
        <dl className="meta-strip">
          <div>
            <dt>{t.profile.area}</dt>
            <dd>{profile.area}</dd>
          </div>
          <div>
            <dt>{t.profile.seniority}</dt>
            <dd lang="fr">{profile.seniority}</dd>
          </div>
          <div>
            <dt>{t.directory.rate}</dt>
            <dd>{profile.rate === null ? t.directory.rateNone : `${profile.rate.min} - ${profile.rate.max} €`}</dd>
          </div>
          {profile.sectors.length === 0 ? null : (
            <div>
              <dt>{t.profile.sectors}</dt>
              <dd lang="fr">{profile.sectors.join(", ")}</dd>
            </div>
          )}
        </dl>
      </header>

      <section className="ws-block" aria-labelledby="summary-title">
        <h2 id="summary-title">{t.profile.summary}</h2>
        <p className="measure">{profile.summary[lang]}</p>
        <h3>{t.profile.skills}</h3>
        <ul className="skills">
          {profile.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </section>

      <section className="ws-block" aria-labelledby="missions-title">
        <h2 id="missions-title">{t.profile.missionsTitle}</h2>
        {profile.missions.length === 0 ? (
          <EmptyState title={t.directory.missionsNone} headingLevel={3}>
            <p>{t.profile.missionsEmpty}</p>
          </EmptyState>
        ) : (
          <ol className="missions">
            {profile.missions.map((mission, i) => (
              <li key={`${mission.role.fr}-${i}`}>
                <h3>{mission.role[lang]}</h3>
                <dl className="profile-facts">
                  <div>
                    <dt>{t.profile.clientKind}</dt>
                    <dd>{t.profile.kinds[mission.clientKind] ?? mission.clientKind}</dd>
                  </div>
                  <div>
                    <dt>{t.profile.duration}</dt>
                    <dd className="num">{t.profile.months(mission.durationMonths)}</dd>
                  </div>
                  <div>
                    <dt>{t.profile.evidence}</dt>
                    <dd>{mission.evidence.map((kind) => method.evidenceShort[kind]).join(", ")}</dd>
                  </div>
                  <div>
                    <dt>{t.profile.verifiedAt}</dt>
                    <dd>{date(mission.verifiedAt, lang)}</dd>
                  </div>
                </dl>
                <ul className="bullets">
                  {mission.achievements.map((achievement) => (
                    <li key={achievement.fr}>{achievement[lang]}</li>
                  ))}
                </ul>
                <p className="muted small">
                  {t.profile.stack}
                  {lang === "fr" ? " : " : ": "}
                  {mission.stack.join(", ")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="ws-block" aria-labelledby="method-title">
        <h2 id="method-title">{t.profile.methodTitle}</h2>
        <p className="ws-note">{t.profile.methodLead}</p>
        <dl className="rules-list">
          {EVIDENCE_KINDS.map((kind) => {
            const [name, ...rest] = method.evidenceLong[kind].split(" — ");
            return (
              <div key={kind}>
                <dt>{name}</dt>
                <dd className="muted small">{capitalise(rest.join(" "))}</dd>
              </div>
            );
          })}
        </dl>
        <h3>{t.profile.limitsTitle}</h3>
        <p className="muted measure">{method.methodLimitsText}</p>
      </section>

      <section className="ws-block" aria-labelledby="contact-title">
        <h2 id="contact-title">{t.profile.contactTitle}</h2>
        <p className="measure">{CONTACT_NOTE[lang]}</p>
        <RequestProfile lang={lang} t={t} profileId={profile.id} />
      </section>
    </>
  );
}
