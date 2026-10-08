import Link from "next/link";
import { notFound } from "next/navigation";
import { contractView, invoices, payments, type ContractDetail } from "@proofseen/db";
import { InvoiceList } from "@/components/market/InvoiceList";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { StatusTag } from "@/components/market/StatusTag";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import { date, day, money } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { cancelContract, completeContract, saveCostCenter, signContract } from "../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string }>;
}

const Hidden = ({ name, value }: { readonly name: string; readonly value: string }) => <input type="hidden" name={name} value={value} />;

function Signatures({ lang, c, contract }: { readonly lang: Lang; readonly c: DealsDictionary["contracts"]; readonly contract: ContractDetail }) {
  const line = (who: string, at: Date | null) => (
    <li>
      <strong>{who}</strong> · <span className="muted">{at === null ? c.notSigned : `${c.signedOn} ${day(at, lang)}`}</span>
    </li>
  );
  const mine = contract.side === "freelance" ? contract.signedByFreelanceAt : contract.signedByCompanyAt;
  // Signing commits the company: its owners and administrators only (the database says the same).
  const canSign = contract.status === "pending_signatures" && mine === null && (contract.side === "freelance" || contract.role === "owner" || contract.role === "admin");
  return (
    <section className="panel" aria-labelledby="signatures-title">
      <h2 id="signatures-title">{c.signatures}</h2>
      <ul className="plain-list">
        {line(contract.seller.legalName, contract.signedByFreelanceAt)}
        {line(contract.buyer.legalName, contract.signedByCompanyAt)}
      </ul>
      {contract.status === "pending_signatures" ? (
        <div className="empty-actions">
          {canSign ? (
            <form action={signContract}>
              <Hidden name="lang" value={lang} />
              <Hidden name="contractId" value={contract.id} />
              <button type="submit" className="btn btn-primary" aria-describedby="sign-hint">
                {c.sign}
              </button>
            </form>
          ) : null}
          <form action={cancelContract}>
            <Hidden name="lang" value={lang} />
            <Hidden name="contractId" value={contract.id} />
            <button type="submit" className="btn btn-quiet" aria-describedby="cancel-hint">
              {c.cancel}
            </button>
          </form>
        </div>
      ) : null}
      {contract.status === "pending_signatures" ? (
        <p className="muted small">
          {canSign ? <span id="sign-hint">{c.signHint} </span> : null}
          <span id="cancel-hint">{c.cancelHint}</span>
        </p>
      ) : null}
    </section>
  );
}

/** One contract, for its two parties only: anyone else gets 404. */
export default async function ContractPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const c = dict.deals.contracts;
  const contract = await contractView(market.db).find(market.actor, id);
  if (contract === null) notFound();
  const [payment, allInvoices] = await Promise.all([payments(market.db).find(market.actor, id), invoices(market.db).listMine(market.actor)]);
  const mineInvoices = allInvoices.filter((invoice) => invoice.contractId === id);
  const { erreur } = await searchParams;
  const errors: Readonly<Record<string, string>> = { ...c.errors, trop: c.errors.tooMany };
  const error = erreur === undefined ? null : (errors[erreur] ?? c.errors.notAllowed);
  const admin = contract.role === "owner" || contract.role === "admin";
  const held = payment?.status === "held";

  return (
    <>
      <p>
        <Link href={`/${lang}/app/contrats`}>← {c.back}</Link>
      </p>
      <header className="app-head">
        <h1>{contract.counterpart}</h1>
        <p className="thread-meta">
          <StatusTag status={contract.status} label={c.status[contract.status]} />
          <span className="muted small">
            {money(contract.totalCents, contract.currency, lang)} {c.exclVat} · {dict.deals.quotes.line(money(contract.dailyRateCents, contract.currency, lang), contract.days, money(contract.totalCents, contract.currency, lang))}
          </span>
        </p>
      </header>

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <dl className="meta-strip">
        <div>
          <dt>{c.seller}</dt>
          <dd>
            {contract.seller.legalName}
            {contract.seller.siret === null ? null : <span className="muted small"> · {contract.seller.siret}</span>}
          </dd>
        </div>
        <div>
          <dt>{c.buyer}</dt>
          <dd>
            {contract.buyer.legalName}
            {contract.buyer.siret === null ? null : <span className="muted small"> · {contract.buyer.siret}</span>}
          </dd>
        </div>
        <div>
          <dt>{c.period}</dt>
          <dd>
            {c.from} {date(contract.startsOn.toISOString(), lang)}
            {contract.endsOn === null ? null : ` ${c.to} ${date(contract.endsOn.toISOString(), lang)}`}
          </dd>
        </div>
      </dl>
      {contract.conversationId === null ? null : (
        <p>
          <Link href={`/${lang}/app/messages/${contract.conversationId}`}>{c.conversation}</Link>
        </p>
      )}
      {contract.side === "freelance" && contract.repeatClient ? <p className="muted small">{c.repeat}</p> : null}

      <Signatures lang={lang} c={c} contract={contract} />

      {contract.status === "active" || contract.status === "completed" ? (
        <section className="panel" aria-labelledby="payment-title">
          <h2 id="payment-title">{c.payment}</h2>
          <p>{c.paymentStatus[payment?.status ?? "none"]}</p>
          {payment?.commissionCents === null || payment === null ? null : <p className="muted small">{c.commission(money(payment.commissionCents, payment.currency, lang))}</p>}
          {payment === null && contract.side === "company" ? <p className="muted small">{c.payClosed}</p> : null}
          {contract.status === "active" && admin ? (
            <>
              <p className="muted small">
                {c.approvals(contract.approvals.count, contract.approvals.required)}
                {contract.approvals.mine && contract.approvals.count < contract.approvals.required ? ` · ${c.approvedByYou}` : null}
              </p>
              {contract.approvals.mine ? null : (
                <form action={completeContract}>
                  <Hidden name="lang" value={lang} />
                  <Hidden name="contractId" value={contract.id} />
                  <button type="submit" className="btn btn-primary" disabled={!held} aria-describedby="complete-hint">
                    {c.complete}
                  </button>
                  <p id="complete-hint" className="muted small">
                    {held ? c.completeHint : c.errors.not_paid}
                  </p>
                </form>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {admin && contract.status !== "cancelled" ? (
        <form action={saveCostCenter} className="panel-grid">
          <Hidden name="lang" value={lang} />
          <Hidden name="contractId" value={contract.id} />
          <div className="field">
            <label htmlFor="costCenter">{c.costCenter}</label>
            <input id="costCenter" name="costCenter" type="text" maxLength={60} defaultValue={contract.costCenter ?? ""} />
          </div>
          <div className="filters-actions">
            <button type="submit" className="btn">
              {dict.billing.save}
            </button>
          </div>
        </form>
      ) : null}

      {mineInvoices.length === 0 ? null : <InvoiceList lang={lang} d={dict.deals.invoices} invoices={mineInvoices} headingLevel={2} />}
    </>
  );
}
