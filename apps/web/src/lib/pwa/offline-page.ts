import { pwaEn } from "../../i18n/market/pwa-en";
import { pwaFr } from "../../i18n/market/pwa-fr";

/*
 * The page the service worker shows when a page of the connected space cannot be reached (C20). Kept by the service
 * worker at install, so it must stand alone: no script, no external stylesheet, no font, nothing personal. Both
 * languages on one page, since the service worker cannot know which one the person reads.
 *
 * The colours mirror tokens.css :root (a test keeps them in step): this page is shown without the app's stylesheet.
 */

export const OFFLINE_PATH = "/offline";

const STYLE = [
  ":root{--bg:#070b14;--surface:#0e1626;--ink:#edf1f7;--muted:#a3aec2;--line:#1f2a40;--proof:#3fcf9c;--on-proof:#06110c;color-scheme:dark}",
  "*{box-sizing:border-box}",
  "body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:24px}",
  "main{max-width:34rem;display:grid;gap:24px}",
  "section{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px}",
  "h1{font-size:1.4rem;margin:0 0 8px}",
  "p{margin:0 0 16px;color:var(--muted)}",
  "a{display:inline-block;background:var(--proof);color:var(--on-proof);padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}",
].join("");

const block = (lang: "fr" | "en", t: typeof pwaFr.offline): string =>
  `<section lang="${lang}"><h1>${t.title}</h1><p>${t.lead}</p><a href="/${lang}/app">${t.retry}</a></section>`;

export const offlinePage = (): string =>
  [
    "<!doctype html>",
    '<html lang="fr"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="robots" content="noindex">',
    '<meta name="theme-color" content="#070b14">',
    `<title>Proofseen · ${pwaFr.offline.title} / ${pwaEn.offline.title}</title>`,
    `<style>${STYLE}</style></head>`,
    `<body><main>${block("fr", pwaFr.offline)}${block("en", pwaEn.offline)}</main></body></html>`,
  ].join("");
