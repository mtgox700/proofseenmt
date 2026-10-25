import Link from "next/link";
import type { VersionSummary } from "@proofseen/db";
import type { Lang } from "@/i18n/types";
import { writtenDate } from "@/components/ui/when";
import { vaultText } from "@/lib/vault/dictionary";
import { authorLabel } from "@/lib/vault/versions";
import { DownloadLink } from "./DownloadLink";
import { VaultStamp } from "./VaultStamp";

/*
 * The versions of a document as strata (storyboard L1.6, §4 E1): an ordered list, the newest first, a rule down the
 * left like a cut through rock. Each version keeps its 16 px poinçon (frame and state only, L1-090) and its sixteen
 * characters, which carry its identity; a replaced version says so in words beside it, never as a fourth state.
 * Beyond three, the older ones fold into a <details> that opens without a script.
 */

export interface VersionStrataProps {
  readonly lang: Lang;
  readonly documentId: string;
  readonly type: string;
  /** The versions to list, newest first. */
  readonly versions: readonly VersionSummary[];
  /** The number of the newest version of the document, to say « Remplacée par la version n ». */
  readonly latest: number;
  /** The version open on the page (E4), marked aria-current. */
  readonly current?: number;
  readonly readHref: (number: number) => string;
  /** How many strata show before the rest folds. */
  readonly shown?: number;
}

export function VersionStrata({ lang, documentId, type, versions, latest, current, readHref, shown = 3 }: VersionStrataProps) {
  const t = vaultText(lang);
  const card = t.card;
  const typeName = card.types[type as keyof typeof card.types] ?? type;
  const item = (version: VersionSummary) => (
    <li key={version.number} className="vault-stratum" aria-current={current === version.number ? "true" : undefined}>
      <span className="vault-stratum-line">
        <span>{card.stratum(version.number, writtenDate(version.createdAt, lang, "day"), authorLabel(version, t.who))}</span>
        <VaultStamp lang={lang} contentDigest={version.contentDigest} size={16} subject={card.subject(type, version.number)} />
        {version.number < latest ? <span className="vault-meta">{card.replacedBy(version.number + 1)}</span> : null}
        {current === version.number ? <span className="vault-meta">{`(${t.document.reading})`}</span> : null}
      </span>
      <span className="vault-stratum-links">
        {current === version.number ? null : (
          <Link href={readHref(version.number)} aria-label={`${card.read}, ${typeName.toLowerCase()}, version ${version.number}`}>
            {card.read}
          </Link>
        )}
        <DownloadLink documentId={documentId} type={type} number={version.number} label={card.downloadShort} className="" />
      </span>
    </li>
  );
  const head = versions.slice(0, shown);
  const rest = versions.slice(shown);
  return (
    <>
      <ol className="vault-strata">{head.map(item)}</ol>
      {rest.length === 0 ? null : (
        <details className="vault-older">
          <summary>{card.older(rest.length)}</summary>
          <ol className="vault-strata">{rest.map(item)}</ol>
        </details>
      )}
    </>
  );
}
