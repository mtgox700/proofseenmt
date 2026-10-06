import { AI_SEARCH_BOTS } from "@proofseen/hub";
import type { SiteFile } from "./site";

/*
 * Checks the DEPLOYED site against the folder that was published, the way the engines we measure will meet it. The
 * three-arm test (PIVOT_ANONYME §5) is worthless if a CDN turns an AI crawler away, if the host adds a noindex header
 * (Vercel does on preview URLs) or if the CDN injects a script (Cloudflare's e-mail obfuscation, Rocket Loader…).
 *
 * What it can and cannot prove — written down, not implied:
 * - CONTROLLED: pages served, content identical in substance, no injected script, no stray noindex, robots and sitemap.
 * - A crawler user-agent sent FROM OUR MACHINE that gets blocked proves a user-agent rule exists. A 200 does NOT prove
 *   the real crawler passes: a CDN may check the crawler's IP ranges. Only the crawler hits in the server logs
 *   (`sim:ldr --log`, stats/bots.ts) prove access. That check is therefore reported as "warn" at best, never as proof.
 */

export interface Served {
  readonly status: number;
  readonly body: string;
  readonly contentType: string;
  /** Value of the X-Robots-Tag response header, "" when absent. */
  readonly robotsTag: string;
}

/** `userAgent` undefined = an ordinary browser. The caller owns the network. */
export type FetchAs = (url: string, userAgent: string | undefined) => Served;

export interface SiteCheck {
  readonly name: string;
  readonly status: "ok" | "warn" | "fail";
  readonly detail: string;
}

export interface SiteReport {
  readonly checks: readonly SiteCheck[];
  readonly ok: boolean;
}

/** The token CDNs match on, in the shape the crawlers announce themselves. */
export const crawlerUserAgent = (bot: string): string => `Mozilla/5.0 (compatible; ${bot}/1.0; +https://proofseen.example/verification)`;

const CHALLENGE = /cf-chl|challenge-platform|Just a moment|Attention Required|captcha/i;

const urlOf = (baseUrl: string, path: string): string => `${baseUrl}/${path.replace(/index\.html$/, "")}`;
const isNoindex = (html: string): boolean => /<meta name="robots" content="[^"]*noindex/i.test(html);
const scripts = (html: string): number =>
  [...html.matchAll(/<script\b([^>]*)>/gi)].filter((m) => !/type\s*=\s*"application\/ld\+json"/i.test(m[1] ?? "")).length;
const canonicalOf = (html: string): string | undefined => html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
const titleOf = (html: string): string | undefined => html.match(/<title>([^<]*)<\/title>/)?.[1];

