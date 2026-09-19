import { escapeHtml } from "./html";
import { pagePath, renderHome, renderMission } from "./pages";
import type { HubProfile, Locale } from "./schema";

/** Bots that must be allowed (RESEARCH_GROUND_TRUTH §2: blocking OAI-SearchBot removes a site from ChatGPT search). */
export const AI_SEARCH_BOTS = ["Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "Claude-User", "PerplexityBot"] as const;

export interface SiteFile {
  /** Path relative to the output directory, with forward slashes. */
  readonly path: string;
  readonly content: string;
}

const LOCALES: readonly Locale[] = ["fr", "en"];

const fileFor = (urlPath: string): string => `${urlPath.replace(/^\//, "")}index.html`;

const robots = (p: HubProfile): string =>
  [...AI_SEARCH_BOTS.map((bot) => `User-agent: ${bot}\nAllow: /\n`), "User-agent: *\nAllow: /\n", `Sitemap: ${p.baseUrl}/sitemap.xml`, ""].join("\n");

const sitemap = (p: HubProfile, paths: readonly string[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${escapeHtml(`${p.baseUrl}${path}`)}</loc><lastmod>${p.availability.updatedAt}</lastmod></url>`),
    "</urlset>",
    "",
  ].join("\n");

/** Pure: profile in, files out. Static HTML only — what AI crawlers can actually read (no client-side rendering). */
export const buildSite = (profile: HubProfile): SiteFile[] => {
  const pages = LOCALES.flatMap((locale) => [
    { path: pagePath(locale, null), content: renderHome(profile, locale) },
    ...profile.missions.map((m) => ({ path: pagePath(locale, m.slug), content: renderMission(profile, m, locale) })),
  ]);
  const verification =
    profile.verificationToken === null ? [] : [{ path: ".well-known/proofseen-verification.txt", content: `${profile.verificationToken}\n` }];
  return [
    ...pages.map((page) => ({ path: fileFor(page.path), content: page.content })),
    { path: "robots.txt", content: robots(profile) },
    { path: "sitemap.xml", content: sitemap(profile, pages.map((page) => page.path)) },
    ...verification,
  ];
};
