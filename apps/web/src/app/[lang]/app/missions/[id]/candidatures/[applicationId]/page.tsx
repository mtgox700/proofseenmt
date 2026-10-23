import "@proofseen/brand/profile-card.css";
import "@/styles/app-choisir.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { applicationDetails, profileCardsInOrder } from "@proofseen/db";
import { FactLines } from "@/components/market/FactLines";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { ProfileResultCard } from "@/components/search/ProfileResultCard";
import { ReferenceCard } from "@/components/search/ReferenceCard";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { candidateFactLines } from "@/lib/candidate-facts";
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
 * facts, the attached CV. The first opening is dated for the freelancer ("read on …"); who opened it stays with the
 * company. The CV link goes through `/fichiers/<id>`, which checks the same rules again and serves it as a download.
 */
export default async function ApplicationPage({ params }: PageProps) {
  const { lang, id, applicationId } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const m = dict.missions;
  const s = dict.missionsSpace;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const now = new Date();
  const detail = await applicationDetails(market.db).open(market.actor, applicationId, now);
  if (detail === null || detail.mission.id !== id) notFound();
  // The one profile card while the profile is published; afterwards, its reference and the facts the application carried.
  const [card] = detail.profile.slug === null ? [] : await profileCardsInOrder(market.db, [detail.profile.id], now);
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
        <div className="choice-one">
          {card === undefined ? (
            <ReferenceCard reference={detail.profile.reference} title={dict.search.card.pseudonym(detail.profile.reference)} headingId={`card-${detail.applicationId}`} {...(detail.profile.slug === null ? { note: s.detail.privateProfile } : {})}>
              <FactLines lines={candidateFactLines(detail.profile, s.board)} label={s.board.factsLabel(detail.profile.reference)} />
            </ReferenceCard>
          ) : (
            <ProfileResultCard lang={lang} card={card} now={now}>
              {card.slug === null ? null : (
                // The public page is raw HTML from a route handler: a plain link, a full page load.
                <a className="btn" href={`/${lang}/profils/${card.slug}`}>
                  {s.detail.profile}
                </a>
              )}
            </ProfileResultCard>
          )}
        </div>
      </section>

      <section className="ws-block" aria-labelledby="cv-title">
        <h2 id="cv-title">{s.detail.cvTitle}</h2>
        {detail.cvFileId === null ? (
          <p className="muted small">{s.detail.noCv}</p>
        ) : (
          <>
            <p>
              {/* A route handler, not a page: a plain link, never prefetched. */}
              <a className="btn" href={`/fichiers/${detail.cvFileId}`} download>
                {s.detail.downloadCv}
              </a>
            </p>
            <p className="muted small">{s.detail.cvHint}</p>
          </>
        )}
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
