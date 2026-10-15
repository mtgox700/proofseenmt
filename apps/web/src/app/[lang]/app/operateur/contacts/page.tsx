import { notFound } from "next/navigation";
import { contactReviews, FIRST_CONTACT_REVIEW } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { LangField, Outcome, ReasonField } from "@/components/operator/OperatorParts";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { operatorPage } from "@/lib/operator";
import { clearContact, closeContact } from "../contact-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ etat?: string }>;
}

/** First messages from recent companies, oldest first. Reading the first message is the point of the review. */
export default async function ContactsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const c = o.contacts;
  const pending = await contactReviews(context.db, context.operator).pending();
  const { etat } = await searchParams;

  return (
    <>
      <header className="app-head">
        <h1>{c.title}</h1>
        <p className="muted measure">{c.lead(FIRST_CONTACT_REVIEW.newAccountDays)}</p>
      </header>
      <Outcome flag={etat} o={o} />
      {pending.length === 0 ? (
        <p className="muted">{o.common.empty}</p>
      ) : (
        <ul className="op-list">
          {pending.map((item) => (
            <li key={item.conversationId} className="op-item">
              <p>
                <strong>{c.from}</strong> · {item.organisation.name}{" "}
                <span className="muted small">
                  {c.created} {day(item.organisation.createdAt, lang)}
                </span>{" "}
                · <strong>{c.to}</strong> · {item.profileReference}
              </p>
              {item.firstMessage === null ? null : (
                <>
                  <blockquote>{item.firstMessage.body}</blockquote>
                  {item.firstMessage.containsContact ? <span className="tag">{c.contactFlag}</span> : null}
                </>
              )}
              <div className="op-forms">
                <form action={clearContact}>
                  <LangField lang={lang} />
                  <input type="hidden" name="conversationId" value={item.conversationId} />
                  <button type="submit" className="btn">
                    {c.ok}
                  </button>
                </form>
                <form action={closeContact}>
                  <LangField lang={lang} />
                  <input type="hidden" name="conversationId" value={item.conversationId} />
                  <ReasonField id={`close-${item.conversationId}`} o={o} />
                  <button type="submit" className="btn btn-quiet">
                    {c.close}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
