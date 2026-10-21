import Link from "next/link";
import { notFound } from "next/navigation";
import { OperatorActionKind, OperatorTargetType, operatorLog, type OperatorLogFilter } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { operatorPage } from "@/lib/operator";
import { periodOf } from "@/lib/operator-period";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ action?: string; cible?: string; id?: string; du?: string; au?: string; page?: string }>;
}

const ACTIONS = Object.values(OperatorActionKind);
const TARGETS = Object.values(OperatorTargetType);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The append-only operator log, newest first, with filters. */
export default async function JournalPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const j = m.operator.journal;
  const q = await searchParams;
  const action = ACTIONS.find((a) => a === q.action);
  const targetType = TARGETS.find((t) => t === q.cible);
  const targetId = q.id !== undefined && UUID.test(q.id) ? q.id : undefined;
  const dated = (q.du ?? "") !== "" || (q.au ?? "") !== "";
  const period = periodOf(q.du, q.au, new Date(), 3 * 366);
  const page = Math.min(Math.max(Number.parseInt(q.page ?? "1", 10) || 1, 1), 200);
  const filter: OperatorLogFilter = {
    ...(action === undefined ? {} : { action }),
    ...(targetType === undefined ? {} : { targetType }),
    ...(targetId === undefined ? {} : { targetId }),
    ...(dated ? { from: period.cohort.from, to: period.cohort.to } : {}),
    page,
  };
  const { items, hasMore } = await operatorLog(context.db, context.operator).list(filter);
  const keep = { ...(action === undefined ? {} : { action }), ...(targetType === undefined ? {} : { cible: targetType }), ...(targetId === undefined ? {} : { id: targetId }), ...(dated ? { du: period.from, au: period.to } : {}) };
  const link = (p: number): string => `?${new URLSearchParams({ ...keep, page: String(p) }).toString()}`;
  const when = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

  return (
    <>
      <header className="app-head">
        <h1>{j.title}</h1>
        <p className="muted measure">{j.lead}</p>
      </header>
      <form method="get" className="op-forms">
        <div className="field">
          <label htmlFor="log-action">{j.action}</label>
          <select id="log-action" name="action" defaultValue={action ?? ""}>
            <option value="">{m.operator.common.all}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {j.actions[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="log-target">{j.target}</label>
          <select id="log-target" name="cible" defaultValue={targetType ?? ""}>
            <option value="">{m.operator.common.all}</option>
            {TARGETS.map((t) => (
              <option key={t} value={t}>
                {j.targets[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="log-from">{j.from}</label>
          <input id="log-from" name="du" type="date" defaultValue={dated ? period.from : ""} />
        </div>
        <div className="field">
          <label htmlFor="log-to">{j.to}</label>
          <input id="log-to" name="au" type="date" defaultValue={dated ? period.to : ""} />
        </div>
        {targetId === undefined ? null : <input type="hidden" name="id" value={targetId} />}
        <button type="submit" className="btn">
          {m.operator.common.filter}
        </button>
      </form>
      {items.length === 0 ? (
        <p className="muted">{m.operator.common.empty}</p>
      ) : (
        <div className="op-table-wrap">
          <table className="op-table">
            <thead>
              <tr>
                <th scope="col">{j.when}</th>
                <th scope="col">{j.action}</th>
                <th scope="col">{j.target}</th>
                <th scope="col">{m.operator.common.reason}</th>
                <th scope="col">{j.operatorCol}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td className="op-num">{when.format(entry.createdAt)}</td>
                  <td>{j.actions[entry.action]}</td>
                  <td>
                    <Link href={`?${new URLSearchParams({ cible: entry.targetType, id: entry.targetId }).toString()}`}>{j.targets[entry.targetType]}</Link>
                    {typeof entry.metadata.label === "string" ? <span className="muted small"> · {entry.metadata.label}</span> : null}
                    {typeof entry.metadata.reference === "string" ? <span className="muted small"> · {entry.metadata.reference}</span> : null}
                  </td>
                  <td>{entry.reason ?? j.noReason}</td>
                  <td>{entry.operatorEmail ?? j.deletedAccount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="row-actions">
        {page > 1 ? <Link href={link(page - 1)}>{m.operator.common.previous}</Link> : null}
        {hasMore ? <Link href={link(page + 1)}>{m.operator.common.next}</Link> : null}
      </p>
    </>
  );
}
