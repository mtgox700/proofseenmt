import { notFound } from "next/navigation";
import { missionConfirmations, monthsBetween, type CompanyConfirmationRequest, type CompanyDecidedRequest } from "@proofseen/db";
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

/**
 * The notice above the list. A failure comes from the action's code; a success only from a decision read in the
 * database, within the companies the person administers: any other id (unknown, pending, someone else's) shows nothing.
 */
const notice = (c: C, lang: Lang, erreur: string | null, decided: CompanyDecidedRequest | null): { readonly ok: boolean; readonly text: string } | null => {
  const errors: Readonly<Record<string, string>> = {
    trop: c.company.errors.tooMany,
    introuvable: c.company.errors.notFound,
    expiree: c.company.errors.expired,
    decidee: c.company.errors.decided,
    soi: c.company.errors.self,
  };
  // Own keys only: "constructor" or "__proto__" in the address must not reach an inherited value.
  const error = erreur !== null && Object.hasOwn(errors, erreur) ? errors[erreur] : undefined;
  if (error !== undefined) return { ok: false, text: error };
  if (decided === null) return null;
  const done = decided.decision === "confirmed" ? c.company.done.confirmed : c.company.done.refused;
  return { ok: true, text: done(decided.role, day(decided.decidedAt, lang)) };
};

function RequestCard({ lang, c, request }: { readonly lang: Lang; readonly c: C; readonly request: CompanyConfirmationRequest }) {
  const p = c.public;
  return (
    <li className="panel" aria-labelledby={`req-${request.id}`}>
      <h2 id={`req-${request.id}`}>{request.role}</h2>
      <p className="muted small">
        {c.company.from(request.freelancer, request.reference)} · {c.company.forCompany(request.organisationName)} · {c.company.expires(day(request.expiresAt, lang))}
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
  const message = notice(c, lang, single(query.erreur), decided);

  return (
    <>
      <header className="app-head">
        <h1>{c.company.title}</h1>
        <p className="muted measure">{c.company.lead}</p>
      </header>
      {message === null ? null : message.ok ? (
        <p className="form-ok" role="status">
          {message.text}
        </p>
      ) : (
        <p className="form-error" role="alert">
          {message.text}
        </p>
      )}
      {requests.length === 0 ? (
        <p className="muted">{c.company.empty}</p>
      ) : (
        <ul className="plain-list">
          {requests.map((request) => (
            <RequestCard key={request.id} lang={lang} c={c} request={request} />
          ))}
        </ul>
      )}
    </>
  );
}
