/** Lower-case, strip accents and collapse whitespace so comparisons ignore case and diacritics. */
export const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Host of a URL without "www.", lower-cased; null when the value is not a parseable URL. */
export const hostOf = (value: string): string | null => {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};
