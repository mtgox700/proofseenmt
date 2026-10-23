import "@/styles/app-confirmer.css";
import { notFound } from "next/navigation";
import { missionConfirmations, monthsBetween, type CompanyConfirmationRequest, type CompanyDecidedRequest } from "@proofseen/db";
import { EmptyNote } from "@/components/EmptyState";
import { ConfirmationAck } from "@/components/market/ConfirmationAck";
import { ConfirmationDecisionForm } from "@/components/market/ConfirmationDecisionForm";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { day, month } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { decideMissionConfirmation } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string | string[]; demande?: string | string[] }>;
}

type C = MarketDictionary["confirmations"];

/** One value of a query parameter; a repeated one counts as absent. */
const single = (value: string | string[] | undefined): string | null => (typeof value === "string" ? value : null);

/** The failure of a decision, from the action's code; own keys only, so "__proto__" in the address reaches nothing. */
const failure = (c: C, erreur: string | null): string | null => {
  const errors: Readonly<Record<string, string>> = {
    trop: c.company.errors.tooMany,
    introuvable: c.company.errors.notFound,
    expiree: c.company.errors.expired,
    decidee: c.company.errors.decided,
    soi: c.company.errors.self,
  };
  return erreur !== null && Object.hasOwn(errors, erreur) ? (errors[erreur] ?? null) : null;
};

/**
 * The acknowledgement of a decision, only when it is read in the database within the companies the person
 * administers: any other id (unknown, pending, someone else's) shows nothing, the same page as without it.
 */
function Decided({ lang, m, decided, now }: { readonly lang: Lang; readonly m: MarketDictionary; readonly decided: CompanyDecidedRequest; readonly now: Date }) {
  const c = m.confirmations;
  const d = m.confirmDesk.ack;
  const title = decided.decision === "confirmed" ? d.confirmedTitle(decided.role) : d.refusedTitle(decided.role);
  return (
    <ConfirmationAck lang={lang} d={d} id={decided.id} recorded={decided} by="company" reference={decided.reference} title={title} headingLevel={2} now={now}>
      <p className="ack-claim small">
        {c.company.from(decided.freelancer, decided.reference)} · {c.company.forCompany(decided.organisationName)} · {c.months(monthsBetween(decided.startedOn, decided.endedOn))}
      </p>
    </ConfirmationAck>
  );
}

function RequestCard({ lang, m, request }: { readonly lang: Lang; readonly m: MarketDictionary; readonly request: CompanyConfirmationRequest }) {
  const c = m.confirmations;
  const p = c.public;
  return (
    <li className="panel" aria-labelledby={`req-${request.id}`}>
      <h3 id={`req-${request.id}`}>{request.role}</h3>
      <p className="muted small">
        {c.company.from(request.freelancer, request.reference)} · {c.company.forCompany(request.organisationName)}
      </p>
      <p className="pending-when">
        <span className="tag tag-signal">{m.confirmDesk.pending.state}</span>
        <time dateTime={request.expiresAt.toISOString()}>{c.company.expires(day(request.expiresAt, lang))}</time>
      </p>
      <dl className="meta-strip">
        <div>
          <dt>{p.period}</dt>
          <dd>{c.period(month(request.startedOn, lang), month(request.endedOn, lang))}</dd>
        </div>
        <div>
          <dt>{p.duration}</dt>
          <dd>{c.months(monthsBetween(request.startedOn, request.endedOn))}</dd>
        </div>
      </dl>
      <p className="muted small">{c.company.declaredAs(request.clientName)}</p>
      <p className="measure">{request.summary}</p>
      <ConfirmationDecisionForm action={decideMissionConfirmation} d={c.decision} hidden={{ lang, id: request.id }} idPrefix={`req-${request.id}`} />
    </li>
  );
}

/** Mission confirmations waiting for the companies the person administers. */
export default async function ConfirmationsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const c = m.confirmations;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const repo = missionConfirmations(market.db);
  const query = await searchParams;
  const demande = single(query.demande);
  const [requests, decided] = await Promise.all([repo.listForCompany(market.actor, new Date()), demande === null ? null : repo.decidedForCompany(market.actor, demande)]);
  const error = failure(c, single(query.erreur));
  const pending = m.confirmDesk.pending;

  return (
    <>
      <header className="app-head">
        <h1>{c.company.title}</h1>
        <p className="muted measure">{c.company.lead}</p>
      </header>
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {decided === null ? null : <Decided lang={lang} m={m} decided={decided} now={new Date()} />}
      <section className="ws-block pending" aria-labelledby="pending-title">
        <div className="pending-head">
          <h2 id="pending-title">{pending.title}</h2>
          {requests.length === 0 ? null : <span className="pending-count">{pending.count(requests.length)}</span>}
        </div>
        {requests.length === 0 ? (
          <EmptyNote>{decided === null ? pending.none : pending.noneElse}</EmptyNote>
        ) : (
          <ul className="plain-list">
            {requests.map((request) => (
              <RequestCard key={request.id} lang={lang} m={m} request={request} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
