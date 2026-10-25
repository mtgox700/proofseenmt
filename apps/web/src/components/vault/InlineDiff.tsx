import type { Lang } from "@/i18n/types";
import { vaultText } from "@/lib/vault/dictionary";
import type { Piece } from "@/lib/vault/words";

/*
 * The words of a changed paragraph (storyboard L1.6, §4 E5): removed words in <del> (struck), added ones in <ins>
 * (underlined, offset 0.2 em), both dated by their version. Most screen readers announce neither: each mark says
 * « Retiré : » or « Ajouté : » in a text hidden from the eye, and « fin de l'ajout » after. Never colour alone.
 */

export interface InlineDiffProps {
  readonly lang: Lang;
  readonly pieces: readonly Piece[];
  /** The day of the newer version (for <ins>) and of the older one (for <del>). */
  readonly addedOn: string;
  readonly removedOn: string;
  /** Show only the kept and removed words (before), or the kept and added ones (after); both by default. */
  readonly side?: "before" | "after" | "both";
}

export function InlineDiff({ lang, pieces, addedOn, removedOn, side = "both" }: InlineDiffProps) {
  const sr = vaultText(lang).compare.sr;
  return (
    <>
      {pieces.map((piece, index) => {
        if (piece.op === "same") return <span key={index}>{piece.text}</span>;
        if (piece.op === "removed") {
          if (side === "after") return null;
          return (
            <del key={index} dateTime={removedOn}>
              <span className="sr-only">{sr.removed}</span>
              {piece.text}
            </del>
          );
        }
        if (side === "before") return null;
        return (
          <ins key={index} dateTime={addedOn}>
            <span className="sr-only">{sr.added}</span>
            {piece.text}
            <span className="sr-only">{` ${sr.endAdded}`}</span>
          </ins>
        );
      })}
    </>
  );
}
