import { notFound } from "next/navigation";
import { contractView } from "@proofseen/db";
import { vaultOpen } from "@/app/api/documents/vault";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { AffairHead } from "@/components/vault/AffairHead";
import { AffairTabs } from "@/components/vault/AffairTabs";
import { DocumentCard } from "@/components/vault/DocumentCard";
import { VaultState } from "@/components/vault/VaultState";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { pageMarket } from "@/lib/market";
import { acceptanceLine, waitingLine } from "@/lib/vault/acceptance";
import { affairState, type AffairContract, type AffairState } from "@/lib/vault/affair-state";
import { vaultText } from "@/lib/vault/dictionary";
import { affairDocuments } from "@/lib/vault/load";
import { inkingVersion } from "@/lib/vault/versions";
import { fingerprintPrefix } from "@proofseen/brand/fingerprint-mark";
import { vaultErrorText } from "@/lib/vault/errors";
import "@/styles/app-affaire.css";

/** E1, the tab « Documents » of an affair (storyboard L1.6, §4 E1): for the two parties of the contract, 404 for anyone else. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ depose?: string; erreur?: string; derniere?: string }>;
}

/** Why no new version: cancelled, or who accepted and when, and who has not yet (L1-159 M5). */
function closedLine(state: Extract<AffairState, { kind: "list" }>, contract: AffairContract, lang: "fr" | "en", latest: number): string | null {
  if (state.cancelled) return vaultText(lang).card.closedCancelled;
  return acceptanceLine(contract, lang, latest);
}

export default async function AffairDocumentsPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const contract = await contractView(market.db).find(market.actor, id);
  if (contract === null) notFound();
  const t = vaultText(lang);
  const open = vaultOpen(process.env);
  const read = open ? await affairDocuments(market.db, market.actor, id) : [];
  if (read === null) notFound();
  const state = affairState({ vaultOpen: open, contract, documents: read });
  const { depose, erreur, derniere } = await searchParams;
  const base = `/${lang}/app/contrats/${id}`;
  const list = read === "error" ? [] : read;
  const service = list.find((entry) => entry.detail.type === "service_agreement");
  const inking = inkingVersion(depose ?? null, service?.detail.latest ?? null, new Date());
  const error = vaultErrorText(lang, erreur, derniere, service === undefined ? null : { documentId: service.detail.id, latest: service.detail.latest });

  return (
    <div className="vault-page">
      <AffairHead lang={lang} deals={dict.deals} contract={contract} />
      <AffairTabs lang={lang} contractId={id} current="documents" count={read === "error" ? null : list.length} open={open} />
      <section className="vault-section" aria-labelledby="vault-title">
        <h2 id="vault-title">{t.affair.title}</h2>
        {state.kind === "closed" ? null : <p className="vault-lead">{t.affair.lead}</p>}
        {error === null ? null : (
          <div className="vault-alert" role="alert">
            <p>{error.text}</p>
            {error.link === null ? null : (
              <p>
                <a className="vault-link" href={error.link.href}>
                  {error.link.label}
                </a>
              </p>
            )}
          </div>
        )}
        {inking !== null && service?.detail.latest ? (
          <p className="vault-status" role="status">
            {t.card.deposited(inking, fingerprintPrefix(service.detail.latest.contentDigest))}
          </p>
        ) : null}
        {state.kind === "list" ? (
          <div className="vault-cards">
            {list.map(({ detail, underReview }) => (
              <DocumentCard
                key={detail.id}
                lang={lang}
                document={detail}
                inking={detail.type === "service_agreement" ? inking : null}
                underReview={underReview}
                prepareHref={state.canPrepare && detail.type === "service_agreement" ? `${base}/documents/preparer` : null}
                closedLine={state.canPrepare ? null : closedLine(state, contract, lang, detail.latest?.number ?? 0)}
              />
            ))}
          </div>
        ) : (
          <VaultState lang={lang} state={state} side={contract.side} affairHref={base} prepareHref={`${base}/documents/preparer`} retryHref={`${base}/documents`} waiting={waitingLine(contract, lang)} />
        )}
      </section>
    </div>
  );
}
