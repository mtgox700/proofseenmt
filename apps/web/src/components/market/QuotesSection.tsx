import Link from "next/link";
import { MAX_DELIVERABLES, MAX_SCOPE_CHARS, type QuoteRecord, type Side } from "@proofseen/db";
import { EmptyNote } from "@/components/EmptyState";
import { StatusTag } from "@/components/market/StatusTag";
import type { Lang } from "@/i18n";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import { money } from "@/lib/format";
import { parisDay } from "@/lib/paris-day";
import { createContract, decideQuote, sendQuote } from "@/app/[lang]/app/messages/quote-actions";

interface QuotesSectionProps {
  readonly lang: Lang;
  readonly d: DealsDictionary;
  readonly conversationId: string;
  readonly side: Side;
  /** Owners and administrators accept quotes and create contracts; other members only read them. */
  readonly canCommit: boolean;
  readonly open: boolean;
  readonly quotes: readonly QuoteRecord[];
  /** Contract of each accepted quote that already has one. */
  readonly contractOf: ReadonlyMap<string, string>;
  readonly error: string | null;
}

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

/**
 * The quotes of a conversation, and what each side can do with them next. Placed above the reply form, and reached
 * from the thread of the deal at the head of the page (`#devis`): the commercial step is never buried under the chat.
 */
export function QuotesSection({ lang, d, conversationId, side, canCommit, open, quotes, contractOf, error }: QuotesSectionProps) {
  const q = d.quotes;
  const hasAccepted = quotes.some((quote) => quote.status === "accepted");
  // The page passes the error in words; the two that are about the object of the work point at its field.
  const scopeProblem = error !== null && (error === q.errors.scope_missing || error === q.errors.scope_contact);
  // A quote is valid until a day strictly after today, in Paris (validityInTheFuture, packages/db).
  const tomorrow = parisDay(new Date(Date.now() + 24 * 60 * 60_000));
  return (
    <section className="ws-block" id="devis" aria-labelledby="quotes-title">
      <h2 id="quotes-title">{q.title}</h2>
      {error === null ? null : (
        <p className="form-error" role="alert" id="quote-error">
          {error}
        </p>
      )}
      {quotes.length === 0 ? (
        <EmptyNote>{q.empty}</EmptyNote>
      ) : (
        <ul className="threads">
          {quotes.map((quote) => {
            const contractId = contractOf.get(quote.id);
            return (
              <li key={quote.id} className="thread-row">
                <span className="thread-who">
                  <strong>{money(quote.totalCents, quote.currency, lang)}</strong>
                  <span className="muted small"> · {q.line(money(quote.dailyRateCents, quote.currency, lang), quote.days, money(quote.totalCents, quote.currency, lang))}</span>
                </span>
                <StatusTag status={quote.status} label={q.status[quote.status]} />
                <span className="row-actions">
                  {side === "company" && canCommit && open && quote.status === "sent" ? (
                    <form action={decideQuote} className="row-actions">
                      <Hidden name="lang" value={lang} />
                      <Hidden name="conversationId" value={conversationId} />
                      <Hidden name="quoteId" value={quote.id} />
                      <button type="submit" name="decision" value="accepted" className="btn btn-primary">
                        {q.accept}
                      </button>
                      <button type="submit" name="decision" value="declined" className="btn btn-quiet">
                        {q.decline}
                      </button>
                    </form>
                  ) : null}
                  {quote.status === "accepted" && contractId !== undefined ? (
                    <Link className="btn" href={`/${lang}/app/contrats/${contractId}`}>
                      {q.openContract}
                    </Link>
                  ) : null}
                </span>
                {side === "company" && canCommit && open && quote.status === "accepted" && contractId === undefined ? (
                  <form action={createContract} className="panel-grid row-actions">
                    <Hidden name="lang" value={lang} />
                    <Hidden name="conversationId" value={conversationId} />
                    <Hidden name="quoteId" value={quote.id} />
                    <p className="muted small">{q.contractLead}</p>
                    <div className="field">
                      <label htmlFor={`startsOn-${quote.id}`}>{q.startsOn}</label>
                      <input id={`startsOn-${quote.id}`} name="startsOn" type="date" required />
                    </div>
                    <div className="field">
                      <label htmlFor={`endsOn-${quote.id}`}>{q.endsOn}</label>
                      <input id={`endsOn-${quote.id}`} name="endsOn" type="date" />
                    </div>
                    <div className="filters-actions">
                      <button type="submit" className="btn btn-primary">
                        {q.createContract}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {side === "freelance" && open && !hasAccepted ? (
        <form action={sendQuote} className="panel" aria-labelledby="quote-new">
          <Hidden name="lang" value={lang} />
          <Hidden name="conversationId" value={conversationId} />
          <h3 id="quote-new">{q.newTitle}</h3>
          <p className="muted small">{q.newLead}</p>
          <div className="panel-grid">
            <div className="field">
              <label htmlFor="quote-rate">{q.rate}</label>
              <input id="quote-rate" name="rate" type="text" inputMode="decimal" required maxLength={12} />
            </div>
            <div className="field">
              <label htmlFor="quote-days">{q.days}</label>
              <input id="quote-days" name="days" type="number" required min={1} max={1000} step={1} inputMode="numeric" />
            </div>
          </div>
          {/* The object of the work is required for a new quote (Code civil 1163, L1-144): it becomes the contract's, word for word. */}
          <div className="field">
            <label htmlFor="quote-scope">{q.scope}</label>
            <textarea
              id="quote-scope"
              name="scope"
              required
              maxLength={MAX_SCOPE_CHARS}
              rows={6}
              aria-describedby={scopeProblem ? "quote-scope-hint quote-error" : "quote-scope-hint"}
              aria-invalid={scopeProblem ? true : undefined}
            />
            <p id="quote-scope-hint" className="field-hint">
              {q.scopeHint}
            </p>
          </div>
          <div className="field">
            <label htmlFor="quote-deliverables">{q.deliverables}</label>
            <textarea id="quote-deliverables" name="deliverables" rows={4} maxLength={MAX_DELIVERABLES * 302} aria-describedby="quote-deliverables-hint" />
            <p id="quote-deliverables-hint" className="field-hint">
              {q.deliverablesHint}
            </p>
          </div>
          <div className="field">
            <label htmlFor="quote-valid-until">{q.validUntil}</label>
            <input id="quote-valid-until" name="validUntil" type="date" min={tomorrow} aria-describedby="quote-valid-until-hint" />
            <p id="quote-valid-until-hint" className="field-hint">
              {q.validUntilHint}
            </p>
          </div>
          <button type="submit" className="btn btn-primary">
            {q.send}
          </button>
        </form>
      ) : null}
    </section>
  );
}
