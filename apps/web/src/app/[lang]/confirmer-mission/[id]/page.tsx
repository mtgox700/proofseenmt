import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb, missionConfirmations, monthsBetween, type ConfirmationView, type TokenLookup } from "@proofseen/db";
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
import "@/styles/market.css";

/*
 * Public page of a signed confirmation link: the client's contact reads the declared mission and confirms or declines
 * it, without an account. It shows the minimum — who asks (name or public reference, never a contact detail), the
 * role, the period, the summary — and is never indexed nor sent as a referrer. Opening it decides nothing.
 */

/** Per request, never cached: the answer depends on the token and on the request as it is right now. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ t?: string; fait?: string; etat?: string; erreur?: string }>;
}

type P = MarketDictionary["confirmations"]["public"];

function Shell({ lang, t, children }: { readonly lang: Lang; readonly t: Dictionary; readonly children: React.ReactNode }) {
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="app" />
      <main id="contenu" tabIndex={-1} className="wrap space">
        {children}
      </main>
      <SiteFooter t={t} />
    </>
  );
}

const closedCopy = (p: P, state: string | undefined): readonly [string, string] | null => {
  if (state === "confirmee") return [p.confirmedTitle, p.confirmedText];
  if (state === "refusee") return [p.refusedTitle, p.refusedText];
  if (state === "expiree" || state === "expired") return [p.expiredTitle, p.expiredText];
  if (state === "decidee" || state === "decided") return [p.decidedTitle, p.decidedText];
  if (state === "invalide" || state === "invalid") return [p.invalidTitle, p.invalidText];
  return null;
};

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
      <dl className="meta-strip">
        <div>
          <dt>{p.role}</dt>
          <dd>{view.role}</dd>
        </div>
        <div>
          <dt>{p.period}</dt>
          <dd>{c.period(month(view.startedOn, lang), month(view.endedOn, lang))}</dd>
        </div>
        <div>
          <dt>{p.duration}</dt>
          <dd>{c.months(monthsBetween(view.startedOn, view.endedOn))}</dd>
        </div>
      </dl>
      <h2>{p.summary}</h2>
      <p className="measure">{view.summary}</p>
      <p className="muted measure">{p.effect}</p>
      <ConfirmationDecisionForm action={decideMissionByLink} d={c.decision} hidden={{ lang, id: view.id, t: token }} idPrefix="confirm" />
      <p className="muted small">{p.expires(day(view.expiresAt, lang))}</p>
    </article>
  );
}

const lookup = async (id: string | null, token: string | undefined): Promise<TokenLookup> => {
  if (id === null || token === undefined || token === "" || !hasDatabase()) return { kind: "invalid" };
  return missionConfirmations(getDb()).lookupByToken(id, token, new Date());
};

export default async function ConfirmMissionPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const m = marketDictionary(lang);
  const p = m.confirmations.public;
  const query = await searchParams;
  const done = closedCopy(p, query.fait ?? query.etat);
  const found = done === null ? await lookup(uuidOf(id), query.t) : null;
  const closed = done ?? (found === null || found.kind === "open" ? null : closedCopy(p, found.kind));

  return (
    <Shell lang={lang} t={t}>
      {found !== null && found.kind === "open" && query.t !== undefined ? (
        <Mission lang={lang} m={m} view={found.view} token={query.t} throttledNotice={query.erreur === "trop"} />
      ) : (
        <>
          <h1 className="sr-only">{p.title}</h1>
          <EmptyState title={closed?.[0] ?? p.invalidTitle}>
            <p>{closed?.[1] ?? p.invalidText}</p>
          </EmptyState>
        </>
      )}
    </Shell>
  );
}
