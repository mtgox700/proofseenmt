import { CHROME_CSS, renderTokensCss } from "@proofseen/brand";

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Every user-provided string goes through this before reaching HTML. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** JSON safe to embed in a <script type="application/ld+json"> block (no "</script>" break-out). */
export const safeJsonLd = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

/**
 * The inline CSS of every public page: the brand tokens and the shared chrome of @proofseen/brand (one source with the
 * React pages: same palette, same scale, same button, same radius), then the reading rules of the hub. One display
 * font, preloaded; body text in the system font. Zero JavaScript. Hard rule (tested): nothing is ever hidden, no
 * display:none, no zero opacity, no zero font size, so what a visitor reads is exactly what a crawler reads.
 */
const BASE_STYLES = `
*,*::before,*::after{box-sizing:border-box}
a{color:inherit;text-underline-offset:.2em;text-decoration-thickness:1px}
.wrap{width:min(100% - 2*var(--ps-gutter),58rem);margin-inline:auto}
main{padding-block:var(--ps-space-7) var(--ps-space-8)}
h1,h2,h3{font-family:var(--ps-font-display);font-weight:var(--ps-weight-display);margin:0;text-wrap:balance}
h1{font-size:var(--ps-step-5);line-height:var(--ps-lead-5);letter-spacing:var(--ps-track-5)}
h2{display:flex;align-items:center;gap:var(--ps-space-3);margin:var(--ps-space-8) 0 var(--ps-space-5);font:var(--ps-weight-mono) var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}
h2::before{content:"";width:1rem;height:.6rem;border-inline:2px solid currentColor;background:linear-gradient(currentColor,currentColor) center/100% 1px no-repeat}
h3{font-size:var(--ps-step-1);line-height:var(--ps-lead-1);letter-spacing:var(--ps-track-1)}
p{margin:0;text-wrap:pretty}
.muted{color:var(--ps-muted)}
.status{display:inline-flex;align-items:center;gap:var(--ps-space-2);margin-bottom:var(--ps-space-5);padding:var(--ps-space-1) var(--ps-space-3);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);font:var(--ps-weight-mono) var(--ps-step--1)/1.2 var(--ps-font-mono);color:var(--ps-text)}
.status i{width:.5rem;height:.5rem;border-radius:50%;background:currentColor}
.status.off{color:var(--ps-signal);border-color:currentColor}
.headline{margin-top:var(--ps-space-4);font-size:var(--ps-step-1);line-height:var(--ps-lead-1);max-width:40rem}
.meta{margin-top:var(--ps-space-2);color:var(--ps-muted)}
.keys{display:flex;flex-wrap:wrap;gap:var(--ps-space-2) var(--ps-space-6);margin-top:var(--ps-space-6);padding-top:var(--ps-space-4);border-top:1px solid var(--ps-line);color:var(--ps-muted);font-size:var(--ps-step--1)}
.keys p:first-child{color:var(--ps-text)}
.cta{margin-top:var(--ps-space-6)}
.lede{font-size:var(--ps-step-1);line-height:1.55;max-width:44rem}
ul.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--ps-space-2)}
ul.tags li{border:1px solid var(--ps-line);border-radius:var(--ps-radius);padding:var(--ps-space-1) var(--ps-space-3);background:var(--ps-surface);font:var(--ps-weight-mono) var(--ps-step--1)/1.3 var(--ps-font-mono)}
.missions{list-style:none;margin:0;padding:0;display:grid;gap:var(--ps-space-4)}
.card{display:grid;gap:var(--ps-space-2);background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:var(--ps-radius);padding:var(--ps-space-5);transition:border-color var(--ps-dur-ui) var(--ps-ease-out)}
.card h3 a{text-decoration:none}
.card .when{font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-muted)}
.card .lead{display:flex;align-items:baseline;gap:var(--ps-space-2);flex-wrap:wrap;margin-top:var(--ps-space-1);padding-top:var(--ps-space-3);border-top:1px solid var(--ps-line)}
.card .lead b{font:var(--ps-weight-display) var(--ps-step-2)/1 var(--ps-font-display)}
.card .lead span{color:var(--ps-muted);font-size:var(--ps-step--1)}
.links{list-style:none;margin:0;padding:0;border-top:1px solid var(--ps-line)}
.links li{border-bottom:1px solid var(--ps-line)}
.links a{display:flex;justify-content:space-between;align-items:center;gap:var(--ps-space-4);min-height:2.75rem;padding:var(--ps-space-3) 0;text-decoration:none}
.links a::after{content:"→";color:var(--ps-muted)}
.crumb{font:var(--ps-weight-mono) var(--ps-step--1)/1.3 var(--ps-font-mono);color:var(--ps-muted);text-decoration:none}
.title{margin-top:var(--ps-space-5);font-size:var(--ps-step-4);line-height:var(--ps-lead-4);letter-spacing:var(--ps-track-4)}
.proof{color:var(--ps-proof)!important}
.byline{margin-top:var(--ps-space-3);color:var(--ps-muted)}
.context{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:1px;margin:var(--ps-space-6) 0 var(--ps-space-5);background:var(--ps-line);border:1px solid var(--ps-line);border-radius:var(--ps-radius);overflow:hidden}
.context div{background:var(--ps-surface);padding:var(--ps-space-3) var(--ps-space-4)}
.context dt{font:var(--ps-weight-mono) var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}
.context dd{margin:var(--ps-space-1) 0 0}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:var(--ps-space-4);margin:0}
.fact{display:grid;align-content:start;gap:var(--ps-space-2);background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:var(--ps-radius);padding:var(--ps-space-5)}
.fact dd{margin:0}
.fact .v{order:-1;font:var(--ps-weight-display-light) var(--ps-step-3)/1 var(--ps-font-display);letter-spacing:var(--ps-track-3);font-variant-numeric:tabular-nums}
.fact dt{font-weight:var(--ps-weight-strong)}
.fact .src{margin-top:var(--ps-space-2);padding-top:var(--ps-space-2);border-top:1px dashed var(--ps-line);font:var(--ps-weight-mono) var(--ps-step--2)/1.4 var(--ps-font-mono);color:var(--ps-muted)}
.more{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:var(--ps-space-3);list-style:none;margin:0;padding:0}
.more a{display:block;height:100%;padding:var(--ps-space-4);border:1px solid var(--ps-line);border-radius:var(--ps-radius);text-decoration:none;background:var(--ps-surface)}
.more small{display:block;margin-top:var(--ps-space-1);color:var(--ps-muted);font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono)}
@media (hover:hover) and (pointer:fine){.card:hover,.more a:hover{border-color:var(--ps-line-strong)}.card h3 a:hover,.links a:hover{text-decoration:underline}.crumb:hover{color:var(--ps-text)}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

/** Every public page of the marketplace (served next to /fonts/ and /brand/): tokens, chrome, reading rules. */
export const STYLES = `${renderTokensCss({ themeAttributes: false })}${CHROME_CSS}${BASE_STYLES}`;

/** The static site of `hub:build` (published on its own domain, without /fonts/): the same, on the calibrated fallbacks. */
export const STANDALONE_STYLES = `${renderTokensCss({ themeAttributes: false, webFonts: false })}${CHROME_CSS}${BASE_STYLES}`;
