import type { VersionSummary } from "@proofseen/db";
import type { VaultDictionary } from "@/i18n/market/vault-fr";
import { vaultText } from "./dictionary";

/*
 * Small facts about versions that several screens of the vault say the same way (storyboard L1.6, §4): who wrote a
 * version, in words and never by a name; its size; whether its fingerprint is inking (M1); which two versions a
 * comparison address asks for.
 */

/** « vous », « votre entreprise », « l'entreprise », « le freelance », « un ancien membre de l'entreprise », « un compte supprimé ». */
export function authorLabel(version: Pick<VersionSummary, "by" | "side">, who: VaultDictionary["who"]): string {
  switch (version.by) {
    case "you":
      return who.you;
    case "colleague":
      return who.colleague;
    case "former_member":
      return who.formerMember;
    case "removed":
      return who.removed;
    case "other_party":
      return version.side === "company" ? who.company : version.side === "freelance" ? who.freelance : who.otherParty;
  }
}

/** Kilobytes rounded up, as the screens write a size: 412 Ko, never 0 Ko for a real file. */
export const kilobytes = (bytes: number): number => Math.max(1, Math.ceil(bytes / 1024));

/** How long after its birth a version still inks on the tab (M1): a reload in that time replays 640 ms of ink, no more. */
export const INK_WINDOW_MS = 10 * 60_000;
const NUMBER = /^[1-9][0-9]{0,5}$/;

/**
 * The version whose fingerprint inks (§6 M1): `?depose={n}` AND, read in the database, version n is the latest, written
 * by you, less than ten minutes ago. Anything else: null, and the stratum is drawn at rest.
 */
export function inkingVersion(param: string | null, latest: Pick<VersionSummary, "number" | "by" | "createdAt"> | null, now: Date): number | null {
  if (param === null || !NUMBER.test(param) || latest === null) return null;
  const age = now.getTime() - latest.createdAt.getTime();
  return Number(param) === latest.number && latest.by === "you" && age >= 0 && age <= INK_WINDOW_MS ? latest.number : null;
}

export type CompareRequest =
  | { readonly kind: "ok"; readonly from: number; readonly to: number }
  /** Asked in the wrong order: 307 to the older first, so that « added » always means « appeared in the newer ». */
  | { readonly kind: "redirect"; readonly from: number; readonly to: number }
  | { readonly kind: "same"; readonly number: number }
  | { readonly kind: "single" }
  | { readonly kind: "unknown" };

const VERSION = /^[1-9][0-9]{0,2}$/;

/**
 * The two versions a comparison address asks for (§4 E5): `de` and `a` from 1 to 999; `a` alone means the one before
 * it; nothing means the latest and the one before. A number this document does not have is « unknown » (404).
 */
export function readCompare(de: string | null, a: string | null, latest: number): CompareRequest {
  if (latest < 2) return { kind: "single" };
  const parse = (raw: string | null): number | null | "bad" => (raw === null ? null : VERSION.test(raw) ? Number(raw) : "bad");
  const from = parse(de);
  const to = parse(a);
  if (from === "bad" || to === "bad") return { kind: "unknown" };
  const pair = to === null ? (from === null ? [latest - 1, latest] : [from, latest]) : from === null ? [to - 1, to] : [from, to];
  const [x, y] = pair as [number, number];
  if (x < 1 || y < 1 || x > latest || y > latest) return { kind: "unknown" };
  if (x === y) return { kind: "same", number: x };
  return x > y ? { kind: "redirect", from: y, to: x } : { kind: "ok", from: x, to: y };
}

/** The reason of a version nobody explained, in the language of the page that posted it (L1-159). */
export const defaultReason = (lang: "fr" | "en", expected: number): string => {
  const card = vaultText(lang).card;
  return expected === 0 ? card.firstVersion : card.nextVersion;
};
