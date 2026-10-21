import { PALETTE, type Palette } from "@proofseen/brand";
import { pwaEn } from "../../i18n/market/pwa-en";
import { pwaFr } from "../../i18n/market/pwa-fr";

/*
 * The page the service worker shows when a page of the connected space cannot be reached (C20). Kept by the service
 * worker at install, so it must stand alone: no script, no external stylesheet, no font, nothing personal. Both
 * languages on one page, since the service worker cannot know which one the person reads.
 *
 * The colours are the brand palette (@proofseen/brand), written into the page: it is shown without the app's
 * stylesheet. Dark by default, light when the system asks for it, as everywhere else.
 */

export const OFFLINE_PATH = "/offline";

const KEYS = ["bg", "surface", "text", "muted", "line"] as const;
const vars = (p: Palette): string => KEYS.map((key) => `--ps-${key}:${p[key]};`).join("");

const STYLE = [
  `:root{${vars(PALETTE.dark)}color-scheme:dark}`,
  `@media (prefers-color-scheme:light){:root{${vars(PALETTE.light)}color-scheme:light}}`,
  "*{box-sizing:border-box}",
  "body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--ps-bg);color:var(--ps-text);font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:24px}",
  "main{max-width:34rem;display:grid;gap:24px}",
  "section{background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:4px;padding:20px}",
  "h1{font-size:1.4rem;margin:0 0 8px}",
  "p{margin:0 0 16px;color:var(--ps-muted)}",
  "a{display:inline-flex;align-items:center;min-height:44px;background:var(--ps-text);color:var(--ps-bg);padding:0 16px;border-radius:4px;text-decoration:none;font-weight:600}",
].join("");

const block = (lang: "fr" | "en", t: typeof pwaFr.offline): string =>
  `<section lang="${lang}"><h1>${t.title}</h1><p>${t.lead}</p><a href="/${lang}/app">${t.retry}</a></section>`;

export const offlinePage = (): string =>
  [
    "<!doctype html>",
    '<html lang="fr"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="robots" content="noindex">',
    '<meta name="color-scheme" content="dark light">',
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${PALETTE.dark.bg}">`,
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${PALETTE.light.bg}">`,
    `<title>Proofseen · ${pwaFr.offline.title} / ${pwaEn.offline.title}</title>`,
    `<style>${STYLE}</style></head>`,
    `<body><main>${block("fr", pwaFr.offline)}${block("en", pwaEn.offline)}</main></body></html>`,
  ].join("");
