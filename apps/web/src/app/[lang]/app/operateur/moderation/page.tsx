import { notFound } from "next/navigation";
import { moderation } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { LangField, Outcome, ReasonField } from "@/components/operator/OperatorParts";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { operatorPage } from "@/lib/operator";
import { hideContent, restoreContent } from "../moderation-actions";
import { EmptyNote } from "@/components/EmptyState";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ etat?: string }>;
}

/** Hide a public profile, mission, company page or whole company with a reason; see and restore what is hidden. */
export default async function ModerationPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const hidden = await moderation(context.db, context.operator).hidden();
  const { etat } = await searchParams;

  return (
    <>
      <header className="app-head">
        <h1>{o.moderation.title}</h1>
        <p className="muted measure">{o.moderation.lead}</p>
      </header>
      <Outcome flag={etat} o={o} />
      <form action={hideContent} className="panel" aria-labelledby="hide-title">
        <h2 id="hide-title">{o.moderation.hide}</h2>
        <LangField lang={lang} />
        <div className="field">
          <label htmlFor="hide-target">{o.moderation.target}</label>
          <select id="hide-target" name="target" defaultValue="profile">
            {(["profile", "mission", "company", "organisation"] as const).map((t) => (
              <option key={t} value={t}>
                {o.moderation.targets[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="hide-key">{o.moderation.key}</label>
          <input id="hide-key" name="key" type="text" required maxLength={80} autoComplete="off" />
          <p className="field-hint">{o.moderation.keyHint}</p>
        </div>
        <ReasonField id="hide-reason" o={o} />
        <button type="submit" className="btn btn-primary">
          {o.moderation.hide}
        </button>
      </form>
      <section className="panel" aria-labelledby="hidden-title">
        <h2 id="hidden-title">{o.moderation.hiddenTitle}</h2>
        {hidden.length === 0 ? (
          <EmptyNote>{o.common.empty}</EmptyNote>
        ) : (
          <ul className="op-list">
            {hidden.map((item) => (
              <li key={`${item.target}-${item.id}`} className="op-item">
                <p>
                  <strong>{o.moderation.targets[item.target]}</strong> · {item.label}{" "}
                  <span className="muted small">
                    {o.common.since} {day(item.moderatedAt, lang)}
                  </span>
                </p>
                <blockquote>{item.reason}</blockquote>
                <form action={restoreContent} className="op-forms">
                  <LangField lang={lang} />
                  <input type="hidden" name="target" value={item.target} />
                  <input type="hidden" name="key" value={item.key} />
                  <ReasonField id={`restore-${item.id}`} o={o} />
                  <button type="submit" className="btn">
                    {o.moderation.restore}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
