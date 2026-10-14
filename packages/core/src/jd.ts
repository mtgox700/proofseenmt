import type { Identity } from "./schemas";
import { compactText, hostOf, normalizeText } from "./text";

// Bounded to RFC 5321 limits so matching stays linear on adversarial input (a long run without "@").
const EMAIL = /[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}.-]{1,253}\.[\p{L}]{2,24}/gu;
const URL_PATTERN = /\bhttps?:\/\/[^\s)>\]]+/gi;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){3,6}\d{2,4}/g;
const CONTACT_LINE = /^\s*(contact|recruteur|recruteuse|recruiter|interlocut(?:eur|rice)|hiring manager|posted by|publié par|chargée? de recrutement)\b.*$/gim;

/**
 * Removes recruiter contact data from a job description before it is sent to any engine
 * (CAHIER_DES_CHARGES US-F01: e-mails, phones, URLs and recruiter names).
 */
export const sanitizeJobDescription = (raw: string): string =>
  raw
    .replace(CONTACT_LINE, "")
    .replace(EMAIL, "[email retiré]")
    .replace(URL_PATTERN, "[lien retiré]")
    .replace(PHONE, (match) => (match.replace(/\D/g, "").length >= 8 ? "[téléphone retiré]" : match))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && (lines[index - 1] ?? "").length > 0))
    .join("\n")
    .trim();

export class JdIdentityLeakError extends Error {
  constructor(readonly reason: "name" | "url") {
    super(`job description rejected: it contains the client's identity (${reason})`);
    this.name = "JdIdentityLeakError";
  }
}

/** Shortest compact form compared without word boundaries: below it, a match across words would be chance. */
const MIN_COMPACT_LENGTH = 6;
const WORD_SPLIT = new RegExp(String.raw`[^\p{L}\p{N}]+`, "u");

/**
 * A name variant appears in the text: as written (case, accents and invisible characters ignored), or squeezed to its
 * letters and digits (« A.y.o.u.b », « ayoub_hammoudi »). The squeezed comparison skips variants with an initial:
 * « A. Hammoudi » squeezed would match « Lisa Hammoudi ».
 */
const nameIn = (haystack: string, compactHaystack: string, variant: string): boolean => {
  if (haystack.includes(normalizeText(variant))) return true;
  const words = normalizeText(variant).split(WORD_SPLIT).filter((word) => word !== "");
  const compact = compactText(variant);
  return words.length > 0 && words.every((word) => word.length >= 2) && compact.length >= MIN_COMPACT_LENGTH && compactHaystack.includes(compact);
};

/** The host without its last label, squeezed: « ayoub-hammoudi.dev » → « ayoubhammoudi ». */
const hostStem = (host: string): string => compactText(host.split(".").slice(0, -1).join("."));

/** Rejects client-supplied JDs that would inflate the measurement by naming the client (REVUE #7). */
export const assertJdFreeOfIdentity = (text: string, identity: Identity): void => {
  const haystack = normalizeText(text);
  const compactHaystack = compactText(text);
  if (identity.nameVariants.some((variant) => nameIn(haystack, compactHaystack, variant))) {
    throw new JdIdentityLeakError("name");
  }
  const hosts = identity.ownedUrls.map((u) => hostOf(u.url)).filter((h): h is string => h !== null);
  const personalHosts = hosts.filter((h) => !["github.com", "linkedin.com", "malt.fr", "malt.com"].includes(h));
  const stems = personalHosts.map(hostStem).filter((stem) => stem.length >= MIN_COMPACT_LENGTH);
  if (stems.some((stem) => compactHaystack.includes(stem))) throw new JdIdentityLeakError("url");
  const paths = identity.ownedUrls
    .map((u) => {
      try {
        return new URL(u.url).pathname.replace(/\/+$/, "").toLowerCase();
      } catch {
        return "";
      }
    })
    .filter((p) => p.length > 1);
  if (personalHosts.some((h) => haystack.includes(h)) || paths.some((p) => haystack.includes(p))) {
    throw new JdIdentityLeakError("url");
  }
};
