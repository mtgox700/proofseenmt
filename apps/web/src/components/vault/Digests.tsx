import type { Lang } from "@/i18n/types";
import { vaultText } from "@/lib/vault/dictionary";

/*
 * « Vérifier ce document » (storyboard L1.6, §4 E4): two fingerprints, two uses, and how to check the second at home.
 * The content fingerprint is the one printed at the foot of every page of the PDF and drawn by the poinçon; the file
 * fingerprint identifies the exact PDF, and anyone recomputes it with the command of their system, on the very name the
 * download gives the file. Both in full, 64 characters in four lines of sixteen, in the trace face. A <details>: it
 * opens without a script.
 */

/**
 * Sixty-four characters as four lines of sixteen, in the case decided in L1-147 (Chancelier): the CONTENT fingerprint
 * in capitals grouped by four, as the poinçon writes it and as the PDF footer prints it; the FILE fingerprint in lower
 * case, unbroken inside each line, as `certutil`, `shasum` and `sha256sum` print it.
 */
const NEWLINE = String.fromCharCode(10);
export const digestLines =(hex: string, grouped: boolean): string =>
  ((grouped ? hex.toUpperCase() : hex.toLowerCase()).match(/.{1,16}/g) ?? []).map((line) => (grouped ? line.replace(/(.{4})(?=.)/g, "$1 ") : line)).join(NEWLINE);

export interface DigestsProps {
  readonly lang: Lang;
  readonly contentDigest: string;
  readonly sha256: string;
  readonly fileName: string;
}

export function Digests({ lang, contentDigest, sha256, fileName }: DigestsProps) {
  const v = vaultText(lang).document.verify;
  const commands = [
    { os: v.windows, line: `certutil -hashfile ${fileName} SHA256` },
    { os: v.mac, line: `shasum -a 256 ${fileName}` },
    { os: v.linux, line: `sha256sum ${fileName}` },
  ];
  return (
    <details className="vault-digests" id="verifier">
      <summary>{v.summary}</summary>
      <p>{v.intro}</p>
      <dl>
        <dt>{v.content}</dt>
        <dd>
          <code>{digestLines(contentDigest, true)}</code>
        </dd>
        <dt>{v.file}</dt>
        <dd>
          <code>{digestLines(sha256, false)}</code>
        </dd>
      </dl>
      <p>{v.how}</p>
      <dl>
        {commands.map((command) => (
          <div key={command.os}>
            <dt>{command.os}</dt>
            <dd>
              <code>{command.line}</code>
            </dd>
          </div>
        ))}
      </dl>
      <p>{v.same}</p>
    </details>
  );
}
