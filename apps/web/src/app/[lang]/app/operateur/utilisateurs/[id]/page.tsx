import Link from "next/link";
import { notFound } from "next/navigation";
import { userDesk } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { LangField, Outcome, ReasonField } from "@/components/operator/OperatorParts";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { operatorPage } from "@/lib/operator";
import { restoreUser, suspendUser } from "../../user-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ etat?: string }>;
}

/** One account: facts and numbers (never a message), past decisions, suspension, GDPR export for a support request. */
export default async function UserPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const u = o.users;
  const summary = await userDesk(context.db, context.operator).summary(id);
  if (summary === null) notFound();
  const { etat } = await searchParams;
  const suspended = summary.suspendedAt !== null;

  return (
    <>
      <header className="app-head">
        <Link className="back-link" href={`/${lang}/app/operateur/utilisateurs`}>
          <span aria-hidden="true">←</span> {u.back}
        </Link>
        <h1>{summary.email}</h1>
        <p className="muted measure">
          {summary.displayName} · {u.created} {day(summary.createdAt, lang)} · {u.lang} {summary.lang}
          {suspended ? <span className="tag">{u.suspended}</span> : null}
        </p>
      </header>
      <Outcome flag={etat} o={o} />
      <section className="panel" aria-labelledby="account-facts">
        <h2 id="account-facts">{u.profile}</h2>
        {summary.profile === null ? (
          <p className="muted">{u.noProfile}</p>
        ) : (
          <p>
            {summary.profile.reference} · {u.visibility[summary.profile.visibility]}
            {summary.profile.moderatedAt === null ? null : <span className="tag">{u.hiddenTag}</span>}
          </p>
        )}
        <h3>{u.organisations}</h3>
        {summary.organisations.length === 0 ? (
          <p className="muted">{u.noOrganisation}</p>
        ) : (
          <ul className="plain-list">
            {summary.organisations.map((org) => (
              <li key={org.id}>
                {org.name} · {u.roles[org.role]}
                {org.moderatedAt === null ? null : <span className="tag">{u.hiddenTag}</span>}
              </li>
            ))}
          </ul>
        )}
        <dl className="op-tiles">
          {(Object.keys(u.counts) as (keyof typeof u.counts)[]).map((key) => (
            <div key={key}>
              <dt>{u.counts[key]}</dt>
              <dd>{summary.counts[key]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel" aria-labelledby="account-history">
        <h2 id="account-history">{u.history}</h2>
        {summary.history.length === 0 ? (
          <p className="muted">{u.noHistory}</p>
        ) : (
          <ul className="plain-list">
            {summary.history.map((h, i) => (
              <li key={`${h.createdAt.toISOString()}-${i}`}>
                {day(h.createdAt, lang)} · {o.journal.actions[h.action]}
                {h.reason === null ? null : ` · ${h.reason}`}
              </li>
            ))}
          </ul>
        )}
      </section>
      <form action={suspended ? restoreUser : suspendUser} className="panel" aria-labelledby="account-suspension">
        <h2 id="account-suspension">{suspended ? u.restore : u.suspend}</h2>
        {suspended ? <blockquote>{summary.suspensionReason}</blockquote> : <p className="muted measure">{u.suspendHint}</p>}
        <LangField lang={lang} />
        <input type="hidden" name="userId" value={summary.id} />
        <ReasonField id="suspension-reason" o={o} />
        <button type="submit" className={suspended ? "btn" : "btn btn-primary"}>
          {suspended ? u.restore : u.suspend}
        </button>
      </form>
      <form method="post" action={`/${lang}/app/operateur/utilisateurs/${summary.id}/export`} className="panel" aria-labelledby="account-export">
        <h2 id="account-export">{u.exportTitle}</h2>
        <p className="muted measure">{u.exportHint}</p>
        <ReasonField id="export-reason" o={o} />
        <button type="submit" className="btn">
          {u.exportButton}
        </button>
        <p className="field-hint">{u.noImpersonation}</p>
      </form>
    </>
  );
}
