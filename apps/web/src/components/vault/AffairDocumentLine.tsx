import Link from "next/link";
import { fingerprintPrefix } from "@proofseen/brand/fingerprint-mark";
import type { Lang } from "@/i18n/types";
import { vaultText } from "@/lib/vault/dictionary";
import type { LatestServiceVersion } from "@/lib/vault/load";

/*
 * The door from the panel « Signatures » of an affair to its contract text (storyboard L1.6, §1.3): « Contrat de
 * prestation : version 3, empreinte 7F3A 91C2 0B4E D2A8 », a link to the document. What the parties accept is that
 * version; nothing else changes on the tab « L'affaire » in L1. Absent when there is no text, or the vault is closed.
 */

export function AffairDocumentLine({ lang, latest }: { readonly lang: Lang; readonly latest: LatestServiceVersion | null }) {
  if (latest === null) return null;
  const t = vaultText(lang);
  return (
    <p className="muted small">
      <Link href={`/${lang}/app/documents/${latest.documentId}?version=${latest.number}`}>{t.affair.signatureLine(t.card.types.service_agreement, latest.number, fingerprintPrefix(latest.contentDigest))}</Link>
    </p>
  );
}
