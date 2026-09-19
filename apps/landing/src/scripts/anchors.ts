/*
 * Sections use `content-visibility: auto`: the layout of off-screen sections is skipped at load (measured 2026-09-19:
 * about half the style/layout work on emulated mobile). Until rendered, their heights are estimates, so a jump from the
 * header could land off target. On the first in-page navigation we render every section once (a single layout, triggered
 * by the visitor, never at load) and scroll; later clicks are plain native anchors.
 */

const WARM = "cv-warm";

const warm = (): void => document.documentElement.classList.add(WARM);
const warmed = (): boolean => document.documentElement.classList.contains(WARM);

const targetOf = (hash: string): HTMLElement | null => (hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null);

/** Scroll, then hand keyboard focus to the target so the next Tab continues from there (as a native anchor would). */
const go = (target: HTMLElement, behavior: ScrollBehavior): void => {
  warm();
  target.scrollIntoView({ block: "start", behavior }); // forces a synchronous layout: every section now has its real size
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
};

document.addEventListener("click", (event) => {
  if (warmed() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest("a") : null;
  if (link === null || link.origin !== location.origin || link.pathname !== location.pathname) return;
  const target = targetOf(link.hash);
  if (target === null) return;
  event.preventDefault();
  history.pushState(null, "", link.hash);
  go(target, "auto"); // "auto" follows CSS scroll-behavior: smooth, or instant with reduced motion
});

// Deep link (e.g. /#offres): the browser scrolled with estimated heights; correct it once the page has loaded.
const deepLink = (): void => {
  const target = targetOf(location.hash);
  if (target !== null) go(target, "instant");
};
if (document.readyState === "complete") deepLink();
else window.addEventListener("load", deepLink, { once: true });
