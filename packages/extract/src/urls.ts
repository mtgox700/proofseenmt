import { verifiedUrls, type Identity } from "@proofseen/core";

/** Sentence punctuation glued to a URL in running text ("…https://x.dev/)." ) is not part of it. */
export const stripTrailingPunctuation = (value: string): string => value.replace(/[.,;:!?)\]}'"»”’]+$/u, "");

/** host (without www, without trailing dot) + path, lower-cased, without trailing slash: "github.com/ayoubhm07". */
export const normalizeUrl = (value: string): string | null => {
  try {
    const url = new URL(stripTrailingPunctuation(value.trim()));
    const host = url.hostname.replace(/^www\./, "").replace(/\.+$/, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
};

/** True when the URL is, or lives under, one of the client's VERIFIED URLs (US-F00). */
export const isClientUrl = (value: string, identity: Identity): boolean => {
  const target = normalizeUrl(value);
  if (target === null) return false;
  return verifiedUrls(identity)
    .map((u) => normalizeUrl(u.url))
    .some((owned) => owned !== null && (target === owned || target.startsWith(`${owned}/`)));
};
