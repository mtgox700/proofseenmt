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
  // v2: the main button lights up instead of greying out. The violet halo is set, never animated (box-shadow is in no
  // transition): one paint on hover or focus, nothing per frame.
  ".btn-primary:focus-visible,.cta:focus-visible{box-shadow:var(--ps-glow-cta)}",
  "@media (hover:hover) and (pointer:fine){.btn:hover:not(:disabled){border-color:var(--ps-text)}" +
    ".btn-primary:hover:not(:disabled),.cta:hover{box-shadow:var(--ps-glow-cta)}}",
];

/*
 * Header: the lockup, the public menu, the sign-up button, the other language. A header without the phone sheet (the
 * `bare` one of the connected space keeps only the brand and the language) still scrolls its menu sideways on a phone.
 */
const HEADER = [
  ".chrome{width:min(100% - 2*var(--ps-gutter),var(--ps-max));margin-inline:auto}",
  ".top{position:relative;z-index:var(--ps-z-header);background:var(--ps-bg);border-bottom:var(--ps-border) solid var(--ps-line);" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)}",
  // Three columns on a phone: the language link takes its own width, not the sign-up button's, and leaves it to the menu.
  ".top .chrome{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:\"brand signup signup\" \"nav nav lang\";align-items:center;column-gap:var(--ps-space-3)}",
  ".top.bare .chrome{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:\"brand lang\"}",
  ".brand{grid-area:brand;justify-self:start;display:inline-flex;align-items:center;min-height:3.5rem;text-decoration:none}",
  ".brand img{display:block;width:auto;height:1.5rem}",
  ".top .signup{grid-area:signup}",
  ".nav{grid-area:nav;display:flex;align-items:center;gap:var(--ps-space-1);min-width:0;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;" +
    "margin-left:calc(-1*var(--ps-space-3));font-size:var(--ps-step--1);" +
    // On a phone the menu scrolls sideways: its right edge fades so the cut reads as "more", and the end padding lets
    // the last link scroll fully out of the fade.
    "padding-inline-end:var(--ps-space-4);-webkit-mask-image:linear-gradient(to right,black calc(100% - var(--ps-space-5)),transparent);" +
    "mask-image:linear-gradient(to right,black calc(100% - var(--ps-space-5)),transparent)}",
  ".nav::-webkit-scrollbar{width:0;height:0}",
  ".nav a{display:inline-flex;align-items:center;min-height:2.75rem;padding-inline:var(--ps-space-3);color:var(--ps-muted);text-decoration:none;white-space:nowrap}",
  ".nav a[aria-current]{color:var(--ps-text);text-decoration:underline;text-decoration-thickness:var(--ps-ring);text-underline-offset:.5em}",
  ".nav a:focus-visible{outline-offset:-2px}",
  ".lang{grid-area:lang;display:inline-flex;align-items:center;min-height:2.75rem;padding-inline:var(--ps-space-3);color:var(--ps-muted);" +
    "font:var(--ps-weight-mono) var(--ps-step--2)/1 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;text-decoration:none}",
  "@media (hover:hover) and (pointer:fine){.nav a:hover,.lang:hover{color:var(--ps-text)}}",
  // Sticky on a wide screen: over a photo or an ambience it keeps 90 % of ink at least (BRAND_BOOK_V2 section 2.2), and
  // blurs what passes under it only where the browser can; anywhere else it stays opaque.
  "@media (min-width:64rem){.top{position:sticky;top:0}" +
    "@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.top{background:var(--ps-header-ink);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}}" +
    ".top .chrome{grid-template-columns:auto minmax(0,1fr) auto auto;grid-template-areas:\"brand nav signup lang\";min-height:4rem}" +
    ".top.bare .chrome{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:\"brand lang\"}" +
    ".nav{overflow:visible;margin-left:var(--ps-space-5);padding-inline-end:0;-webkit-mask-image:none;mask-image:none}}",
];

/*
 * The phone header (STORYBOARD_V2 §2, Kensa M10 and N1), the same on the React pages and on the hub: under 64 rem the
 * row of links gives way to « Se connecter », « Créer un compte » and a menu button, the summary of a native <details>
 * whose sheet lists the public menu and the other language. One copy of the links is shown at a time: the row on a
 * wide screen, the sheet on a phone. No script: an open sheet stretches a transparent layer from its summary over the
 * page, so a click outside it closes it like a click on the button. A phone keeps the lockup's mark only (cropped, not
 * swapped: no second file), so the two actions fit on the row at 375 px.
 */
/**
 * The only rules of the brand that hide something, and what they hide is a copy: the header's links exist twice (the
 * row of a wide screen, the sheet of a phone) and one copy is shown at a time; Safari's disclosure triangle is no
 * text. The tests of « nothing hidden » strip these rules, and only these (`withoutHeaderSwitch`).
 */
export const HEADER_SWITCH_RULES = [
  ".top .signin-m,.top .sheet{display:none}",
  ".top.has-sheet .nav,.top.has-sheet .chrome>.lang{display:none}",
  ".sheet-toggle::-webkit-details-marker{display:none}",
] as const;

/** A page's HTML or CSS without the header switch: what remains must hide nothing. */
export const withoutHeaderSwitch = (text: string): string => HEADER_SWITCH_RULES.reduce((rest, rule) => rest.split(rule).join(""), text);

const [HIDE_SHEET, HIDE_ROW, HIDE_MARKER] = HEADER_SWITCH_RULES;

