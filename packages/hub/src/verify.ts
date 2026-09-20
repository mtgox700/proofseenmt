import { AI_SEARCH_BOTS, buildSite } from "./build";
import { pagePath } from "./pages";
import type { HubProfile, Locale } from "./schema";

/*
 * Checks a DEPLOYED hub the way a crawler sees it: raw HTML only, no JavaScript executed. It answers the question the
 * sprint asks ("is the visible text in the served HTML?") instead of trusting the local build. Pure: the caller fetches.
 */

export interface Fetched {
  readonly status: number;
  readonly body: string;
  readonly contentType: string;
}

export type FetchPage = (url: string) => Fetched;

export interface VerifyCheck {
  readonly name: string;
  readonly status: "ok" | "warn" | "fail";
  readonly detail: string;
}

export interface VerifyReport {
  readonly checks: readonly VerifyCheck[];
  readonly ok: boolean;
}

const LOCALES: readonly Locale[] = ["fr", "en"];

/** Text that must survive to the served HTML, per page. */
const expectedTexts = (p: HubProfile, locale: Locale, slug: string | null): string[] => {
  if (slug === null) {
    return [p.person.name, p.person.headline[locale], p.person.summary[locale], ...p.person.stack];
  }
  const mission = p.missions.find((m) => m.slug === slug)!;
  return [mission.title[locale], mission.summary[locale], ...mission.facts.map((f) => f.value), ...mission.facts.map((f) => f.source)];
};

const pagesOf = (p: HubProfile): { url: string; locale: Locale; slug: string | null }[] =>
  LOCALES.flatMap((locale) => [
    { url: `${p.baseUrl}${pagePath(locale, null)}`, locale, slug: null },
    ...p.missions.map((m) => ({ url: `${p.baseUrl}${pagePath(locale, m.slug)}`, locale, slug: m.slug })),
  ]);

/** Scripts other than JSON-LD mean the page may need a browser to be readable. */
const executableScripts = (html: string): number =>
  [...html.matchAll(/<script\b([^>]*)>/gi)].filter((m) => !/type\s*=\s*"application\/ld\+json"/i.test(m[1] ?? "")).length;

const missingText = (html: string, texts: readonly string[]): string[] => texts.filter((t) => !html.includes(t));

/** status 0 = the request never got an answer (DNS, TLS, timeout). */
const httpLabel = (status: number): string => (status === 0 ? "unreachable (DNS, TLS or timeout)" : `HTTP ${status}`);

/**
 * A check that inspects pages can only pass if pages were actually inspected: with nothing reachable, "no problem found"
 * would be a false green. Found by running the command against a domain that is not deployed yet (2026-09-20).
 */
const overPages = (inspected: number, problems: readonly string[], name: string, okDetail: string, failDetail: (p: readonly string[]) => string): VerifyCheck => {
  if (inspected === 0) return { name, status: "fail", detail: "not checked: no page was reachable" };
  return problems.length === 0 ? { name, status: "ok", detail: okDetail } : { name, status: "fail", detail: failDetail(problems) };
};

