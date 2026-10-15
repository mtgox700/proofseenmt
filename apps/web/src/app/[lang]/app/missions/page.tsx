import Link from "next/link";
import { notFound } from "next/navigation";
import { applications, missionInvitations, missions } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { MyInvitations } from "@/components/market/MyInvitations";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { currentOrganisation, pageMarket, type Market } from "@/lib/market";
import { withdrawApplication } from "./actions";
import { dismissInvitation } from "./space-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

async function CompanyMissions({ lang, market }: { readonly lang: Lang; readonly market: Market }) {
  const m = marketDictionary(lang).missions;
  const organisation = await currentOrganisation(market);
  if (organisation === null) {
    return (
      <EmptyState title={m.company.title} headingLevel={2}>
        <p>{m.company.noOrganisation}</p>
        <p className="empty-actions">
          <Link className="btn btn-primary" href={`/${lang}/app`}>
            {marketDictionary(lang).company.createTitle}
          </Link>
        </p>
      </EmptyState>
    );
  }
  const list = (await missions(market.db).listForOrganisation(market.actor, organisation.id)) ?? [];
  return (
    <>
      <header className="app-head">
        <h1>{m.company.title}</h1>
        <p className="muted measure">{m.company.lead}</p>
        <p>
          <Link className="btn btn-primary" href={`/${lang}/app/missions/nouvelle`}>
            {m.company.create}
          </Link>
        </p>
      </header>
      {list.length === 0 ? (
        <EmptyState title={m.company.empty} headingLevel={2}>
          <p>{m.company.emptyText}</p>
        </EmptyState>
      ) : (
        <ul className="threads">
          {list.map((mission) => (
            <li key={mission.id}>
              <Link href={`/${lang}/app/missions/${mission.id}`} className="thread-row">
                <span className="thread-who">
                  <strong>{mission.title}</strong>
                </span>
                <StatusTag status={mission.status === "open" ? "accepted" : mission.status === "draft" ? "draft" : "closed"} label={m.status[mission.status]} />
                <span className="thread-last muted">
                  {m.workModes[mission.workMode]}
                  {mission.city === null ? null : ` · ${mission.city}`}
                  {mission.skills.length === 0 ? null : ` · ${mission.skills.slice(0, 4).join(", ")}`}
                </span>
                <span className="thread-date muted small">
                  {mission.publishedAt === null ? null : day(mission.publishedAt, lang)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function MyApplications({ lang, market }: { readonly lang: Lang; readonly market: Market }) {
  const m = marketDictionary(lang).missions;
  const s = marketDictionary(lang).missionsSpace;
  const [mine, invitations] = await Promise.all([applications(market.db).listMine(market.actor), missionInvitations(market.db).listMine(market.actor)]);
  return (
    <>
      <header className="app-head">
        <h1>{m.mine.title}</h1>
        <p className="muted measure">{m.mine.lead}</p>
        <p className="small">
          {s.mine.links} <Link href={`/${lang}/app/missions/enregistrees`}>{s.mine.savedLink}</Link> ·{" "}
          <Link href={`/${lang}/app/entreprises-suivies`}>{s.mine.followsLink}</Link>
        </p>
      </header>
      <MyInvitations lang={lang} m={m} s={s} invitations={invitations} dismiss={dismissInvitation} />
      {mine.length === 0 ? (
        <EmptyState title={m.mine.empty} headingLevel={2}>
          <p>{m.mine.emptyText}</p>
          <p className="empty-actions">
            <Link className="btn btn-primary" href={`/${lang}/missions`}>
              {m.mine.browse}
            </Link>
          </p>
        </EmptyState>
      ) : (
        <ul className="threads">
          {mine.map((item) => (
            <li key={item.applicationId} className="thread-row">
              <span className="thread-who">
                <strong>{item.mission.title}</strong>
                {item.mission.status === "closed" ? <span className="muted small"> · {m.mine.missionClosed}</span> : null}
              </span>
              <StatusTag status={item.status} label={m.applicationStatus[item.status]} />
              <span className="thread-last muted small">
                {m.mine.sentOn} {day(item.createdAt, lang)}
                {item.updatedAt.getTime() === item.createdAt.getTime() ? null : ` · ${m.mine.updatedOn} ${day(item.updatedAt, lang)}`}
                {item.status === "withdrawn" ? null : ` · ${item.readAt === null ? s.mine.unread : s.mine.read(day(item.readAt, lang))}`}
              </span>
              <span className="row-actions">
                {item.conversationId === null ? null : (
                  <Link className="btn" href={`/${lang}/app/messages/${item.conversationId}`}>
                    {m.detail.conversation}
                  </Link>
                )}
                {item.status === "submitted" || item.status === "shortlisted" ? (
                  <form action={withdrawApplication}>
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="applicationId" value={item.applicationId} />
                    <button type="submit" className="btn btn-quiet">
                      {m.mine.withdraw}
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function MissionsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const market = await pageMarket(lang, ["company", "freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={marketDictionary(lang).notConfigured} />;
  return market.person.role === "company" ? <CompanyMissions lang={lang} market={market} /> : <MyApplications lang={lang} market={market} />;
}
