import { FAVICON } from "./pages";
import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { marketHeader, MENU_STYLES, type Lang, type MenuItem } from "./market-shell";

/*
 * Le cadre commun des pages du blog et des baromètres : un document HTML complet, sans JavaScript (seul le JSON-LD est
 * dans une balise script), une adresse canonique, les alternatives de langue quand elles existent.
 */

export interface FrameOptions {
  readonly lang: Lang;
  readonly title: string;
  readonly description: string;
  /** Adresse canonique absolue. */
  readonly canonical: string;
  /** Les mêmes pages dans chaque langue, quand elles existent. */
  readonly alternates?: Readonly<Partial<Record<Lang, string>>>;
  /** Une page filtrée ou paginée renvoie vers la liste nue et ne demande pas à être indexée. */
  readonly noindex?: boolean;
  readonly jsonLd: unknown;
  /** Lien de l'en-tête vers l'autre langue (chemin). */
  readonly otherHref: string;
  readonly menu?: MenuItem;
  readonly styles?: string;
  readonly extraHead?: readonly string[];
  readonly main: readonly string[];
}

/** Styles partagés : le texte d'un article et les tableaux des baromètres. */
export const READING_STYLES =
  ".prose{max-width:44rem;margin-top:2.4rem}.prose h2{margin:2.6rem 0 1rem}.prose h3{margin:2rem 0 .8rem}" +
  ".prose p,.prose ul,.prose ol,.prose blockquote,.prose pre{margin:0 0 1.1rem}.prose li{margin:.3rem 0}" +
  ".prose code{font:500 .9em/1.4 var(--mono);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:.05rem .35rem}" +
  ".prose pre{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:1rem}" +
  ".prose blockquote{border-left:3px solid var(--accent);padding-left:1rem;color:var(--muted)}" +
  ".prose a{color:var(--accent)}" +
  ".sources{padding-left:1.2rem}.sources li{margin:.45rem 0}.sources a{word-break:break-word}" +
  ".toc{margin-top:1.6rem;padding:1rem 1.2rem;border:1px solid var(--line);border-radius:12px;background:var(--raised)}" +
  ".toc ol{margin:.5rem 0 0;padding-left:1.2rem}" +
  ".chips{display:flex;flex-wrap:wrap;gap:.45rem;margin:.6rem 0 0;padding:0;list-style:none}" +
  ".chips a{display:inline-block;padding:.3rem .8rem;border:1px solid var(--line);border-radius:999px;color:var(--muted);text-decoration:none;font-size:.9rem}" +
  ".chips a[aria-current]{border-color:var(--accent);color:var(--ink)}" +
  ".pager{display:flex;justify-content:space-between;margin-top:2rem}" +
  ".table{width:100%;overflow-x:auto;margin-top:1rem}" +
  "table{width:100%;border-collapse:collapse;font-size:.95rem}" +
  "caption{text-align:left;color:var(--muted);padding-bottom:.6rem}" +
  "th,td{text-align:left;padding:.55rem .6rem;border-bottom:1px solid var(--line)}" +
  "th{font:500 .78rem/1.2 var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}" +
  "td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}" +
  ".note{margin-top:1.2rem;padding:1rem 1.2rem;border:1px dashed var(--strong);border-radius:12px;color:var(--muted)}";

export const renderFrame = (o: FrameOptions): string =>
  [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    `<link rel="icon" href="${FAVICON}">`,
    `<title>${e(o.title)} — Proofseen</title>`,
    `<meta name="description" content="${e(o.description)}">`,
    `<link rel="canonical" href="${e(o.canonical)}">`,
    ...(o.noindex === true ? ['<meta name="robots" content="noindex, follow">'] : []),
    ...Object.entries(o.alternates ?? {}).map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${e(href)}">`),
    ...(o.extraHead ?? []),
    `<style>${STYLES}${MENU_STYLES}${READING_STYLES}${o.styles ?? ""}</style>`,
    `<script type="application/ld+json">${safeJsonLd(o.jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, o.otherHref, o.menu),
    '<main class="wrap">',
    ...o.main,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
