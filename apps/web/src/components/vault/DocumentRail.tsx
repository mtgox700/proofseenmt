import Link from "next/link";
import type { DocumentDetail, VersionSummary } from "@proofseen/db";
import type { ModelClause } from "@proofseen/documents";
import type { Lang } from "@/i18n/types";
import { vaultText } from "@/lib/vault/dictionary";
import { kilobytes } from "@/lib/vault/versions";
import { DownloadLink } from "./DownloadLink";
import { VaultStamp } from "./VaultStamp";
import { VersionStrata } from "./VersionStrata";

/*
 * The rail of a document (storyboard L1.6, §4 E4): its poinçon at 96 px (64 px on a phone, where it sits beside its
 * sixteen characters), the download of the PDF and what it is, its versions with the one being read marked, the link
 * to what changed since the previous one, and the table of contents. Links and <details> only: nothing needs a script.
 */

export interface DocumentRailProps {
  readonly lang: Lang;
  readonly document: DocumentDetail;
  readonly version: VersionSummary;
  /** The clauses of the text shown, for the table of contents; empty when the preview is unavailable. */
  readonly clauses: readonly ModelClause[];
  readonly article: (number: string, heading: string) => string;
}

export function DocumentRail({ lang, document, version, clauses, article }: DocumentRailProps) {
  const t = vaultText(lang);
  const d = t.document;
  const total = document.versionCount;
  const readHref = (n: number) => `/${lang}/app/documents/${document.id}?version=${n}`;
  const strata = <VersionStrata lang={lang} documentId={document.id} type={document.type} versions={document.versions} latest={document.latest?.number ?? version.number} current={version.number} readHref={readHref} shown={5} />;
  const toc = (id: string) => (
    <nav aria-label={d.toc} id={id}>
      <ol>
        {clauses.map((clause) => (
          <li key={clause.id}>
            <a href={`#clause-${clause.id}`}>{article(String(clause.number), clause.heading)}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
  return (
    <aside className="vault-rail" aria-label={d.railLabel}>
      <div className="vault-rail-stamp">
        <VaultStamp lang={lang} contentDigest={version.contentDigest} size={96} subject={t.card.subject(document.type, version.number)} />
      </div>
      <DownloadLink documentId={document.id} type={document.type} number={version.number} label={d.download} className="btn btn-primary" />
      <p className="vault-meta">{d.file(version.number, t.card.kilobytes(kilobytes(version.size)))}</p>
      {total < 2 ? null : (
        <>
          {/* L1-159 M9: on a phone the versions fold (closed); from 64 rem they are a list in the rail. One of the two is
              shown by CSS, the other is display: none and so out of the accessibility tree. */}
          <details className="vault-phone-block">
            <summary>{d.versionsCount(total)}</summary>
            {strata}
          </details>
          <section className="vault-desk-block" aria-labelledby="rail-versions">
            <h2 id="rail-versions" className="vault-strata-title">
              {d.versionsCount(total)}
            </h2>
            {strata}
          </section>
        </>
      )}
      {version.number > 1 ? (
        <Link className="vault-link" href={`/${lang}/app/documents/${document.id}/comparer?de=${version.number - 1}&a=${version.number}`}>
          {t.card.changesSince(version.number - 1)}
        </Link>
      ) : null}
      {clauses.length === 0 ? null : (
        <>
          <details className="vault-toc vault-phone-block">
            <summary>{d.tocCount(clauses.length)}</summary>
            {toc("toc-phone")}
          </details>
          <section className="vault-toc vault-desk-block" aria-labelledby="rail-toc">
            <h2 id="rail-toc" className="vault-strata-title">
              {d.toc}
            </h2>
            {toc("toc-desk")}
          </section>
        </>
      )}
    </aside>
  );
}