/** A handful of pages per arm is enough to detect a user-agent rule; sending every bot to every page is not needed. */
const botSample = (pages: readonly SiteFile[]): SiteFile[] => {
  const first = (prefix: RegExp): SiteFile[] => pages.filter((p) => prefix.test(p.path)).slice(0, 1);
  return [...first(/^index\.html$/), ...first(/^p\//), ...first(/^n\//), ...first(/^freelances\//), ...first(/^methode\//)];
};

const pageChecks = (baseUrl: string, pages: readonly SiteFile[], fetchAs: FetchAs): SiteCheck[] => {
  const served = pages.map((page) => ({ page, url: urlOf(baseUrl, page.path), response: fetchAs(urlOf(baseUrl, page.path), undefined) }));
  const up = served.filter((s) => s.response.status === 200);
  if (up.length === 0) return [{ name: "pages", status: "fail", detail: "no page answered with HTTP 200: is the site deployed and the domain pointing to it?" }];
  const down = served.filter((s) => s.response.status !== 200).map((s) => `${s.url} (HTTP ${s.response.status})`);
  // Same canonical and same title as the published file: the CDN served our page, not a cached or rewritten one.
  const drift = up.filter((s) => canonicalOf(s.response.body) !== canonicalOf(s.page.content) || titleOf(s.response.body) !== titleOf(s.page.content)).map((s) => s.url);
  const injected = up.filter((s) => scripts(s.response.body) > scripts(s.page.content)).map((s) => s.url);
  // An indexable page must not become noindex on the way, through a meta tag or through the X-Robots-Tag header.
  const strayNoindex = up
    .filter((s) => !isNoindex(s.page.content) && (isNoindex(s.response.body) || /noindex/i.test(s.response.robotsTag)))
    .map((s) => s.url);
  return [
    down.length === 0 ? { name: "pages", status: "ok", detail: `${pages.length} pages served with HTTP 200` } : { name: "pages", status: "fail", detail: down.join(", ") },
    drift.length === 0 ? { name: "served content", status: "ok", detail: "canonical and title identical to the published folder" } : { name: "served content", status: "fail", detail: `differs from the published folder: ${drift.join(", ")}` },
    injected.length === 0 ? { name: "no injected script", status: "ok", detail: "no script added on the way" } : { name: "no injected script", status: "fail", detail: `script added by the host or CDN on: ${injected.join(", ")}` },
    strayNoindex.length === 0
      ? { name: "noindex", status: "ok", detail: "no indexable page turned noindex (meta or X-Robots-Tag)" }
      : { name: "noindex", status: "fail", detail: `noindex added by the host on: ${strayNoindex.join(", ")}` },
  ];
};

const crawlerCheck = (baseUrl: string, pages: readonly SiteFile[], fetchAs: FetchAs): SiteCheck => {
  const sample = botSample(pages);
  const refused = AI_SEARCH_BOTS.flatMap((bot) =>
    sample
      .map((page) => ({ url: urlOf(baseUrl, page.path), response: fetchAs(urlOf(baseUrl, page.path), crawlerUserAgent(bot)) }))
      .filter((r) => r.response.status !== 200 || CHALLENGE.test(r.response.body))
      .map((r) => `${bot} → ${r.url} (${r.response.status === 200 ? "challenge page" : `HTTP ${r.response.status}`})`),
  );
  return refused.length > 0
    ? { name: "AI crawlers", status: "fail", detail: `a user-agent rule turns crawlers away: ${refused.join(" · ")}` }
    : {
        name: "AI crawlers",
        status: "warn",
        detail: `${AI_SEARCH_BOTS.length} crawler user-agents × ${sample.length} pages answered 200 — no user-agent block, but only crawler hits in the server logs prove real access`,
      };
};

/** Texte visible, débarrassé des balises et des blancs : deux rendus du même contenu se comparent ainsi. */
const visibleText = (html: string): string =>
  html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Aucun contenu différent selon qui regarde (charte publique : « pas de contenu différent selon qui regarde »).
 *
 * Le contrôle précédent vérifiait seulement que les robots ne sont pas **bloqués**. Or servir une page différente à un
 * robot — plus flatteuse, ou porteuse d'instructions — est une manipulation qui passe inaperçue à un contrôle de
 * statut : le robot reçoit bien un 200. On compare donc le texte visible, robot contre navigateur ordinaire.
 */
const cloakingCheck = (baseUrl: string, pages: readonly SiteFile[], fetchAs: FetchAs): SiteCheck => {
  const differing = botSample(pages).flatMap((page) => {
    const url = urlOf(baseUrl, page.path);
    const plain = fetchAs(url, undefined);
    if (plain.status !== 200) return [];
    return AI_SEARCH_BOTS.flatMap((bot) => {
      const served = fetchAs(url, crawlerUserAgent(bot));
      return served.status === 200 && visibleText(served.body) !== visibleText(plain.body) ? [`${bot} → ${url}`] : [];
    });
  });
  return differing.length === 0
    ? { name: "no cloaking", status: "ok", detail: "crawlers and browsers are served the same visible text" }
    : { name: "no cloaking", status: "fail", detail: `different content served to crawlers: ${differing.join(" · ")}` };
};

const robotsCheck = (baseUrl: string, fetchAs: FetchAs): SiteCheck => {
  const robots = fetchAs(`${baseUrl}/robots.txt`, undefined);
  if (robots.status !== 200) return { name: "robots.txt", status: "fail", detail: `HTTP ${robots.status}` };
  const blocked = AI_SEARCH_BOTS.filter((bot) => !robots.body.includes(`User-agent: ${bot}\nAllow: /`));
  const declared = robots.body.includes(`Sitemap: ${baseUrl}/sitemap.xml`);
  return blocked.length === 0 && declared
    ? { name: "robots.txt", status: "ok", detail: `${AI_SEARCH_BOTS.length} AI crawlers allowed, sitemap declared` }
    : { name: "robots.txt", status: "fail", detail: [blocked.length > 0 ? `not allowed: ${blocked.join(", ")}` : "", declared ? "" : "sitemap not declared"].filter(Boolean).join(" · ") };
};

const sitemapCheck = (baseUrl: string, pages: readonly SiteFile[], fetchAs: FetchAs): SiteCheck => {
  const sitemap = fetchAs(`${baseUrl}/sitemap.xml`, undefined);
  if (sitemap.status !== 200) return { name: "sitemap", status: "fail", detail: `HTTP ${sitemap.status}` };
  const missing = pages.filter((p) => !isNoindex(p.content) && !sitemap.body.includes(`<loc>${urlOf(baseUrl, p.path)}</loc>`)).map((p) => urlOf(baseUrl, p.path));
  return missing.length === 0 ? { name: "sitemap", status: "ok", detail: "every indexable page listed" } : { name: "sitemap", status: "fail", detail: `missing: ${missing.join(", ")}` };
};

/** Every file of the published folder that the deployed site must serve identically. */
export const verifyDeployedSite = (baseUrl: string, published: readonly SiteFile[], fetchAs: FetchAs): SiteReport => {
  const pages = published.filter((f) => f.path.endsWith(".html")).sort((a, b) => a.path.localeCompare(b.path));
  const extras = published.filter((f) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(f.path));
  const checks: SiteCheck[] = [
    ...pageChecks(baseUrl, pages, fetchAs),
    crawlerCheck(baseUrl, pages, fetchAs),
    cloakingCheck(baseUrl, pages, fetchAs),
    robotsCheck(baseUrl, fetchAs),
    sitemapCheck(baseUrl, pages, fetchAs),
    ...extras.map((file): SiteCheck => {
      const served = fetchAs(`${baseUrl}/${file.path}`, undefined);
      return served.status === 200 && served.body.trim() === file.content.trim()
        ? { name: "IndexNow key", status: "ok", detail: `/${file.path} served and identical` }
        : { name: "IndexNow key", status: "fail", detail: served.status === 200 ? `/${file.path} served but different` : `/${file.path}: HTTP ${served.status}` };
    }),
  ];
  return { checks, ok: checks.every((c) => c.status !== "fail") };
};
