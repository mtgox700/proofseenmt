import Link from "next/link";
import { notFound } from "next/navigation";
import { inbox, InvalidCursorError, messaging } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { date } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { closeConversation, decideConversation, postMessage } from "../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string; avant?: string }>;
}

const MAX_BODY = 10_000;

const errorText = (code: string | undefined, m: MarketDictionary): string | null => {
  switch (code) {
    case undefined:
      return null;
    case "trop":
      return m.thread.tooMany;
    case "invalide":
      return m.thread.invalid;
    case "coordonnees":
      return m.thread.contactBlocked;
    case "existant":
      return m.contact.existing;
    default:
      return m.thread.notAllowed;
  }
};

/*
 * One conversation, for its two sides only (anyone else gets 404: a thread's existence is private). Messages read
 * oldest to newest; « older messages » pages back through the history.
 */
export default async function ThreadPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const { erreur, avant } = await searchParams;
  const head = await inbox(market.db).thread(market.actor, id);
  if (head === null) notFound();
  const page = await messaging(market.db)
    .listMessages(market.actor, id, { cursor: avant })
    .catch((error: unknown) => {
      if (error instanceof InvalidCursorError) return null;
      throw error;
    });
  if (page === null) notFound();
  const counterpart = head.counterpart.kind === "organisation" ? head.counterpart.name : head.counterpart.reference;
  const messages = [...page.items].reverse();
  const error = errorText(erreur, m);
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  return (
    <>
      <p>
        <Link href={`/${lang}/app/messages`}>← {m.thread.back}</Link>
      </p>
      <header className="app-head">
        <h1>{counterpart}</h1>
        <p className="thread-meta">
          <StatusTag status={head.status} label={m.inbox.status[head.status]} />
          <span className="muted small">
            {head.missionTitle === null ? m.inbox.direct : `${m.inbox.about} : ${head.missionTitle}`}
            {head.counterpart.kind === "profile" && head.counterpart.headline !== null ? ` · ${head.counterpart.headline}` : null}
          </span>
        </p>
        {head.side === "company" && head.status === "pending" ? <p className="muted measure">{m.thread.waitingCompany}</p> : null}
      </header>

      {page.next === null ? null : (
        <p>
          <Link href={`/${lang}/app/messages/${id}?avant=${encodeURIComponent(page.next)}`}>↑ {m.thread.older}</Link>
        </p>
      )}

      <ol className="bubbles">
        {messages.map((message) => {
          const mine = message.senderUserId === market.actor.userId;
          return (
            <li key={message.id} data-from={mine ? "mine" : "other"} data-mine={mine || undefined}>
              <span className="bubble-who small">{mine ? m.inbox.you : counterpart}</span>
              <p className="bubble-body">{message.body}</p>
              {message.containsContact ? <span className="tag tag-quiet small">{m.thread.flagged}</span> : null}
              <time className="bubble-at small muted" dateTime={message.createdAt.toISOString()}>
                {date(message.createdAt.toISOString(), lang)}
              </time>
            </li>
          );
        })}
      </ol>

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {head.canDecide ? (
        <form action={decideConversation} className="decision">
          {hidden("lang", lang)}
          {hidden("conversationId", id)}
          <p className="measure">{m.thread.decideLead}</p>
          <div className="empty-actions">
            <button type="submit" name="decision" value="accepted" className="btn btn-primary">
              {m.thread.accept}
            </button>
            <button type="submit" name="decision" value="declined" className="btn">
              {m.thread.decline}
            </button>
          </div>
        </form>
      ) : null}

      {head.canPost ? (
        <>
          <form action={postMessage} className="reply">
            {hidden("lang", lang)}
            {hidden("conversationId", id)}
            <div className="field">
              <label htmlFor="body">{m.thread.reply}</label>
              <textarea id="body" name="body" required maxLength={MAX_BODY} rows={4} aria-describedby="body-hint" />
              <p id="body-hint" className="field-hint">
                {m.thread.replyHint}
              </p>
            </div>
            <button type="submit" className="btn btn-primary">
              {m.thread.send}
            </button>
          </form>
          <form action={closeConversation} className="thread-close">
            {hidden("lang", lang)}
            {hidden("conversationId", id)}
            <button type="submit" className="btn btn-quiet" aria-describedby="close-hint">
              {m.thread.close}
            </button>
            <span id="close-hint" className="muted small">
              {m.thread.closeHint}
            </span>
          </form>
        </>
      ) : head.status === "declined" ? (
        <p className="muted">{m.thread.declined}</p>
      ) : head.status === "closed" ? (
        <p className="muted">{m.thread.closed}</p>
      ) : null}
    </>
  );
}
