import { normalizeText, type Identity } from "@proofseen/core";
import type { Candidate } from "./candidates";
import { platformOf } from "./domains";
import { FIRST_NAMES } from "./lexicon";
import { isClientUrl, stripTrailingPunctuation } from "./urls";

// Bounded to RFC 5321 limits so matching stays linear on adversarial input (a long run without "@").
const EMAIL = /[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}.-]{1,253}\.[\p{L}]{2,24}/gu;
const URL_PATTERN = /\bhttps?:\/\/[^\s)>\]"'<]+/gi;
// Any plausible TLD (2-24 letters), not a whitelist; file extensions and tech names ("Next.js", "ASP.NET") are excluded below.
const BARE_DOMAIN = /\b[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63}){0,4}\.([a-z]{2,24})\b(?:\/[^\s)>\]"'<]*)?/gi;
const NOT_A_TLD = new Set(["js", "ts", "jsx", "tsx", "py", "rb", "rs", "go", "java", "kt", "php", "md", "json", "yaml", "yml", "txt", "pdf", "png", "jpg", "jpeg", "svg", "html", "css", "sh", "exe", "dll", "net"]);
const CAPITALISED = "(?:d['’])?\\p{Lu}[\\p{L}'’-]+";
const PARTICLE = "(?:(?:de|du|des|van|von|der|den|di|da|le|la)\\s+)?";
// Unicode-aware start boundary: `\b` is ASCII-only in JS and would miss "Élodie".
const LEXICON_NAME = new RegExp(`(?<![\\p{L}\\p{N}])(\\p{Lu}[\\p{L}-]+)((?:\\s+${PARTICLE}${CAPITALISED}){1,2})`, "gu");

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isClientName = (value: string, identity: Identity): boolean => {
  const n = normalizeText(value);
  return identity.nameVariants.some((v) => {
    const variant = normalizeText(v);
    return n === variant || variant.includes(n) || n.includes(variant);
  });
};

const maskUrl = (url: string, identity: Identity): string => {
  if (isClientUrl(url, identity)) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "[URL]";
  }
  const platform = platformOf(parsed.hostname);
  if (platform === null) return "[URL]";
  const hasProfilePath = parsed.pathname.replace(/\/+$/, "").length > 0;
  return hasProfilePath ? `[PROFILE_URL:${platform}]` : url;
};

const maskBareDomain = (domain: string, identity: Identity): string => {
  if (isClientUrl(`https://${domain}`, identity)) return domain;
  const host = domain.split("/")[0] ?? domain;
  return platformOf(host) !== null && !domain.includes("/") ? domain : "[DOMAIN]";
};

/** Replaces third-party names, profile URLs, personal domains and e-mails; the client's own identity is exempt. */
export const maskThirdParties = (text: string, candidates: readonly Candidate[], identity: Identity): string => {
  const tokens = new Map<string, string>();
  const tokenFor = (name: string): string => {
    const key = normalizeText(name);
    const existing = tokens.get(key);
    if (existing !== undefined) return existing;
    const token = `[PERSON_${tokens.size + 1}]`;
    tokens.set(key, token);
    return token;
  };

  const thirdPartyNames = candidates.map((c) => c.name).filter((name) => !isClientName(name, identity));
  const surnames = thirdPartyNames
    .flatMap((name) => name.split(/\s+/))
    .filter((part) => part.length >= 3 && /^\p{Lu}/u.test(part) && !isClientName(part, identity));

  let out = text
    .replace(EMAIL, "[EMAIL]")
    .replace(URL_PATTERN, (url) => {
      const core = stripTrailingPunctuation(url);
      return `${maskUrl(core, identity)}${url.slice(core.length)}`;
    })
    .replace(BARE_DOMAIN, (domain, tld: string) => (NOT_A_TLD.has(tld.toLowerCase()) ? domain : maskBareDomain(domain, identity)));

  [...thirdPartyNames].sort((a, b) => b.length - a.length).forEach((name) => {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "giu"), () => tokenFor(name));
  });

  out = out.replace(LEXICON_NAME, (full, first: string) =>
    FIRST_NAMES.has(first) && !isClientName(full, identity) ? tokenFor(full) : full,
  );

  surnames.forEach((part) => {
    out = out.replace(new RegExp(`(?<![\\p{L}])${escapeRegExp(part)}(?![\\p{L}])`, "gu"), "[NAME_PART]");
  });
  return out;
};
