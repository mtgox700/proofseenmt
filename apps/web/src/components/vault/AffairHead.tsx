import Link from "next/link";
import type { ContractDetail } from "@proofseen/db";
import { StatusTag } from "@/components/market/StatusTag";
import type { Lang } from "@/i18n/types";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import { money } from "@/lib/format";

/*
 * The head an affair's tabs share with « L'affaire » (contrats/[id]/page.tsx): the way back, the counterpart as the
 * page's h1, the state as a tag, the amount. The same markup, so moving from one tab to the other moves nothing.
 */

export interface AffairHeadProps {
  readonly lang: Lang;
  readonly deals: DealsDictionary;
  readonly contract: ContractDetail;
}

export function AffairHead({ lang, deals, contract }: AffairHeadProps) {
  const c = deals.contracts;
  const total = money(contract.totalCents, contract.currency, lang);
  return (
    <>
      <p>
        <Link className="back-link" href={`/${lang}/app/contrats`}>
          <span aria-hidden="true">←&nbsp;</span>
          {c.back}
        </Link>
      </p>
      <header className="app-head">
        <h1>{contract.counterpart ?? c.sellerUnknown}</h1>
        <p className="thread-meta">
          <StatusTag status={contract.status} label={c.status[contract.status]} />
          <span className="muted small">
            {/* The amount once (L1-159): the line of the quote already ends with it. */}
            {deals.quotes.line(money(contract.dailyRateCents, contract.currency, lang), contract.days, total)}
          </span>
        </p>
      </header>
    </>
  );
}
