import Link from "next/link";
import { notFound } from "next/navigation";
import { applications, missionInvitations, missions } from "@proofseen/db";
import { EmptyNote } from "@/components/EmptyState";
import { ApplicantsBoard } from "@/components/market/ApplicantsBoard";
import { InvitePanel, MissionTools } from "@/components/market/MissionCompanyTools";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { ProfilesForMission } from "@/components/market/ProfilesForMission";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day, money } from "@/lib/format";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { closeMission, decideApplication, publishMission } from "../actions";
import { duplicateMission, inviteFreelancer, saveTemplate } from "../company-actions";
import { addSuggestedToList } from "../matching-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string; ordre?: string; invitation?: string; modele?: string; liste?: string }>;
}

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

/** One mission of the company, with its applications by status, invitations and tools. Members only: anyone else gets 404. */
export default async function MissionPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const m = dict.missions;
  const s = dict.missionsSpace;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const organisation = await currentOrganisation(market);
  const mission = organisation === null ? undefined : (await missions(market.db).listForOrganisation(market.actor, organisation.id))?.find((item) => item.id === id);
  if (mission === undefined) notFound();
  const { erreur, ordre, invitation, modele, liste } = await searchParams;
  const newest = ordre === "recentes";
  const [applicants, sent] = await Promise.all([
    applications(market.db).listForMission(market.actor, id, newest ? "newest" : "oldest"),
    missionInvitations(market.db).listForMission(market.actor, id),
  ]);
  const d = m.detail;
  const rate = m.apply.rate(
    mission.dailyRateMinCents === null ? null : money(mission.dailyRateMinCents, mission.currency, lang),
    mission.dailyRateMaxCents === null ? null : money(mission.dailyRateMaxCents, mission.currency, lang),
  );
  const error = erreur === "verrouillee" ? m.form.errors.locked : erreur === "trop" ? m.form.errors.tooMany : erreur === "brouillons" ? m.form.errors.drafts : null;

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
            {mission.publishedAt === null ? null : ` · ${d.publishedOn} ${day(mission.publishedAt, lang)}`}
            {mission.closedAt === null ? null : ` · ${d.closedOn} ${day(mission.closedAt, lang)}`}
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
        {mission.questions.length === 0 ? null : (
          <>
            <h3>{s.form.questions}</h3>
            <ol>
              {mission.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </>
        )}
      </section>

      {mission.status === "draft" ? null : (
        <section className="ws-block" aria-labelledby="applicants-title">
          <h2 id="applicants-title">{s.board.title}</h2>
          {applicants === null || applicants.length === 0 ? (
            <EmptyNote>{d.applicantsEmpty}</EmptyNote>
          ) : (
            <>
              <p className="muted small">{s.board.lead}</p>
              <p className="small">
                <Link href={`/${lang}/app/missions/${mission.id}${newest ? "" : "?ordre=recentes"}`}>{newest ? d.oldestFirst : d.newestFirst}</Link>
              </p>
              <ApplicantsBoard lang={lang} m={m} s={s} missionId={mission.id} applicants={applicants} decide={decideApplication} />
            </>
          )}
        </section>
      )}

      {mission.status === "closed" ? null : (
        <ProfilesForMission lang={lang} market={market} missionId={mission.id} organisationId={mission.organisationId} open={mission.status === "open"} notice={liste} invite={inviteFreelancer} addToList={addSuggestedToList} />
      )}
      {mission.status === "open" ? <InvitePanel lang={lang} s={s} missionId={mission.id} sent={sent ?? []} notice={invitation} action={inviteFreelancer} /> : null}
      <MissionTools lang={lang} s={s} missionId={mission.id} title={mission.title} notice={modele} duplicate={duplicateMission} saveTemplate={saveTemplate} />
    </>
  );
}
