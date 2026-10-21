import { FONT_FILES, ICONS, SHARE_CARD, THEME_COLOR } from "@proofseen/brand";
import { escapeHtml as e } from "./html";

/*
 * The head shared by every public page of the marketplace, written once: viewport, both themes and their browser
 * colour, the brand icons, the one preloaded font (PS Display, the face of every h1), and the share card. A change of
 * brand is made here, not in twelve documents. No script: the JSON-LD stays the only <script> of a page.
 */

export type HeadLang = "fr" | "en";

export interface PageHeadOptions {
  readonly lang: HeadLang;
  /** The whole <title>, brand suffix included when there is one. */
  readonly title: string;
  readonly description: string;
  /** Absolute canonical address: the share card is announced on the same origin. */
  readonly canonical: string;
  /** og:type. A profile is "profile", a publication "article". */
  readonly type?: "website" | "article" | "profile";
}

/** The brand suffix of a page title. A middle dot, as in the React pages, never a dash. */
export const withBrand = (title: string): string => `${title} · Proofseen`;

const LOCALE: Readonly<Record<HeadLang, string>> = { fr: "fr_FR", en: "en_GB" };

const originOf = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    // A relative canonical would be a bug upstream; the card then stays site-relative instead of breaking the page.
    return "";
  }
};

export const pageHead = (o: PageHeadOptions): string[] => {
  const card = SHARE_CARD[o.lang];
  const image = `${originOf(o.canonical)}${card.src}`;
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="color-scheme" content="dark light">',
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR.dark}">`,
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR.light}">`,
    `<title>${e(o.title)}</title>`,
    `<meta name="description" content="${e(o.description)}">`,
    `<link rel="canonical" href="${e(o.canonical)}">`,
    `<link rel="preload" href="${FONT_FILES.display}" as="font" type="font/woff2" crossorigin>`,
    `<link rel="icon" href="${ICONS.ico}" sizes="48x48">`,
    `<link rel="icon" href="${ICONS.svg}" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${ICONS.apple}">`,
    `<meta property="og:type" content="${o.type ?? "website"}">`,
    '<meta property="og:site_name" content="Proofseen">',
    `<meta property="og:locale" content="${LOCALE[o.lang]}">`,
    `<meta property="og:title" content="${e(o.title)}">`,
    `<meta property="og:description" content="${e(o.description)}">`,
    `<meta property="og:url" content="${e(o.canonical)}">`,
    `<meta property="og:image" content="${e(image)}">`,
    `<meta property="og:image:width" content="${SHARE_CARD.width}">`,
    `<meta property="og:image:height" content="${SHARE_CARD.height}">`,
    `<meta property="og:image:alt" content="${e(card.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ];
};
