import { writtenDate } from "@/components/ui/when";
import type { Lang } from "@/i18n/types";
import type { AffairContract } from "./affair-state";
import { vaultText } from "./dictionary";

/*
 * Why no new version may be prepared once someone has accepted (storyboard L1.6, §4 E1, L1-159 M5): who accepted, on
 * which day, and, while only one party has, who has not yet. « Vous » for the person reading, the other party by its
 * role. Null while nobody has accepted. The acceptance is of the contract, not of a version (L2 binds the two).
 */

type Acceptor = "you" | "company" | "freelance";

/** While only one party has accepted: « Le freelance ne l'a pas encore accepté. », or « Vous ne l'avez pas encore accepté. ». */
export function waitingLine(contract: Pick<AffairContract, "side" | "signedByFreelanceAt" | "signedByCompanyAt">, lang: Lang): string | null {
  const t = vaultText(lang);
  const freelance = contract.signedByFreelanceAt !== null;
  const company = contract.signedByCompanyAt !== null;
  if (freelance === company) return null;
  const waiting = freelance ? "company" : "freelance";
  const text = waiting === contract.side ? t.card.youNotYet : t.card.notYet(waiting === "company" ? t.who.company : t.who.freelance);
  return `${text.charAt(0).toLocaleUpperCase(lang)}${text.slice(1)}.`;
}

export function acceptanceLine(contract: Pick<AffairContract, "side" | "signedByFreelanceAt" | "signedByCompanyAt">, lang: Lang, latest: number): string | null {
  const t = vaultText(lang);
  const who = (side: "company" | "freelance"): Acceptor => (side === contract.side ? "you" : side);
  const name = (acceptor: Acceptor) => (acceptor === "you" ? t.who.you : acceptor === "company" ? t.who.company : t.who.freelance);
  const marks = (
    [
      { side: "freelance", at: contract.signedByFreelanceAt },
      { side: "company", at: contract.signedByCompanyAt },
    ] as const
  )
    .filter((mark): mark is { side: "freelance" | "company"; at: Date } => mark.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const [first, second] = marks;
  if (first === undefined) return null;
  const day = (at: Date) => writtenDate(at, lang, "day");
  if (second !== undefined) return t.card.closedBoth(name(who(first.side)), day(first.at), name(who(second.side)), day(second.at), latest);
  const waiting = who(first.side === "company" ? "freelance" : "company");
  return t.card.closedPartial(name(who(first.side)), day(first.at), waiting === "you" ? t.card.youNotYet : t.card.notYet(name(waiting)), latest);
}
