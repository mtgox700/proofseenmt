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

export type LegacyRoute = { readonly kind: "serve"; readonly file: string } | { readonly kind: "redirect"; readonly to: string } | { readonly kind: "none" };

export const legacyRoute = (pathname: string): LegacyRoute => {
  const file = FILES[pathname];
  if (file !== undefined) return { kind: "serve", file };
  if (PAGES.has(pathname)) return { kind: "serve", file: `/legacy${pathname}index.html` };
  // The indexed address has the slash: the bare one goes there, so each page has a single address.
  if (PAGES.has(`${pathname}/`)) return { kind: "redirect", to: `${pathname}/` };
  if (pathname.length > 1 && pathname.endsWith("/")) return { kind: "redirect", to: pathname.replace(/\/+$/, "") || "/" };
  return { kind: "none" };
};
