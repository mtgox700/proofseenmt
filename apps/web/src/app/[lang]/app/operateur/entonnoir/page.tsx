import { notFound } from "next/navigation";
import { operatorStats } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { operatorPage } from "@/lib/operator";
import { periodOf } from "@/lib/operator-period";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ du?: string; au?: string }>;
}

/** The marketplace funnel on both sides, for a period of creation dates. Totals only, never a list of people. */
export default async function FunnelPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const f = m.operator.funnel;
  const { du, au } = await searchParams;
  const period = periodOf(du, au);
  const result = await operatorStats(context.db, context.operator).funnel(period.cohort);
  const s = f.steps;
  const freelance = [
    [s.profiles, result.freelance.profiles],
    [s.published, result.freelance.published],
    [s.provenUrl, result.freelance.provenUrl],
    [s.firstExchange, result.freelance.firstExchange],
    [s.contracted, result.freelance.contracted],
    [s.paid, result.freelance.paid],
  ] as const;
  const company = [
    [s.organisations, result.company.organisations],
    [s.missionPublished, result.company.missionPublished],
    [s.companyExchange, result.company.firstExchange],
    [s.companyContracted, result.company.contracted],
    [s.companyPaid, result.company.paid],
  ] as const;

  return (
    <>
      <header className="app-head">
        <h1>{f.title}</h1>
        <p className="muted measure">{f.lead}</p>
      </header>
      <form method="get" className="op-forms">
        <div className="field">
          <label htmlFor="funnel-from">{f.from}</label>
          <input id="funnel-from" name="du" type="date" defaultValue={period.from} />
        </div>
        <div className="field">
          <label htmlFor="funnel-to">{f.to}</label>
          <input id="funnel-to" name="au" type="date" defaultValue={period.to} />
        </div>
        <button type="submit" className="btn">
          {f.apply}
        </button>
      </form>
      {(
        [
          [f.freelance, freelance],
          [f.company, company],
        ] as const
      ).map(([title, rows]) => (
        <section key={title} className="panel" aria-label={title}>
          <h2>{title}</h2>
          <dl className="op-tiles">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <dl className="op-tiles">
        <div>
          <dt>{f.medianHours}</dt>
          <dd>{result.company.medianHoursToFirstExchange === null ? f.none : Math.round(result.company.medianHoursToFirstExchange)}</dd>
        </div>
        <div>
          <dt>{f.auditRequests}</dt>
          <dd>{result.auditRequests}</dd>
        </div>
      </dl>
    </>
  );
}
