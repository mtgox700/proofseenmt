/*
 * The first proofseen.com was a static site. Its pages are indexed by Google under addresses that end with a slash
 * (`/n/ayoub-hammoudi/`), and their canonical link says so. When the application takes over the domain, those exact
 * addresses keep answering with the same pages, served from `public/legacy/`: no redirect, no change of canonical, so
 * nothing already indexed is lost.
 *
 * Every other address keeps Next's usual rule (no trailing slash), applied here because the automatic redirect is
 * switched off for the legacy pages to stay reachable as they are.
 */

const PAGES: ReadonlySet<string> = new Set([
  "/contact/",
  "/methode/",
  "/n/ayoub-hammoudi/",
  "/p/FR-7H2XK/",
  "/en/contact/",
  "/en/method/",
  "/en/n/ayoub-hammoudi/",
  "/en/p/FR-7H2XK/",
]);

const FILES: Readonly<Record<string, string>> = { "/api/profiles.json": "/legacy/api/profiles.json" };

/*
 * The demonstration spaces were retired in C13: they showed the founder's frozen measure and a frozen directory to
 * every visitor. Their addresses may be indexed or bookmarked, so they answer with a permanent redirect rather than a
 * 404: the freelancer space to the connected space, the company space to the public directory of published profiles.
 * `/fr/freelances` (the directory) must not match the `/fr/freelance` rule: the segment ends at a slash or the end.
 */
const RETIRED: readonly { readonly pattern: RegExp; readonly to: (lang: string) => string }[] = [
  { pattern: /^\/(fr|en)\/freelance(?:\/.*)?$/, to: (lang) => `/${lang}/app` },
  { pattern: /^\/(fr|en)\/entreprise(?:\/.*)?$/, to: (lang) => `/${lang}/freelances` },
];

export type LegacyRoute = { readonly kind: "serve"; readonly file: string } | { readonly kind: "redirect"; readonly to: string } | { readonly kind: "none" };

const retired = (pathname: string): LegacyRoute | null => {
  for (const rule of RETIRED) {
    const lang = rule.pattern.exec(pathname)?.[1];
    if (lang !== undefined) return { kind: "redirect", to: rule.to(lang) };
  }
  return null;
};

export const legacyRoute = (pathname: string): LegacyRoute => {
  const file = FILES[pathname];
  if (file !== undefined) return { kind: "serve", file };
  const gone = retired(pathname);
  if (gone !== null) return gone;
  if (PAGES.has(pathname)) return { kind: "serve", file: `/legacy${pathname}index.html` };
  // The indexed address has the slash: the bare one goes there, so each page has a single address.
  if (PAGES.has(`${pathname}/`)) return { kind: "redirect", to: `${pathname}/` };
  if (pathname.length > 1 && pathname.endsWith("/")) return { kind: "redirect", to: pathname.replace(/\/+$/, "") || "/" };
  return { kind: "none" };
};
