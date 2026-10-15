import Link from "next/link";
import { notFound } from "next/navigation";
import { feedbackTriage, type TriageFilter } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { LangField, Outcome } from "@/components/operator/OperatorParts";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { operatorPage } from "@/lib/operator";
import { triageFeedback } from "../feedback-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ statut?: string; contestations?: string; page?: string; etat?: string }>;
}

const STATUSES = ["new", "planned", "done", "wontfix"] as const;
type Status = (typeof STATUSES)[number];
const statusOf = (raw: string | undefined): Status | undefined => STATUSES.find((s) => s === raw);

/** Beta feedback, newest first, filtered by status; appeals against operator decisions come with their account. */
export default async function FeedbackPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const f = o.feedback;
  const query = await searchParams;
  const status = statusOf(query.statut);
  const page = Math.min(Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1), 100);
  const filter: TriageFilter = { ...(status === undefined ? {} : { status }), appealsOnly: query.contestations === "1", page };
  const { items, hasMore } = await feedbackTriage(context.db, context.operator).list(filter);
  const link = (p: number): string => `?${new URLSearchParams({ ...(status === undefined ? {} : { statut: status }), ...(filter.appealsOnly ? { contestations: "1" } : {}), page: String(p) }).toString()}`;

  return (
    <>
      <header className="app-head">
        <h1>{f.title}</h1>
        <p className="muted measure">{f.lead}</p>
      </header>
      <Outcome flag={query.etat} o={o} />
      <form method="get" className="op-forms">
        <div className="field">
          <label htmlFor="feedback-status">{o.common.filter}</label>
          <select id="feedback-status" name="statut" defaultValue={status ?? ""}>
            <option value="">{o.common.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {f.status[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-inline">
          <input id="feedback-appeals" name="contestations" type="checkbox" value="1" defaultChecked={filter.appealsOnly} />
          <label htmlFor="feedback-appeals">{f.appealsOnly}</label>
        </div>
        <button type="submit" className="btn">
          {o.common.filter}
        </button>
      </form>
      {items.length === 0 ? (
        <p className="muted">{o.common.empty}</p>
      ) : (
        <ul className="op-list">
          {items.map((item) => (
            <li key={item.id} className="op-item">
              <p>
                <strong>{item.appealUserId === null ? f.kinds[item.kind] : f.appeal}</strong> · {f.sides[item.side]} · {day(item.createdAt, lang)}
                {item.page === null ? null : <span className="muted small"> · {item.page}</span>} · <span className="tag">{f.status[item.status]}</span>
                {item.appealUserId === null ? null : (
                  <>
                    {" · "}
                    <Link href={`/${lang}/app/operateur/utilisateurs/${item.appealUserId}`}>{f.openAccount}</Link>
                  </>
                )}
              </p>
              <blockquote>{item.body}</blockquote>
              <form action={triageFeedback} className="op-forms">
                <LangField lang={lang} />
                <input type="hidden" name="id" value={item.id} />
                <div className="field">
                  <label htmlFor={`status-${item.id}`}>{f.statusLabel}</label>
                  <select id={`status-${item.id}`} name="status" defaultValue={item.status}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {f.status[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`note-${item.id}`}>{o.common.note}</label>
                  <input id={`note-${item.id}`} name="note" type="text" maxLength={2000} defaultValue={item.triageNote ?? ""} />
                </div>
                <button type="submit" className="btn">
                  {f.save}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="row-actions">
        {page > 1 ? <Link href={link(page - 1)}>{o.common.previous}</Link> : null}
        {hasMore ? <Link href={link(page + 1)}>{o.common.next}</Link> : null}
      </p>
    </>
  );
}
