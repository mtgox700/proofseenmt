import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { contractView, documents, type ContractDetail } from "@proofseen/db";
import { defaultRegistry } from "@proofseen/documents";
import { vaultOpen } from "@/app/api/documents/vault";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { PrepareForm, type Fact } from "@/components/vault/PrepareForm";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { DealsDictionary } from "@/i18n/market/deals-fr";
import { date, money } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { canPrepare } from "@/lib/vault/affair-state";
import { choiceGroups, initialDraft } from "@/lib/vault/choices";
import { vaultText } from "@/lib/vault/dictionary";
import { drafts } from "@/lib/vault/drafts";
import { prepareVersion } from "../actions";
import "@/styles/app-affaire.css";

/** E2, « Préparer le contrat de prestation » (storyboard L1.6, §4 E2): only while the affair allows a new version. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ brouillon?: string }>;
}

/** Intl writes U+00A0 before « % »; French typography wants the narrow one. Both by code point, never typed. */
const NBSP = new RegExp(String.fromCharCode(0xa0), "g");
const percentOf = (bp: number, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "percent", maximumFractionDigits: 2 }).format(bp / 10_000).replace(NBSP, String.fromCharCode(0x202f));

/** What comes from the contract, read only: parties, object, deliverables, price, dates, commission. */
function contractFacts(lang: Lang, deals: DealsDictionary, contract: ContractDetail, feePayer: string | null): readonly Fact[] {
  const t = vaultText(lang);
  const f = t.prepare.facts;
  const c = deals.contracts;
  const total = money(contract.totalCents, contract.currency, lang);
  const scope = contract.scope ?? "";
  const long = scope.split("\n").length > 6 || scope.length > 600;
  const payer = feePayer === "company" ? t.prepare.payers.company : feePayer === "freelance" ? t.prepare.payers.freelance : null;
  return [
    { label: f.provider, value: contract.seller.legalName ?? c.sellerUnknown },
    { label: f.client, value: contract.buyer.legalName },
    {
      label: f.scope,
      value: long ? (
        <details>
          <summary>{t.prepare.scopeMore}</summary>
          <p className="vault-pre">{scope}</p>
        </details>
      ) : (
        <p className="vault-pre">{scope}</p>
      ),
    },
    { label: f.deliverables, value: contract.deliverables.length === 0 ? null : <ul>{contract.deliverables.map((item, i) => <li key={i}>{item}</li>)}</ul> },
    { label: f.price, value: `${deals.quotes.line(money(contract.dailyRateCents, contract.currency, lang), contract.days, total)}` },
    { label: f.dates, value: `${c.from} ${date(contract.startsOn.toISOString(), lang)}${contract.endsOn === null ? "" : ` ${c.to} ${date(contract.endsOn.toISOString(), lang)}`}` },
    ...(contract.commissionBp === null ? [] : [{ label: f.commission, value: payer === null ? percentOf(contract.commissionBp, lang) : t.prepare.commission(percentOf(contract.commissionBp, lang), payer) }]),
  ];
}

export default async function PreparePage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const contract = await contractView(market.db).find(market.actor, id);
  if (contract === null) notFound();
  const tab = `/${lang}/app/contrats/${id}/documents`;
  if (!vaultOpen(process.env) || !canPrepare(contract)) redirect(tab);
  const repo = documents(market.db);
  const list = await repo.list(market.actor, { kind: "contract", id });
  if (list === null) notFound();
  const current = list.find((doc) => doc.type === "service_agreement") ?? null;
  const latest = current?.latest ?? null;
  const frozen = current !== null && latest !== null ? await repo.frozen(market.actor, current.id, latest.number) : null;
  const frozenValues = (frozen?.variables ?? {}) as { readonly values?: Readonly<Record<string, unknown>>; readonly optionalClauses?: Readonly<Record<string, string>> };
  const template = defaultRegistry().latest("service-agreement");
  if (template === undefined) redirect(`${tab}?erreur=moteur`);
  const t = vaultText(lang);
  const groups = choiceGroups(template.decl, lang, t.prepare);
  const { brouillon } = await searchParams;
  const kept = brouillon === undefined ? null : drafts().take(brouillon, market.actor.userId, id, new Date());
  const values = kept?.values ?? initialDraft(template.decl, groups, frozen === null ? null : { values: frozenValues.values ?? {}, optionalClauses: frozenValues.optionalClauses ?? {} });
  // Who pays the commission is frozen on the contract; the read view does not carry it, so it is read here, after the
  // repository has checked that the person is a party of this contract.
  const feePayer = (await market.db.contract.findUnique({ where: { id }, select: { feePayer: true } }))?.feePayer ?? null;
  const next = (latest?.number ?? 0) + 1;
  const message = kept?.message === "tooMany" ? t.errors.tooMany : brouillon !== undefined && kept === null ? t.prepare.draftLost : null;

  return (
    <div className="vault-page">
      <p>
        <Link className="back-link" href={tab}>
          <span aria-hidden="true">←&nbsp;</span>
          {t.document.back}
        </Link>
      </p>
      <section className="vault-section" aria-labelledby="prepare-title">
        <header className="app-head">
          <h1 id="prepare-title">{t.prepare.title(next)}</h1>
          <p className="muted small">{contract.counterpart ?? dict.deals.contracts.sellerUnknown}</p>
        </header>
        <p className="vault-lead">{t.prepare.lead}</p>
        <PrepareForm
          lang={lang}
          action={prepareVersion}
          contractId={id}
          documentId={current?.id ?? null}
          next={next}
          facts={contractFacts(lang, dict.deals, contract, feePayer)}
          groups={groups}
          values={values}
          problems={kept?.problems ?? []}
          missingFacts={kept?.facts ?? []}
          refusal={kept?.refusal ?? null}
          message={message}
          cancelHref={tab}
        />
      </section>
    </div>
  );
}
