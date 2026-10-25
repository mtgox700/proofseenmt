import "@/styles/vault.css";
import Link from "next/link";
import type { DocumentDetail } from "@proofseen/db";
import type { Lang } from "@/i18n/types";
import { writtenDate } from "@/components/ui/when";
import { vaultText } from "@/lib/vault/dictionary";
import { authorLabel, kilobytes } from "@/lib/vault/versions";
import { DownloadLink } from "./DownloadLink";
import { VaultStamp } from "./VaultStamp";
import { VersionPicker } from "./VersionPicker";
import { VersionStrata } from "./VersionStrata";

/*
 * One document of the affair (storyboard L1.6, §4 E1, S5): its current version with its 32 px poinçon and what it says
 * about itself (who filed it, when, why, that its template is still being reviewed), what one can do with it, and its
 * older versions in strata. « Préparer une nouvelle version » only while the affair allows it; otherwise the sentence
 * that says why not, never a button that would only fail.
 */

export interface DocumentCardProps {
  readonly lang: Lang;
  readonly document: DocumentDetail;
  /** The version whose fingerprint inks (M1), if it is this document's latest. */
  readonly inking: number | null;
  /** The rendered model carried the review notice (`reviewNotice`, frozen with the version). */
  readonly underReview: boolean;
  readonly prepareHref: string | null;
  /** Why no new version may be prepared, in words, when `prepareHref` is null. */
  readonly closedLine: string | null;
}

export function DocumentCard({ lang, document, inking, underReview, prepareHref, closedLine }: DocumentCardProps) {
  const t = vaultText(lang);
  const card = t.card;
  const latest = document.latest;
  const typeName = card.types[document.type] ?? document.type;
  const titleId = `doc-${document.id}`;
  const readHref = (n: number) => `/${lang}/app/documents/${document.id}?version=${n}`;
  if (latest === null) return null;
  const previous = document.versions.filter((version) => version.number !== latest.number);
  return (
    <article className="vault-card" aria-labelledby={titleId}>
      <h3 id={titleId}>{typeName}</h3>
      <p className="vault-meta">{card.version(latest.number, writtenDate(latest.createdAt, lang, "minute"), authorLabel(latest, t.who))}</p>
      <VaultStamp lang={lang} contentDigest={latest.contentDigest} size={32} subject={card.subject(document.type, latest.number)} inking={inking === latest.number} />
      {underReview ? <p className="vault-review">{card.review(latest.templateVersion)}</p> : null}
      <p className="vault-reason">{card.reason(latest.reason)}</p>
      <ul className="vault-actions">
        <li>
          <Link className="btn btn-primary" href={readHref(latest.number)}>
            {card.read}
          </Link>
        </li>
        <li>
          <DownloadLink documentId={document.id} type={document.type} number={latest.number} label={card.download(card.kilobytes(kilobytes(latest.size)))} />
        </li>
        {latest.number > 1 ? (
          <li>
            <Link className="btn" href={`/${lang}/app/documents/${document.id}/comparer?de=${latest.number - 1}&a=${latest.number}`}>
              {card.changesSince(latest.number - 1)}
            </Link>
          </li>
        ) : null}
        {prepareHref === null ? null : (
          <li>
            <Link className="btn" href={prepareHref}>
              {card.prepareNext}
            </Link>
          </li>
        )}
      </ul>
      {prepareHref === null && closedLine !== null ? <p className="vault-closed">{closedLine}</p> : null}
      {previous.length === 0 ? null : (
        <section aria-labelledby={`${titleId}-strata`}>
          <h4 id={`${titleId}-strata`} className="vault-strata-title">
            {card.previous}
          </h4>
          <VersionStrata lang={lang} documentId={document.id} type={document.type} versions={previous} latest={latest.number} readHref={readHref} />
          <VersionPicker lang={lang} id={`pick-${document.id}`} documentId={document.id} numbers={document.versions.map((v) => v.number)} from={latest.number - 1} to={latest.number} />
        </section>
      )}
    </article>
  );
}
