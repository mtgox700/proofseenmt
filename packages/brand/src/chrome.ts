/*
 * The chrome of every Proofseen page, written once for both surfaces: the React app imports chrome.css (generated from
 * here, kept in step by test/tokens.test.ts) and the HTML hub inlines CHROME_CSS. Page body, focus, skip link, header,
 * footer and buttons: the same button and the same radius whether a page is React or plain HTML.
 *
 * Constraints of the hub hold here too (tested on its output): nothing is hidden (no display:none, no zero opacity,
 * no zero font size), no script is needed, and every colour is a token. Hover styles exist only where hover exists.
 */

const BASE = [
  "html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}",
  "body{margin:0;min-height:100dvh;background:var(--ps-bg);color:var(--ps-text);font:var(--ps-weight-text) var(--ps-step-0)/var(--ps-lead-0) var(--ps-font-text)}",
  ":focus-visible{outline:var(--ps-ring) solid var(--ps-focus);outline-offset:2px}",
  "::selection{background:var(--ps-text);color:var(--ps-bg)}",
  "a,button,summary,label,[role=button]{touch-action:manipulation}",
  // iOS zooms into any field under 16 px and never zooms back: the floor is 16 px whatever the scale says.
  "input,select,textarea{font-size:max(16px,var(--ps-step-0))}",
];

// Off the top until focused: a translation, never a hidden state, so the hub rule (nothing hidden) still holds.
const SKIP = [
  ".skip{position:absolute;left:var(--ps-gutter);top:var(--ps-space-2);z-index:var(--ps-z-skip);padding:var(--ps-space-3) var(--ps-space-4);" +
    "background:var(--ps-text);color:var(--ps-bg);border-radius:var(--ps-radius);font-weight:var(--ps-weight-strong);text-decoration:none;transform:translateY(-200%)}",
  ".skip:focus{transform:none}",
];

const BUTTONS = [
  ".btn,.cta{display:inline-flex;align-items:center;justify-content:center;gap:var(--ps-space-2);min-height:2.75rem;padding:0 var(--ps-space-4);" +
    "border:var(--ps-border) solid var(--ps-line-strong);border-radius:var(--ps-radius);background:transparent;color:var(--ps-text);" +
    "font:var(--ps-weight-strong) var(--ps-step--1)/1 var(--ps-font-text);text-decoration:none;white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;" +
    "transition:transform var(--ps-dur-press) var(--ps-ease-out),background-color var(--ps-dur-ui) var(--ps-ease-out),border-color var(--ps-dur-ui) var(--ps-ease-out),color var(--ps-dur-ui) var(--ps-ease-out)}",
  ".btn:active:not(:disabled),.cta:active{transform:scale(.97)}",
  // The call to action is paper on ink: the strongest contrast, and the green stays for what is verified.
  ".btn-primary,.cta{background:var(--ps-text);border-color:var(--ps-text);color:var(--ps-bg)}",
  ".btn:disabled,.btn[aria-disabled=true]{cursor:not-allowed;border-style:dashed;background:transparent;color:var(--ps-muted);border-color:var(--ps-line-strong)}",
  "@media (hover:hover) and (pointer:fine){.btn:hover:not(:disabled){border-color:var(--ps-text)}" +
    ".btn-primary:hover:not(:disabled),.cta:hover{background:var(--ps-muted);border-color:var(--ps-muted)}}",
];

/*
 * Header: the lockup, the public menu, the sign-up button, the other language. On a phone the menu is a second row
 * that scrolls sideways: every link stays in the page, reachable by touch and keyboard, without script or toggle.
 */
