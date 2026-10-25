import Link from "next/link";
import { notFound } from "next/navigation";
import { documents, type DocumentDetail } from "@proofseen/db";
import { vaultOpen } from "@/app/api/documents/vault";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { EmptyState } from "@/components/EmptyState";
import { writtenDate } from "@/components/ui/when";
import { Digests } from "@/components/vault/Digests";
import { DocumentRail } from "@/components/vault/DocumentRail";
import { DocumentView } from "@/components/vault/DocumentView";
import { DownloadLink, fileName } from "@/components/vault/DownloadLink";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { logError } from "@/lib/log";
import { pageMarket } from "@/lib/market";
import { vaultText } from "@/lib/vault/dictionary";
import { previewVersion } from "@/lib/vault/replay";
import { authorLabel } from "@/lib/vault/versions";
import { fingerprintPrefix } from "@proofseen/brand/fingerprint-mark";
import "@/styles/app-affaire.css";

/**
 * E4, one document (storyboard L1.6, §4 E4): the text of a version in HTML, recomputed from its frozen values and shown
 * only if its content fingerprint is the PDF's; the PDF to download; the versions; how to check it. One address per
 * document, whatever its affair; anyone who is not a party gets the 404 of a document that does not exist.
 */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; documentId: string }>;
  readonly searchParams: Promise<{ version?: string; erreur?: string }>;
}

const VERSION = /^[1-9][0-9]{0,5}$/;

/** Where the document came from: its affair's tab when it is a contract's. */
const affairHref = (lang: string, document: DocumentDetail): string | null => (document.affair.kind === "contract" ? `/${lang}/app/contrats/${document.affair.id}/documents` : null);

export default async function DocumentPage({ params, searchParams }: PageProps) {
  const { lang, documentId } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const t = vaultText(lang);
  if (!vaultOpen(process.env)) return <EmptyState title={t.states.closed.title}>{<p>{t.states.closed.body}</p>}</EmptyState>;
  const repo = documents(market.db);
  const document = await repo.find(market.actor, documentId);
  if (document === null || document.latest === null) notFound();
  const { version: asked, erreur } = await searchParams;
  const number = asked === undefined ? document.latest.number : VERSION.test(asked) ? Number(asked) : 0;
  const version = document.versions.find((v) => v.number === number);
  if (version === undefined) notFound();
  const frozen = await repo.frozen(market.actor, document.id, version.number);
  const preview = frozen === null ? ({ kind: "unavailable", code: "frozen_missing" } as const) : previewVersion({ ...frozen, contentDigest: version.contentDigest });
  if (preview.kind === "unavailable") logError(`vault: preview unavailable (${preview.code})`);
  const d = t.document;
  const docText = vaultText(document.lang);
  const typeName = t.card.types[document.type];
  const back = affairHref(lang, document);
  const latest = document.latest;

  return (
    <div className="vault-page vault-doc">
      <a className="vault-skip" href="#texte">
        {d.skip}
      </a>
      {back === null ? null : (
        <p>
          <Link className="back-link" href={back}>
            <span aria-hidden="true">←&nbsp;</span>
            {d.back}
          </Link>
        </p>
      )}
      <header className="vault-doc-head">
        <h1>{typeName}</h1>
        <p className="vault-meta">{d.line(version.number, document.versionCount, writtenDate(version.createdAt, lang, "minute"), authorLabel(version, t.who))}</p>
      </header>
      {erreur === "telechargement" ? (
        <p className="vault-alert" role="alert">
          {d.downloadFailed}
        </p>
      ) : null}
      {version.number < latest.number ? (
        <div className="vault-status" role="note">
          <p>{d.older(version.number, latest.number, writtenDate(latest.createdAt, lang, "day"))}</p>
          <p className="vault-stratum-links">
            <Link href={`/${lang}/app/documents/${document.id}`}>{d.readLatest(latest.number)}</Link>
            <Link href={`/${lang}/app/documents/${document.id}/comparer?de=${version.number}&a=${latest.number}`}>{d.seeChanges}</Link>
          </p>
        </div>
      ) : null}
      <div className="vault-doc-body">
        <DocumentRail lang={lang} document={document} version={version} clauses={preview.kind === "ready" ? preview.model.clauses : []} article={docText.document.article} />
        <div className="vault-article-wrap">
          {preview.kind === "ready" ? (
            <DocumentView model={preview.model} article={docText.document.article} footer={d.footer(fingerprintPrefix(version.contentDigest))} label={d.textLabel} />
          ) : (
            <div id="texte" className="vault-status" tabIndex={-1}>
              <p>{d.unavailable}</p>
              <p>
                <DownloadLink documentId={document.id} type={document.type} number={version.number} label={d.download} className="btn btn-primary" />
              </p>
            </div>
          )}
        </div>
        <Digests lang={lang} contentDigest={version.contentDigest} sha256={version.sha256} fileName={fileName(document.type, version.number)} />
      </div>
    </div>
  );
}
