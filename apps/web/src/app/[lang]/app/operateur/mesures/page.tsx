import { notFound } from "next/navigation";
import { operatorStats } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { operatorPage } from "@/lib/operator";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

const dollars = (cents: number, lang: string): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents / 100);

/** Visibility measurements: spend read from the ledger and the queue depth. Display only. */
export default async function MeasurementsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const t = m.operator.measurements;
  const seen = await operatorStats(context.db, context.operator).measurements(new Date());
  const tiles = [
    [t.today, dollars(seen.spentTodayCents, lang)],
    [t.month, dollars(seen.spentMonthCents, lang)],
    [t.lastDay, dollars(seen.spentLastDayCents, lang)],
    [t.last30, dollars(seen.spentLast30DaysCents, lang)],
    [t.queued, String(seen.queued)],
    [t.running, String(seen.running)],
    [t.failed, String(seen.failedLastDay)],
  ] as const;

  return (
    <>
      <header className="app-head">
        <h1>{t.title}</h1>
        <p className="muted measure">{t.lead}</p>
      </header>
      <dl className="op-tiles">
        {tiles.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