const HEADER = [
  ".chrome{width:min(100% - 2*var(--ps-gutter),var(--ps-max));margin-inline:auto}",
  ".top{position:relative;z-index:var(--ps-z-header);background:var(--ps-bg);border-bottom:var(--ps-border) solid var(--ps-line);" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)}",
  ".top .chrome{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:\"brand signup\" \"nav lang\";align-items:center;column-gap:var(--ps-space-3)}",
  ".top.bare .chrome{grid-template-areas:\"brand lang\"}",
  ".brand{grid-area:brand;justify-self:start;display:inline-flex;align-items:center;min-height:3.5rem;text-decoration:none}",
  ".brand img{display:block;width:auto;height:1.5rem}",
  ".top .signup{grid-area:signup}",
  ".nav{grid-area:nav;display:flex;align-items:center;gap:var(--ps-space-1);min-width:0;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;" +
    "margin-left:calc(-1*var(--ps-space-3));font-size:var(--ps-step--1)}",
  ".nav::-webkit-scrollbar{width:0;height:0}",
  ".nav a{display:inline-flex;align-items:center;min-height:2.75rem;padding-inline:var(--ps-space-3);color:var(--ps-muted);text-decoration:none;white-space:nowrap}",
  ".nav a[aria-current]{color:var(--ps-text);text-decoration:underline;text-decoration-thickness:var(--ps-ring);text-underline-offset:.5em}",
  ".nav a:focus-visible{outline-offset:-2px}",
  ".lang{grid-area:lang;display:inline-flex;align-items:center;min-height:2.75rem;padding-inline:var(--ps-space-3);color:var(--ps-muted);" +
    "font:var(--ps-weight-mono) var(--ps-step--2)/1 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;text-decoration:none}",
  "@media (hover:hover) and (pointer:fine){.nav a:hover,.lang:hover{color:var(--ps-text)}}",
  "@media (min-width:64rem){.top{position:sticky;top:0}" +
    ".top .chrome{grid-template-columns:auto minmax(0,1fr) auto auto;grid-template-areas:\"brand nav signup lang\";min-height:4rem}" +
    ".top.bare .chrome{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:\"brand lang\"}" +
    ".nav{overflow:visible;margin-left:var(--ps-space-5)}}",
];

const FOOTER = [
  ".foot{margin-top:var(--ps-space-8);border-top:var(--ps-border) solid var(--ps-line);color:var(--ps-muted);font-size:var(--ps-step--1);line-height:var(--ps-lead--1);" +
    "padding:var(--ps-space-7) env(safe-area-inset-right) calc(var(--ps-space-7) + env(safe-area-inset-bottom)) env(safe-area-inset-left)}",
  ".foot .chrome{display:grid;gap:var(--ps-space-4)}",
  ".foot .brand{grid-area:auto;min-height:2.75rem;margin:0}.foot .brand img{height:1.25rem}",
  ".foot nav{display:flex;flex-wrap:wrap;align-items:center;column-gap:var(--ps-space-3)}",
  ".foot nav a{display:inline-flex;align-items:center;min-height:2.75rem;color:var(--ps-text);text-underline-offset:.2em}",
  ".foot p{margin:0;max-width:var(--ps-measure)}",
];

export const CHROME_CSS = [...BASE, ...SKIP, ...BUTTONS, ...HEADER, ...FOOTER].join("\n");

export const renderChromeCss = (): string =>
  ["/* Generated from packages/brand/src/chrome.ts: do not edit by hand. */", CHROME_CSS, ""].join("\n");

/** The lockup files of the header and footer, one per theme, and their size at 24 px high (no layout shift). */
export const LOCKUP = {
  dark: "/brand/ps-lockup-dark.svg",
  light: "/brand/ps-lockup-light.svg",
  /** viewBox 558.46 x 107.2: 24 px high is 125 px wide. */
  width: 125,
  height: 24,
} as const;

/** The share card of each language (1200 x 630), for og:image and twitter:card, with the sentence it shows. */
export const SHARE_CARD = {
  fr: { src: "/brand/og-fr.png", alt: "Proofseen : la preuve de ce qu’un freelance a vraiment livré" },
  en: { src: "/brand/og-en.png", alt: "Proofseen: proof of what a freelancer actually shipped" },
  width: 1200,
  height: 630,
} as const;

/** The poincon, small master (16 to 48 px), on a 32 unit grid: the path of favicon.svg, for pages that inline it. */
export const MONOGRAM_SMALL_PATH =
  "M6 0H26A6 6 0 0 0 32 6V26A6 6 0 0 0 26 32H6A6 6 0 0 0 0 26V6A6 6 0 0 0 6 0ZM8 6H18A6 6 0 0 1 24 12A6 6 0 0 1 18 18H16V24H20V26H8V24H10V8H8ZM16 10H18A2 2 0 0 1 20 12A2 2 0 0 1 18 14H16Z";

/** Icons declared in every page head. */
export const ICONS = {
  svg: "/brand/favicon.svg",
  ico: "/brand/favicon.ico",
  apple: "/brand/apple-touch-icon.png",
  any192: "/brand/icon-192.png",
  any512: "/brand/icon-512.png",
  maskable192: "/brand/maskable-192.png",
  maskable512: "/brand/maskable-512.png",
} as const;
