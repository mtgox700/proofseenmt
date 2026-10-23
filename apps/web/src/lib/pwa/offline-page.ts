import { MONOGRAM_SMALL_PATH, PALETTE, type Palette } from "@proofseen/brand";
import { pwaEn } from "../../i18n/market/pwa-en";
import { pwaFr } from "../../i18n/market/pwa-fr";

/*
 * The page the service worker shows when a page of the connected space cannot be reached (C20). Kept by the service
 * worker at install, so it must stand alone: no script, no external stylesheet, no font file, no image file, nothing
 * personal. Both languages on one page, since the service worker cannot know which one the person reads.
 *
 * The brand, written into the page: the palette (@proofseen/brand), dark only (BRAND_BOOK_V2);
 * the poinçon in its monochrome version, inline (never green: the green is kept for what is verified); the trace,
 * drawn as a line that stops at a square and resumes dashed, the connection waiting to come back. Titles fall on the
 * same system serifs as the fallback of the display face, labels on the system mono.
 */

export const OFFLINE_PATH = "/offline";

const KEYS = ["bg", "surface", "text", "muted", "faint", "line", "lineStrong", "focus"] as const;
const cssName = (key: (typeof KEYS)[number]): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const vars = (p: Palette): string => KEYS.map((key) => `--ps-${cssName(key)}:${p[key]};`).join("");

const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace";

const STYLE = [
  `:root{${vars(PALETTE.dark)}color-scheme:dark}`,
  "*{box-sizing:border-box}",
  "html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}",
  "body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--ps-bg);color:var(--ps-text);" +
    "font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
    "padding:max(24px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))}",
  "main{width:100%;max-width:34rem;display:grid;gap:20px}",
  ".mark{display:flex;align-items:center;gap:12px;color:var(--ps-text)}",
  ".mark svg{display:block;flex:none}",
  `.label{margin:0;font:500 12px/1.3 ${MONO};letter-spacing:.06em;text-transform:uppercase;color:var(--ps-muted)}`,
  ".trace{display:block;width:100%;height:16px;color:var(--ps-line-strong)}",
  "section{background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:20px;padding:24px;display:grid;gap:12px;justify-items:start}",
  `h1{margin:0;font:600 1.75rem/1.1 ${SERIF};letter-spacing:-.018em}`,
  "p{margin:0;color:var(--ps-muted);max-width:52ch}",
  "a{display:inline-flex;align-items:center;min-height:44px;margin-top:4px;padding:0 16px;border:1px solid var(--ps-text);border-radius:6px;" +
    "background:var(--ps-text);color:var(--ps-bg);font-weight:600;font-size:.9rem;text-decoration:none;touch-action:manipulation;user-select:none;-webkit-user-select:none}",
  "a:active{transform:scale(.97)}",
  "a:focus-visible{outline:2px solid var(--ps-focus);outline-offset:2px}",
  "@media (hover:hover) and (pointer:fine){a:hover{background:var(--ps-muted);border-color:var(--ps-muted)}}",
].join("");

const MARK =
  `<svg viewBox="0 0 32 32" width="28" height="28" role="img" aria-label="Proofseen" focusable="false">` +
  `<path fill="currentColor" fill-rule="evenodd" d="${MONOGRAM_SMALL_PATH}"/></svg>`;

/** The trace: a solid line up to a square, then dashes. Drawn in the strong line colour, decorative. */
const TRACE =
  `<svg class="trace" viewBox="0 0 544 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
  `<path d="M0 8H232" stroke="currentColor" stroke-width="1.5" fill="none"/>` +
  `<rect x="236" y="4" width="8" height="8" fill="currentColor"/>` +
  `<path d="M252 8H544" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 6" fill="none"/></svg>`;

const block = (lang: "fr" | "en", t: typeof pwaFr.offline): string =>
  `<section lang="${lang}"><h1>${t.title}</h1><p>${t.lead}</p><a href="/${lang}/app">${t.retry}</a></section>`;

export const offlinePage = (): string =>
  [
    "<!doctype html>",
    '<html lang="fr"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="robots" content="noindex">',
    '<meta name="color-scheme" content="dark">',
    `<meta name="theme-color" content="${PALETTE.dark.bg}">`,
    `<title>Proofseen · ${pwaFr.offline.title} / ${pwaEn.offline.title}</title>`,
    `<style>${STYLE}</style></head>`,
    "<body><main>",
    `<div class="mark">${MARK}<span class="label" aria-hidden="true">${pwaFr.offline.title} · <span lang="en">${pwaEn.offline.title}</span></span></div>`,
    TRACE,
    `${block("fr", pwaFr.offline)}${block("en", pwaEn.offline)}`,
    "</main></body></html>",
  ].join("");
