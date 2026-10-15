import Link from "next/link";
import { notFound } from "next/navigation";
import { applicationDetails } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { decideApplication } from "../../../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string; applicationId: string }>;
}

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

/**
 * One application, opened by a member of the company: the note, the answers to the mission's questions, the verified
 * facts. The first opening is dated for the freelancer ("read on …"); who opened it stays with the company.
 */
export default async function ApplicationPage({ params }: PageProps) {
  const { lang, id, applicationId } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const m = dict.missions;
  const s = dict.missionsSpace;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const detail = await applicationDetails(market.db).open(market.actor, applicationId, new Date());
  if (detail === null || detail.mission.id !== id) notFound();
  const open = detail.status === "submitted" || detail.status === "shortlisted";

  return (
    <>
      <p>
        <Link href={`/${lang}/app/missions/${id}`}>← {s.detail.back}</Link>
      </p>
      <header className="app-head">
        <h1>{s.detail.title(detail.profile.reference)}</h1>
        <p className="thread-meta">
          <StatusTag status={detail.status} label={m.applicationStatus[detail.status]} />
          <span className="muted small">
            {detail.mission.title} · {s.detail.sentOn} {day(detail.createdAt, lang)} · {s.detail.readOn} {day(detail.readAt, lang)}
          </span>
        </p>
        <p className="muted small">{s.detail.readHint}</p>
      </header>

      <section className="ws-block" aria-labelledby="profile-title">
        <h2 id="profile-title" className="sr-only">
          {detail.profile.reference}
        </h2>
        <p>
          <strong>{detail.profile.reference}</strong>
          {detail.profile.headline === null ? null : <span className="muted"> · {detail.profile.headline}</span>}
        </p>
        <p className="muted small">{m.detail.facts(detail.profile.verifiedUrls, detail.profile.verifiedMissions)}</p>
        <p>
          {detail.profile.slug === null ? (
            <span className="muted small">{s.detail.privateProfile}</span>
          ) : (
            <Link className="btn" href={`/${lang}/profils/${detail.profile.slug}`}>
              {s.detail.profile}
            </Link>
          )}
        </p>
      </section>

      <section className="ws-block" aria-labelledby="note-title">
        <h2 id="note-title">{s.detail.note}</h2>
        <p className="bubble-body measure">{detail.coverNote}</p>
      </section>

      {detail.answers.length === 0 ? null : (
        <section className="ws-block" aria-labelledby="answers-title">
          <h2 id="answers-title">{s.detail.answers}</h2>
          <dl className="measure">
            {detail.answers.map((item) => (
              <div key={item.question}>
                <dt>
                  <strong>{item.question}</strong>
                </dt>
                <dd className="bubble-body">{item.answer === "" ? s.detail.noAnswer : item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="empty-actions">
        {detail.conversationId === null ? null : (
          <Link className="btn" href={`/${lang}/app/messages/${detail.conversationId}`}>
            {m.detail.conversation}
          </Link>
        )}
        {open ? (
          <form action={decideApplication} className="row-actions">
            <Hidden name="lang" value={lang} />
            <Hidden name="missionId" value={id} />
            <Hidden name="applicationId" value={detail.applicationId} />
            {detail.status === "submitted" ? (
              <button type="submit" name="decision" value="shortlisted" className="btn">
                {m.detail.shortlist}
              </button>
            ) : null}
            <button type="submit" name="decision" value="hired" className="btn btn-primary">
              {m.detail.hire}
            </button>
            <button type="submit" name="decision" value="declined" className="btn btn-quiet">
              {m.detail.decline}
            </button>
          </form>
        ) : null}
      </div>
      {open ? <p className="muted small">{m.detail.hireHint}</p> : null}
    </>
  );
}