const SHEET = [
  HIDE_SHEET,
  "@media (max-width:63.99rem){" +
    '.top.has-sheet .chrome{grid-template-columns:minmax(0,1fr) auto auto auto;grid-template-areas:"brand signin signup sheet"}' +
    HIDE_ROW +
    ".top .signin-m{grid-area:signin;display:inline-flex;align-items:center;min-height:2.75rem;padding-inline:var(--ps-space-2);color:var(--ps-text);font-size:var(--ps-step--1);text-decoration:none;white-space:nowrap}" +
    ".top.has-sheet .signup{min-height:2.75rem;padding-inline:var(--ps-space-3)}" +
    ".top .sheet{grid-area:sheet;display:block}" +
    ".sheet-toggle{position:relative;display:grid;place-items:center;width:2.75rem;height:2.75rem;border:var(--ps-border) solid var(--ps-line-strong);border-radius:var(--ps-radius);cursor:pointer;list-style:none}" +
    HIDE_MARKER +
    ".sheet-bars,.sheet-bars::before,.sheet-bars::after{display:block;width:1.1rem;height:2px;border-radius:1px;background:var(--ps-text)}" +
    '.sheet-bars{position:relative}.sheet-bars::before,.sheet-bars::after{content:"";position:absolute;left:0}.sheet-bars::before{top:-6px}.sheet-bars::after{top:6px}' +
    ".sheet[open] .sheet-bars{background:transparent}.sheet[open] .sheet-bars::before{top:0;transform:rotate(45deg)}.sheet[open] .sheet-bars::after{top:0;transform:rotate(-45deg)}" +
    '.sheet[open]>.sheet-toggle::before{content:"";position:fixed;inset:0;cursor:default}' +
    ".sheet-panel{position:absolute;left:0;right:0;top:100%;z-index:var(--ps-z-overlay);display:grid;gap:var(--ps-space-2);padding:var(--ps-space-3) var(--ps-gutter) var(--ps-space-5);" +
    "background:var(--ps-overlay);border-bottom:var(--ps-border) solid var(--ps-line-strong);box-shadow:var(--ps-shadow-2)}" +
    ".sheet-panel nav{display:grid}" +
    ".sheet-panel nav a{display:flex;align-items:center;min-height:3.5rem;border-bottom:var(--ps-border) solid var(--ps-line);color:var(--ps-text);font-size:var(--ps-step-0);text-decoration:none}" +
    ".sheet-panel .lang{grid-area:auto;justify-self:start;min-height:3.5rem;padding-inline:0}}",
  "@media (max-width:30rem){.top.has-sheet .brand img{width:1.5rem;height:1.5rem;object-fit:cover;object-position:left center}}",
  "@media (hover:hover) and (pointer:fine){.sheet-toggle:hover{border-color:var(--ps-text)}}",
];

// The end of the night: the deepest ground under a faint azure light (8 %, under the caps of the ambience).
const FOOTER = [
  ".foot{margin-top:var(--ps-space-8);border-top:var(--ps-border) solid var(--ps-line);background:var(--ps-ambient-deep),var(--ps-bg-deep);color:var(--ps-muted);font-size:var(--ps-step--1);line-height:var(--ps-lead--1);" +
    "padding:var(--ps-space-7) env(safe-area-inset-right) calc(var(--ps-space-7) + env(safe-area-inset-bottom)) env(safe-area-inset-left)}",
  ".foot .chrome{display:grid;gap:var(--ps-space-4)}",
  ".foot .brand{grid-area:auto;min-height:2.75rem;margin:0}.foot .brand img{height:1.25rem}",
  ".foot nav{display:flex;flex-wrap:wrap;align-items:center;column-gap:var(--ps-space-3)}",
  ".foot nav a{display:inline-flex;align-items:center;min-height:2.75rem;color:var(--ps-text);text-underline-offset:.2em}",
  ".foot p{margin:0;max-width:var(--ps-measure)}",
];

export const CHROME_CSS = [...BASE, ...SKIP, ...BUTTONS, ...HEADER, ...SHEET, ...FOOTER].join("\n");

export const renderChromeCss = (): string =>
  ["/* Generated from packages/brand/src/chrome.ts: do not edit by hand. */", CHROME_CSS, ""].join("\n");

/*
 * The lit edge of a card under the pointer (BRAND_BOOK_V2 section 4.2), in CSS only. On hover the 1 px border turns
 * transparent (a transition of border-color, the only thing that moves) and lets two layers drawn under it show: the
 * violet spot of `--ps-edge-spot` over the 3:1 edge. The inside is repainted with `--edge-fill`, the card's own ground
 * (`--ps-surface` unless the card sets it). Without a script the spot sits at the top centre; a page that tracks the
 * pointer moves it through `--spot-x` and `--spot-y`. Only where hover exists; reduced motion changes nothing here.
 */
export const edgeSpotCss = (selectors: readonly string[]): string =>
  `@media (hover:hover) and (pointer:fine){${selectors.map((s) => `${s}:hover`).join(",")}{border-color:transparent;` +
  "background:linear-gradient(var(--edge-fill,var(--ps-surface)),var(--edge-fill,var(--ps-surface))) padding-box," +
  "var(--ps-edge-spot) border-box,linear-gradient(var(--ps-line-strong),var(--ps-line-strong)) border-box}}";

/** The lockup file of the header and footer (paper and green on the night), and its size at 24 px high (no layout shift). */
export const LOCKUP = {
  dark: "/brand/ps-lockup-dark.svg",
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
