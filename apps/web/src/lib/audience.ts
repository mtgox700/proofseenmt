import { createHmac } from "node:crypto";
import { AI_SEARCH_BOTS } from "@proofseen/hub";

/*
 * Who counts as a visitor, and how a visitor is recognised for one day without being identified.
 *
 * The fingerprint is an HMAC of the address and the browser string under a key derived from the server secret and the
 * date: tomorrow's key is unrelated to today's, so a fingerprint links nothing across days, and the address itself is
 * never written anywhere. Crawlers (the AI and search bots that marketplace-verify checks, and generic automation) are
 * not visitors: a profile's audience is people.
 */

const MIN_SECRET_LENGTH = 32;
const HASH_LENGTH = 22;
const MAX_AGENT_LENGTH = 512;

/** Agents named on top of the bots every public page must stay open to. */
const NAMED_AGENTS = [
  ...AI_SEARCH_BOTS,
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot",
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "meta-externalagent",
  "facebookexternalhit",
  "DuckDuckBot",
  "YandexBot",
  "Baiduspider",
  "Lighthouse",
  "Chrome-Lighthouse",
] as const;

/** Generic automation: crawlers, link previews, HTTP libraries, headless browsers, monitors. */
const AUTOMATION = /bot\b|bot\/|crawl|spider|slurp|scrap|preview|fetcher|monitor|uptime|headless|phantomjs|puppeteer|playwright|selenium|curl\/|wget\/|python-|python\/|httpx|aiohttp|axios\/|node-fetch|undici|go-http-client|java\/|okhttp|libwww|httpclient|postman|insomnia/i;

/** True for crawlers and scripts, and for a request with no browser string at all. */
export const isAutomatedAgent = (userAgent: string | null): boolean => {
  const agent = (userAgent ?? "").trim();
  if (agent === "") return true;
  const lower = agent.toLowerCase();
  return NAMED_AGENTS.some((name) => lower.includes(name.toLowerCase())) || AUTOMATION.test(agent);
};

/** A browser prefetch or prerender is not a visit: the person may never open the page. */
export const isSpeculative = (headers: Pick<Headers, "get">): boolean => {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-purpose") ?? ""}`.toLowerCase();
  return purpose.includes("prefetch") || purpose.includes("prerender") || headers.get("x-moz") === "prefetch";
};

/** The usable secret, or `null` (counting then stays off rather than hashing under a guessable key). */
export const audienceSecret = (env: Readonly<Record<string, string | undefined>> = process.env): string | null => {
  const secret = env.PROOFSEEN_ACCESS_SECRET ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
};

/** The key of one day (`AAAA-MM-JJ`), derived from the secret under its own label. */
const dailyKey = (secret: string, day: string): Buffer => createHmac("sha256", `proofseen:audience:v1:${secret}`).update(day).digest();

/** The visitor's fingerprint for that day: 22 base64url characters, never the address. */
export const viewerHash = (secret: string, day: string, address: string, userAgent: string): string =>
  createHmac("sha256", dailyKey(secret, day))
    .update(`${address}\n${userAgent.slice(0, MAX_AGENT_LENGTH)}`)
    .digest("base64url")
    .slice(0, HASH_LENGTH);
