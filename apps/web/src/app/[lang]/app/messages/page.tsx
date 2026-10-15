import Link from "next/link";
import { notFound } from "next/navigation";
import { inbox, type Counterpart } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { LiveRefresh } from "@/components/live/LiveRefresh";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { pageMarket } from "@/lib/market";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

const who = (counterpart: Counterpart): string => (counterpart.kind === "organisation" ? counterpart.name : counterpart.reference);

/** Every conversation of the person, most recently active first. */
export default async function MessagesPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const threads = await inbox(market.db).threads(market.actor);
  const company = market.person.role === "company";

  return (
    <>
      <header className="app-head">
        <h1>{m.inbox.title}</h1>
        <p className="muted measure">{m.inbox.lead}</p>
      </header>
      <LiveRefresh />
      {threads.length === 0 ? (
        <EmptyState title={m.inbox.empty} headingLevel={2}>
          <p>{company ? m.inbox.emptyCompany : m.inbox.emptyFreelance}</p>
          <p className="empty-actions">
            <Link className="btn btn-primary" href={`/${lang}/missions`}>
              {m.nav.missions}
            </Link>
          </p>
        </EmptyState>
      ) : (
        <ul className="threads">
          {threads.map((thread) => (
            <li key={thread.id}>
              {/* No prefetch: opening a thread marks it read, a hover must not. */}
              <Link href={`/${lang}/app/messages/${thread.id}`} className="thread-row" prefetch={false} data-unread={thread.unread > 0 || undefined}>
                <span className="thread-who">
                  <strong>{who(thread.counterpart)}</strong>
                  {thread.unread > 0 ? <span className="tag thread-unread small">{m.live.unreadThread(thread.unread)}</span> : null}
                  <span className="muted small"> · {thread.missionTitle === null ? m.inbox.direct : `${m.inbox.about} : ${thread.missionTitle}`}</span>
                </span>
                <StatusTag status={thread.status} label={m.inbox.status[thread.status]} />
                <span className="thread-last muted">
                  {thread.lastMessage === null ? null : (
                    <>
                      {thread.lastMessage.mine ? `${m.inbox.you} : ` : null}
                      {thread.lastMessage.preview}
                    </>
                  )}
                </span>
                <span className="thread-date muted small">{day(thread.lastMessageAt, lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
