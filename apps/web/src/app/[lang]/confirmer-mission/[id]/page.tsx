import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb, missionConfirmations, monthsBetween, type ConfirmationRecordedDecision, type ConfirmationView, type TokenLookup } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmationDecisionForm } from "@/components/market/ConfirmationDecisionForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { hasDatabase } from "@/data/intake-sink";
import { dictionary, isLang, type Dictionary, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { day, month } from "@/lib/format";
import { uuidOf } from "@/lib/market";
import { decideMissionByLink } from "./actions";
import "@/styles/workspace.css";
import "@/styles/market.css";

/*
 * Public page of a signed confirmation link: the client's contact reads the declared mission and confirms or declines
 * it, without an account. It shows the minimum: who asks (name or public reference, never a contact detail), the
 * role, the period, the summary, and is never indexed nor sent as a referrer. Opening it decides nothing.
 *
 * Every state shown here is read from the database with the token of the link: open, decided (with the answer and its
 * real date), expired. Nothing comes from the address besides the id and the token, so a crafted address without the
 * right token gets the same answer as an invalid link, never a thank-you.
 */

/** Per request, never cached: the answer depends on the token and on the request as it is right now. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ t?: string | string[]; erreur?: string | string[] }>;
}

type P = MarketDictionary["confirmations"]["public"];

function Shell({ lang, t, children }: { readonly lang: Lang; readonly t: Dictionary; readonly children: React.ReactNode }) {
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="app" />
      <main id="contenu" tabIndex={-1} className="wrap space">
        {children}
      </main>
      <SiteFooter lang={lang} t={t} />
    </>
  );
}

function Closed({ title, text, p }: { readonly title: string; readonly text: string; readonly p: P }) {
  return (
    <>
      <h1 className="sr-only">{p.title}</h1>
      <EmptyState title={title}>
        <p>{text}</p>
      </EmptyState>
    </>
  );
}

function Facts({ lang, m, view }: { readonly lang: Lang; readonly m: MarketDictionary; readonly view: ConfirmationView }) {
  const c = m.confirmations;
  return (
    <dl className="meta-strip">
      <div>
        <dt>{c.public.role}</dt>
        <dd>{view.role}</dd>
      </div>
      <div>
        <dt>{c.public.period}</dt>
        <dd>{c.period(month(view.startedOn, lang), month(view.endedOn, lang))}</dd>
      </div>
      <div>
        <dt>{c.public.duration}</dt>
        <dd>{c.months(monthsBetween(view.startedOn, view.endedOn))}</dd>
      </div>
    </dl>
  );
}

/** The answer as recorded: what was decided and on which day. Not an empty state: something did happen. */
function Decided({ lang, m, view, recorded }: { readonly lang: Lang; readonly m: MarketDictionary; readonly view: ConfirmationView; readonly recorded: ConfirmationRecordedDecision }) {
  const p = m.confirmations.public;
  const confirmed = recorded.decision === "confirmed";
  const on = day(recorded.decidedAt, lang);
  return (
    <article className="panel" aria-labelledby="confirm-title">
      <h1 id="confirm-title">{confirmed ? p.confirmedTitle : p.refusedTitle}</h1>
      <p className={confirmed ? "form-ok" : undefined}>
        <time dateTime={recorded.decidedAt.toISOString()}>{confirmed ? p.confirmedOn(on) : p.refusedOn(on)}</time>
      </p>
      <p className="muted small">{p.reference(view.reference)}</p>
      <Facts lang={lang} m={m} view={view} />
      <p className="measure">{confirmed ? p.confirmedText : p.refusedText}</p>
    </article>
  );
}

function Mission({ lang, m, view, token, throttledNotice }: { readonly lang: Lang; readonly m: MarketDictionary; readonly view: ConfirmationView; readonly token: string; readonly throttledNotice: boolean }) {
  const c = m.confirmations;
  const p = c.public;
  return (
    <article className="panel" aria-labelledby="confirm-title">
      <h1 id="confirm-title">{p.title}</h1>
      <p className="measure">{p.lead(view.freelancer, view.clientName)}</p>
      <p className="muted small">{p.reference(view.reference)}</p>
      {throttledNotice ? (
        <p className="form-error" role="alert">
          {p.tooMany}
        </p>
      ) : null}
      <Facts lang={lang} m={m} view={view} />
      <h2>{p.summary}</h2>
      <p className="measure">{view.summary}</p>
      <p className="muted measure">{p.effect}</p>
      <ConfirmationDecisionForm action={decideMissionByLink} d={c.decision} hidden={{ lang, id: view.id, t: token }} idPrefix="confirm" />
      <p className="muted small">{p.expires(day(view.expiresAt, lang))}</p>
    </article>
  );
}

const lookup = async (id: string | null, token: string | null): Promise<TokenLookup> => {
  if (id === null || token === null || token === "" || !hasDatabase()) return { kind: "invalid" };
  return missionConfirmations(getDb()).lookupByToken(id, token, new Date());
};

/** One value of a query parameter; a repeated one counts as absent. */
const single = (value: string | string[] | undefined): string | null => (typeof value === "string" ? value : null);

function Answer({ lang, m, found, token, throttledNotice }: { readonly lang: Lang; readonly m: MarketDictionary; readonly found: TokenLookup; readonly token: string | null; readonly throttledNotice: boolean }) {
  const p = m.confirmations.public;
  if (found.kind === "open" && token !== null) return <Mission lang={lang} m={m} view={found.view} token={token} throttledNotice={throttledNotice} />;
  if (found.kind === "decided") return <Decided lang={lang} m={m} view={found.view} recorded={found} />;
  if (found.kind === "expired") return <Closed p={p} title={p.expiredTitle} text={p.expiredText} />;
  return <Closed p={p} title={p.invalidTitle} text={p.invalidText} />;
}

export default async function ConfirmMissionPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const m = marketDictionary(lang);
  const query = await searchParams;
  const token = single(query.t);
  const found = await lookup(uuidOf(id), token);

  return (
    <Shell lang={lang} t={t}>
      <Answer lang={lang} m={m} found={found} token={token} throttledNotice={single(query.erreur) === "trop"} />
    </Shell>
  );
}
