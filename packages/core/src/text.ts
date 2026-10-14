const FORMAT = new RegExp(String.raw`\p{Cf}`, "gu");
const CONTROL = new RegExp(String.raw`\p{Cc}`, "gu");
const NOT_LETTER_OR_DIGIT = new RegExp(String.raw`[^\p{L}\p{N}]`, "gu");

/**
 * Lower-case, strip accents and collapse whitespace so comparisons ignore case and diacritics. Invisible format
 * characters (zero-width, soft hyphen, bidi controls) are dropped and control characters become spaces: neither can
 * hide a word from a comparison.
 */
export const normalizeText = (value: string): string =>
  value
    .replace(FORMAT, "")
    .replace(CONTROL, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Letters and digits only, normalised: « J.e-a_n » and « Jean » compare equal. For leak checks, never for display. */
export const compactText = (value: string): string => normalizeText(value).replace(NOT_LETTER_OR_DIGIT, "");

/** Host of a URL without "www.", lower-cased; null when the value is not a parseable URL. */
export const hostOf = (value: string): string | null => {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};
