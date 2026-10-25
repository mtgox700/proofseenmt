import "@/styles/ui.css";
import "@/styles/vault.css";
import type { CSSProperties } from "react";
import { fingerprintPrefix } from "@proofseen/brand/fingerprint-mark";
import { FingerprintStamp } from "@/components/ui/fingerprint/FingerprintMark";
import type { Lang } from "@/i18n/types";
import { markBands } from "@/lib/vault/mark-rows";

/*
 * The poinçon of a version in the vault (storyboard L1.6, §3): always drawn from the CONTENT fingerprint, the one the
 * PDF prints in its footer (never the file's SHA-256), always « Déposé » in L1. At rest it is FingerprintStamp itself.
 * When a version has just been born (M1, §6) it is the same drawing with its ink laid band by band: the frame and the
 * cells in the line colour from 0 ms, then four bands of ink over them, from the top. Same classes, same text, same
 * accessible name: nothing but the ink moves, and only in CSS.
 */

export interface VaultStampProps {
  readonly lang: Lang;
  readonly contentDigest: string;
  readonly size: 16 | 32 | 64 | 96;
  /** After « Empreinte »: « du contrat de prestation, version 3 ». */
  readonly subject: string;
  readonly inking?: boolean;
}

const WORDS = { fr: { noun: "Empreinte", filed: "Déposé" }, en: { noun: "Fingerprint", filed: "Filed" } } as const;

export function VaultStamp({ lang, contentDigest, size, subject, inking = false }: VaultStampProps) {
  if (!inking || size !== 32) return <FingerprintStamp lang={lang} fingerprint={contentDigest} size={size} subject={subject} state={{ kind: "filed" }} />;
  const { geometry, bands } = markBands(contentDigest, size);
  const words = WORDS[lang];
  return (
    <span className="ui-fp" data-state="filed" data-inking="">
      <span className="ui-fp-mark">
        <svg className="ui-fpm" data-state="filed" data-level={geometry.size} viewBox={geometry.viewBox} width={size} height={size} focusable="false" aria-hidden="true">
          <path className="ui-fpm-frame" d={geometry.frame} strokeWidth={geometry.stroke} />
          <path className="vault-ink-base" d={geometry.cells} />
          {bands.map((band, index) => (band === "" ? null : <path key={index} className="ui-fpm-cells vault-ink-band" d={band} style={{ "--band": index } as CSSProperties} />))}
        </svg>
      </span>
      <span className="ui-fp-text">
        <span className="sr-only">{`${words.noun} ${subject}`}</span>
        <code className="ui-fp-code">{fingerprintPrefix(contentDigest)}</code>
        <span className="ui-fp-word">{words.filed}</span>
      </span>
    </span>
  );
}
