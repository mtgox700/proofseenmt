import { notFound } from "next/navigation";
import { invoices } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { InvoiceList } from "@/components/market/InvoiceList";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { pageMarket } from "@/lib/market";
import "@/styles/app-affaire.css";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/** Every invoice the person may see: a company its mission invoices, a freelancer theirs and Proofseen's commission. */
export default async function InvoicesPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const d = dict.deals.invoices;
  const list = await invoices(market.db).listMine(market.actor);
  return (
    <>
      <header className="app-head">
        <h1>{d.title}</h1>
        <p className="muted measure">{d.lead}</p>
      </header>
      {list.length === 0 ? (
        <EmptyState title={d.empty} headingLevel={2}>
          {null}
        </EmptyState>
      ) : (
        <InvoiceList lang={lang} d={d} invoices={list} headingLevel={2} />
      )}
    </>
  );
}
