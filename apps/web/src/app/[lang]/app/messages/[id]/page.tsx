import Link from "next/link";
import { notFound } from "next/navigation";
import { contracts, contractView, dealDates, inbox, InvalidCursorError, messaging, organisations, quotes, readState, type Actor, type Db, type MessageRecord } from "@proofseen/db";
import { messageTime } from "@/components/live/message-time";
import { ThreadMessages, type ThreadMessageView } from "@/components/live/ThreadMessages";
import { DealThread } from "@/components/market/DealThread";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { QuotesSection } from "@/components/market/QuotesSection";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { contractFacts, conversationDeal, dealSteps, type DealFacts, type DealStep } from "@/lib/deal-steps";
import { pageMarket } from "@/lib/market";
import { closeConversation, decideConversation, postMessage } from "../actions";
import "@/styles/app-affaire.css";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string; avant?: string; devis?: string }>;
}

const MAX_BODY = 10_000;
const ACCEPTED_FILES = "application/pdf,image/png,image/jpeg,image/webp";

/** Attachment refusals travel as `pj-<problem>`; any other code keeps its meaning below. */
const attachmentError = (code: string, m: MarketDictionary): string | null => {
  const errors: Readonly<Record<string, string>> = m.live.attachments.errors;
  return code.startsWith("pj-") ? (errors[code.slice(3)] ?? errors.unreadable ?? null) : null;
};

const toView = (message: MessageRecord, selfId: string, lang: "fr" | "en"): ThreadMessageView => ({
  id: message.id,
  mine: message.senderUserId === selfId,
  body: message.body,
  createdAt: message.createdAt.toISOString(),
  at: messageTime(message.createdAt, lang),
  flagged: message.containsContact,
  attachments: message.attachments.map((a) => ({ id: a.id, image: a.contentType !== "application/pdf" })),
});

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
      return attachmentError(code, m) ?? m.thread.notAllowed;
  }
};

/**
 * The thread of the deal this conversation carries: read from the contract once there is one (the same lines as on the
 * contract page), from the conversation and its quotes before.
 */
async function threadOf(db: Db, actor: Actor, conversationId: string, deal: ReturnType<typeof conversationDeal>): Promise<readonly DealStep[]> {
  if (deal.contractId !== null) {
    const [contract, dates] = await Promise.all([contractView(db).find(actor, deal.contractId), dealDates(db).contract(actor, deal.contractId)]);
    if (contract !== null) return dealSteps(contractFacts({ contract, dates }));
  }
  const facts: DealFacts = { conversation: await dealDates(db).conversation(actor, conversationId), quotes: deal.quotes, contract: null, approvedAt: [], payment: null, verifiedAt: null };
  return dealSteps(facts);
}

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
  const { erreur, avant, devis } = await searchParams;
  const head = await inbox(market.db).thread(market.actor, id);
  if (head === null) notFound();
  // Opening the latest page reads the thread up to its last message; an older page of the history reads nothing new.
  const latest = avant === undefined;
  if (latest) await readState(market.db).markRead(market.actor, id);
  const otherReadAt = await readState(market.db).otherSideReadAt(market.actor, id);
  const page = await messaging(market.db)
    .listMessages(market.actor, id, { cursor: avant })
    .catch((error: unknown) => {
      if (error instanceof InvalidCursorError) return null;
      throw error;
    });
  if (page === null) notFound();
  const counterpart = head.counterpart.kind === "organisation" ? head.counterpart.name : head.counterpart.reference;
  const messages = [...page.items].reverse().map((message) => toView(message, market.actor.userId, lang));
  const error = errorText(erreur, m);
  const q = m.deals.quotes.errors;
  const quoteErrors: Readonly<Record<string, string>> = { ...q, invalide: q.invalid, etat: q.notAllowed, deja: q.alreadyAccepted, dates: q.dates, trop: q.tooMany };
  const quoteError = devis === undefined ? null : (quoteErrors[devis] ?? q.notAllowed);
  // Quotes exist once the conversation is accepted; the contract of an accepted quote is found among the person's own.
  const [threadQuotes, mine] = head.status === "pending" || head.status === "declined" ? [[], []] : await Promise.all([quotes(market.db).list(market.actor, id), contracts(market.db).listMine(market.actor)]);
  const myRole = head.side === "company" ? (await organisations(market.db).listMine(market.actor)).find((org) => org.id === head.organisationId)?.role : undefined;
  const canCommit = myRole === "owner" || myRole === "admin";
  const contractOf = new Map(mine.flatMap((contract) => (contract.quoteId === null ? [] : [[contract.quoteId, contract.id] as const])));
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;
  const deal = conversationDeal(threadQuotes ?? [], contractOf);
  const steps = await threadOf(market.db, market.actor, id, deal);
  const quotesShown = head.status !== "pending" && head.status !== "declined";
  const dealLink =
    deal.contractId !== null ? { href: `/${lang}/app/contrats/${deal.contractId}`, label: m.deals.thread.toContract } : quotesShown ? { href: "#devis", label: m.deals.thread.toQuotes } : undefined;
  const quotesSection = quotesShown ? (
    <QuotesSection lang={lang} d={m.deals} conversationId={id} side={head.side} canCommit={canCommit} open={head.canPost} quotes={threadQuotes ?? []} contractOf={contractOf} error={quoteError} />
  ) : null;

  return (
    <>
      <p>
        <Link className="back-link" href={`/${lang}/app/messages`}>
          <span aria-hidden="true">←&nbsp;</span>
          {m.thread.back}
        </Link>
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

      <DealThread lang={lang} d={m.deals.thread} steps={steps} side={head.side} headingLevel={2} link={dealLink} />

      {page.next === null ? null : (
        <p>
          <Link className="back-link" href={`/${lang}/app/messages/${id}?avant=${encodeURIComponent(page.next)}`}>
            <span aria-hidden="true">↑&nbsp;</span>
            {m.thread.older}
          </Link>
        </p>
      )}

      <ThreadMessages
        conversationId={id}
        selfId={market.actor.userId}
        lang={lang}
        live={latest}
        initial={messages}
        otherReadAt={otherReadAt?.toISOString() ?? null}
        labels={{ you: m.inbox.you, counterpart, flagged: m.thread.flagged, read: m.live.readReceipt, pdf: m.live.attachments.pdf, image: m.live.attachments.image }}
      />

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
          {quotesSection}
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
            <div className="field">
              <label htmlFor="attachments">{m.live.attachments.label}</label>
              <input id="attachments" name="attachments" type="file" multiple accept={ACCEPTED_FILES} aria-describedby="attachments-hint" />
              <p id="attachments-hint" className="field-hint">
                {m.live.attachments.hint}
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

      {head.canPost ? null : quotesSection}
    </>
  );
}
