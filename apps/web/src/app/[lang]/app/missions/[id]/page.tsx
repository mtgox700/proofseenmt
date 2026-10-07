import Link from "next/link";
import { notFound } from "next/navigation";
import { applications, missions, type ApplicantView } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { MissionsDictionary } from "@/i18n/market/missions-fr";
import { date, money } from "@/lib/format";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { closeMission, decideApplication, publishMission } from "../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string; ordre?: string }>;
}

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

function Applicant({ lang, m, missionId, applicant }: { readonly lang: Lang; readonly m: MissionsDictionary; readonly missionId: string; readonly applicant: ApplicantView }) {
  const d = m.detail;
  const open = applicant.status === "submitted" || applicant.status === "shortlisted";
  return (
    <li className="thread-row">
      <span className="thread-who">
        <strong>{applicant.profile.reference}</strong>
        {applicant.profile.headline === null ? null : <span className="muted small"> · {applicant.profile.headline}</span>}
      </span>
      <StatusTag status={applicant.status} label={m.applicationStatus[applicant.status]} />
      <span className="thread-last muted small">
        {d.facts(applicant.profile.verifiedUrls, applicant.profile.verifiedMissions)} · {d.receivedOn} {date(applicant.createdAt.toISOString(), lang)}
      </span>
      <span className="row-actions">
        {applicant.conversationId === null ? null : (
          <Link className="btn" href={`/${lang}/app/messages/${applicant.conversationId}`}>
            {d.conversation}
          </Link>
        )}
        {open ? (
          <form action={decideApplication} className="row-actions">
            <Hidden name="lang" value={lang} />
            <Hidden name="missionId" value={missionId} />
            <Hidden name="applicationId" value={applicant.applicationId} />
            {applicant.status === "submitted" ? (
              <button type="submit" name="decision" value="shortlisted" className="btn">
                {d.shortlist}
              </button>
            ) : null}
            <button type="submit" name="decision" value="hired" className="btn btn-primary" aria-describedby="hire-hint">
              {d.hire}
            </button>
            <button type="submit" name="decision" value="declined" className="btn btn-quiet">
              {d.decline}
            </button>
          </form>
        ) : null}
      </span>
    </li>
  );
}

/** One mission of the company, with its applications. Members only: anyone else gets 404. */
export default async function MissionPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang).missions;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={marketDictionary(lang).notConfigured} />;
  const organisation = await currentOrganisation(market);
  const mission = organisation === null ? undefined : (await missions(market.db).listForOrganisation(market.actor, organisation.id))?.find((item) => item.id === id);
  if (mission === undefined) notFound();
  const { erreur, ordre } = await searchParams;
  const newest = ordre === "recentes";
  const applicants = (await applications(market.db).listForMission(market.actor, id, newest ? "newest" : "oldest")) ?? [];
  const d = m.detail;
  const rate = m.apply.rate(
    mission.dailyRateMinCents === null ? null : money(mission.dailyRateMinCents, mission.currency, lang),
    mission.dailyRateMaxCents === null ? null : money(mission.dailyRateMaxCents, mission.currency, lang),
  );
  const error = erreur === "verrouillee" ? m.form.errors.locked : erreur === "trop" ? m.form.errors.tooMany : null;

  return (
    <>
      <p>
        <Link href={`/${lang}/app/missions`}>← {d.back}</Link>
      </p>
      <header className="app-head">
        <h1>{mission.title}</h1>
        <p className="thread-meta">
          <StatusTag status={mission.status === "open" ? "accepted" : mission.status === "draft" ? "draft" : "closed"} label={m.status[mission.status]} />
          <span className="muted small">
            {m.workModes[mission.workMode]}
            {mission.city === null ? null : ` · ${mission.city}`}
            {mission.durationMonths === null ? null : ` · ${m.apply.months(mission.durationMonths)}`}
            {rate === null ? null : ` · ${rate}`}
            {mission.publishedAt === null ? null : ` · ${d.publishedOn} ${date(mission.publishedAt.toISOString(), lang)}`}
            {mission.closedAt === null ? null : ` · ${d.closedOn} ${date(mission.closedAt.toISOString(), lang)}`}
          </span>
        </p>
      </header>

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="empty-actions">
        {mission.status === "draft" ? (
          <form action={publishMission}>
            <Hidden name="lang" value={lang} />
            <Hidden name="missionId" value={mission.id} />
            <button type="submit" className="btn btn-primary" aria-describedby="publish-hint">
              {d.publish}
            </button>
          </form>
        ) : null}
        {mission.status === "closed" ? null : (
          <Link className="btn" href={`/${lang}/app/missions/${mission.id}/modifier`}>
            {d.edit}
          </Link>
        )}
        {mission.status === "open" ? (
          <>
            <Link className="btn" href={`/${lang}/missions/${mission.id}`}>
              {d.publicPage}
            </Link>
            <form action={closeMission}>
              <Hidden name="lang" value={lang} />
              <Hidden name="missionId" value={mission.id} />
              <button type="submit" className="btn btn-quiet" aria-describedby="close-hint">
                {d.close}
              </button>
            </form>
          </>
        ) : null}
      </div>
      {mission.status === "draft" ? (
        <p id="publish-hint" className="muted small">
          {d.publishHint}
        </p>
      ) : mission.status === "open" ? (
        <p id="close-hint" className="muted small">
          {d.closeHint}
        </p>
      ) : null}

      <section className="ws-block" aria-labelledby="mission-text">
        <h2 id="mission-text" className="sr-only">
          {m.form.description}
        </h2>
        <p className="bubble-body measure">{mission.description}</p>
        {mission.skills.length === 0 ? null : (
          <p className="tags">
            {mission.skills.map((skill) => (
              <span key={skill} className="tag tag-quiet">
                {skill}
              </span>
            ))}
          </p>
        )}
      </section>

      {mission.status === "draft" ? null : (
        <section className="ws-block" aria-labelledby="applicants-title">
          <h2 id="applicants-title">{d.applicantsTitle}</h2>
          {applicants.length === 0 ? (
            <p className="muted">{d.applicantsEmpty}</p>
          ) : (
            <>
              <p className="small">
                <Link href={`/${lang}/app/missions/${mission.id}${newest ? "" : "?ordre=recentes"}`}>{newest ? d.oldestFirst : d.newestFirst}</Link>
              </p>
              <ul className="threads">
                {applicants.map((applicant) => (
                  <Applicant key={applicant.applicationId} lang={lang} m={m} missionId={mission.id} applicant={applicant} />
                ))}
              </ul>
              <p id="hire-hint" className="muted small">
                {d.hireHint}
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