export const verifyHub = (profile: HubProfile, fetchPage: FetchPage): VerifyReport => {
  const pages = pagesOf(profile);
  const fetched = pages.map((page) => ({ ...page, response: fetchPage(page.url) }));

  const reachable = fetched.filter((f) => f.response.status === 200);
  const down = fetched.filter((f) => f.response.status !== 200);
  const unreachable = down.length === fetched.length && down.every((f) => f.response.status === 0)
    ? ["no page answered at all (DNS, TLS or timeout): is the site deployed and the domain pointing to it?"]
    : down.map((f) => `${f.url} (${httpLabel(f.response.status)})`);
  const notHtml = fetched.filter((f) => f.response.status === 200 && !f.response.contentType.includes("text/html")).map((f) => f.url);
  const textProblems = fetched
    .filter((f) => f.response.status === 200)
    .flatMap((f) => {
      const missing = missingText(f.response.body, expectedTexts(profile, f.locale, f.slug));
      return missing.length === 0 ? [] : [`${f.url}: ${missing.length} missing (e.g. "${missing[0]!.slice(0, 40)}")`];
    });
  const scripted = fetched.filter((f) => f.response.status === 200 && executableScripts(f.response.body) > 0).map((f) => f.url);
  const linkProblems = fetched
    .filter((f) => f.response.status === 200)
    .flatMap((f) => {
      const canonical = `<link rel="canonical" href="${f.url}">`;
      const hreflang = LOCALES.map((l) => `hreflang="${l}" href="${profile.baseUrl}${pagePath(l, f.slug)}"`);
      const missing = [canonical, ...hreflang].filter((needle) => !f.response.body.includes(needle));
      return missing.length === 0 ? [] : [f.url];
    });

  const robots = fetchPage(`${profile.baseUrl}/robots.txt`);
  const blocked = robots.status === 200 ? AI_SEARCH_BOTS.filter((bot) => !robots.body.includes(`User-agent: ${bot}\nAllow: /`)) : [...AI_SEARCH_BOTS];
  const sitemapDeclared = robots.status === 200 && robots.body.includes(`Sitemap: ${profile.baseUrl}/sitemap.xml`);

  const sitemap = fetchPage(`${profile.baseUrl}/sitemap.xml`);
  const notListed = sitemap.status === 200 ? pages.filter((p) => !sitemap.body.includes(`<loc>${p.url}</loc>`)).map((p) => p.url) : pages.map((p) => p.url);

  const checks: VerifyCheck[] = [
    unreachable.length === 0
      ? { name: "pages", status: "ok", detail: `${pages.length} pages served with HTTP 200` }
      : { name: "pages", status: "fail", detail: unreachable.join(", ") },
    overPages(reachable.length, notHtml, "content type", "every page served as text/html", (p) => `not text/html: ${p.join(", ")}`),
    overPages(
      reachable.length,
      textProblems,
      "text in the HTML",
      "name, headline, summary, stack, missions and sources all present without JavaScript",
      (p) => p.join(" · "),
    ),
    overPages(reachable.length, scripted, "no JavaScript", "no script other than JSON-LD", (p) => `executable script on: ${p.join(", ")}`),
    overPages(reachable.length, linkProblems, "canonical and hreflang", `aligned with ${profile.baseUrl}`, (p) => `wrong or missing on: ${p.join(", ")}`),
    blocked.length === 0 && sitemapDeclared
      ? { name: "robots.txt", status: "ok", detail: `${AI_SEARCH_BOTS.length} AI crawlers allowed, sitemap declared` }
      : {
          name: "robots.txt",
          status: "fail",
          detail: robots.status !== 200 ? httpLabel(robots.status) : [blocked.length > 0 ? `not allowed: ${blocked.join(", ")}` : "", sitemapDeclared ? "" : "sitemap not declared"].filter(Boolean).join(" · "),
        },
    notListed.length === 0
      ? { name: "sitemap", status: "ok", detail: `${pages.length} pages listed` }
      : { name: "sitemap", status: "fail", detail: sitemap.status !== 200 ? httpLabel(sitemap.status) : `missing: ${notListed.join(", ")}` },
  ];

  if (profile.verificationToken !== null) {
    const token = fetchPage(`${profile.baseUrl}/.well-known/proofseen-verification.txt`);
    checks.push(
      token.status === 200 && token.body.trim() === profile.verificationToken
        ? { name: "possession token", status: "ok", detail: "/.well-known/proofseen-verification.txt matches the profile" }
        : { name: "possession token", status: "fail", detail: token.status === 200 ? "file served but content differs" : httpLabel(token.status) },
    );
  }

  return { checks, ok: checks.every((c) => c.status !== "fail") };
};

/** Files the deployment must serve, for a founder who uploads by hand. */
export const deployedPaths = (profile: HubProfile): string[] => buildSite(profile).map((f) => f.path);

/** Every URL `verifyHub` will ask for: the caller fetches them (network belongs to the CLI, not to this package). */
export const urlsToFetch = (profile: HubProfile): string[] =>
  deployedPaths(profile).map((path) => `${profile.baseUrl}/${path.replace(/index\.html$/, "")}`);
