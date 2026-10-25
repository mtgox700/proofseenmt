import "@/styles/vault.css";
import type { VersionSummary } from "@proofseen/db";
import type { Lang } from "@/i18n/types";
import { writtenDate } from "@/components/ui/when";
import { vaultText } from "@/lib/vault/dictionary";
import { authorLabel } from "@/lib/vault/versions";
import { VaultStamp } from "./VaultStamp";

/*
 * The head of a comparison (storyboard L1.6, §4 E5, M2): the title, then the two poinçons at 96 px side by side, the
 * newer one first drawn exactly on the older one and sliding to its place in 320 ms (CSS, transform only, and only
 * without reduced motion): one thought one held one document, there are two. The sentence that says so is there from
 * 0 ms. Played on every opening of a comparison, a request of the person; never on an anchor inside the page.
 */

export interface CompareHeadProps {
  readonly lang: Lang;
  readonly type: string;
  readonly older: VersionSummary;
  readonly newer: VersionSummary;
}

export function CompareHead({ lang, type, older, newer }: CompareHeadProps) {
  const t = vaultText(lang);
  const c = t.compare;
  const stamp = (version: VersionSummary) => (
    <li>
      <VaultStamp lang={lang} contentDigest={version.contentDigest} size={96} subject={t.card.subject(type, version.number)} />
      {/* Two clean lines under the poinçon, never a separator at the head of one: the version and its day, then who. */}
      <p className="vault-pair-line">
        <span className="vault-line">{c.stampVersion(version.number, writtenDate(version.createdAt, lang, "day"))}</span>
        <span className="vault-line">{c.stampBy(authorLabel(version, t.who))}</span>
      </p>
    </li>
  );
  return (
    <header className="vault-doc-head">
      <h1>{c.title(older.number, newer.number)}</h1>
      <ul className="vault-pair" aria-label={c.stampsLabel}>
        {stamp(older)}
        {stamp(newer)}
      </ul>
      <p>{c.distinct}</p>
      <p className="vault-meta">{c.always(older.number, newer.number, writtenDate(older.createdAt, lang, "day"), writtenDate(newer.createdAt, lang, "day"))}</p>
    </header>
  );
}
