import type { CitedDomains, Identity } from "@proofseen/core";
import { isClientUrl } from "./urls";

/** Versioned whitelist (REQ-M2-05): only these platform domains are ever stored by name. */
export const PLATFORM_DOMAINS = [
  "linkedin.com",
  "github.com",
  "gitlab.com",
  "malt.fr",
  "malt.com",
  "codeur.com",
  "dev.to",
  "medium.com",
  "stackoverflow.com",
  "upwork.com",
  "free-work.com",
  "welcometothejungle.com",
  "comet.co",
  "cremedelacreme.io",
  "x.com",
  "twitter.com",
  "youtube.com",
  // Notre propre domaine : l'indicateur de conquête est sa part des citations, face à Malt et LinkedIn.
  "proofseen.com",
] as const;

export type HostClass = `platform:${string}` | "client" | "other";

export const platformOf = (host: string): string | null => {
  const clean = host.replace(/^www\./, "").toLowerCase();
  return PLATFORM_DOMAINS.find((p) => clean === p || clean.endsWith(`.${p}`)) ?? null;
};

export const classifyHost = (host: string, clientHosts: readonly string[]): HostClass => {
  const clean = host.replace(/^www\./, "").toLowerCase();
  if (clientHosts.includes(clean)) return "client";
  const platform = platformOf(clean);
  return platform === null ? "other" : `platform:${platform}`;
};

/** Counts cited URLs per whitelisted platform; the client's URLs and everything else are only counted. */
export const tallyCitedDomains = (urls: readonly string[], identity: Identity): CitedDomains =>
  urls.reduce<CitedDomains>(
    (acc, url) => {
      if (isClientUrl(url, identity)) return { ...acc, client: acc.client + 1 };
      let host: string;
      try {
        host = new URL(url).hostname;
      } catch {
        return { ...acc, other: acc.other + 1 };
      }
      const platform = platformOf(host);
      if (platform === null) return { ...acc, other: acc.other + 1 };
      return { ...acc, platform: { ...acc.platform, [platform]: (acc.platform[platform] ?? 0) + 1 } };
    },
    { platform: {}, client: 0, other: 0 },
  );
