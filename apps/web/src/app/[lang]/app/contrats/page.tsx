import Link from "next/link";
import { notFound } from "next/navigation";
import { contractView } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { date, money } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { vaultOpen } from "@/app/api/documents/vault";
import { SectionTabs } from "@/components/vault/AffairTabs";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/** The person's contracts, as freelancer or as company member, most recent first. */
export default async function ContractsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const c = dict.deals.contracts;
  const list = await contractView(market.db).list(market.actor);
  return (
    <>
      {/* L1.6: « Contrats » and « Documents », the section's two tabs; drawn only while the vault is open (L1-148). */}
      <SectionTabs lang={lang} current="contracts" open={vaultOpen(process.env)} />
      <header className="app-head">
        <h1>{c.title}</h1>
        <p className="muted measure">{c.lead}</p>
      </header>
      {list.length === 0 ? (
        <EmptyState title={c.empty} headingLevel={2}>
          <p>{c.emptyText}</p>
        </EmptyState>
      ) : (
        <ul className="threads">
          {list.map((contract) => (
            <li key={contract.id}>
              <Link href={`/${lang}/app/contrats/${contract.id}`} className="thread-row">
                <span className="thread-who">
                  <strong>{contract.counterpart ?? c.sellerUnknown}</strong>
                </span>
                <StatusTag status={contract.status} label={c.status[contract.status]} />
                <span className="thread-last muted">{money(contract.totalCents, contract.currency, lang)} {c.exclVat}</span>
                <span className="thread-date muted small">
                  {c.from} {date(contract.startsOn.toISOString(), lang)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
