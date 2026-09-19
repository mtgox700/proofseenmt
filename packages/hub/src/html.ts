const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Every user-provided string goes through this before reaching HTML. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** JSON safe to embed in a <script type="application/ld+json"> block (no "</script>" break-out). */
export const safeJsonLd = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

/**
 * Inline, tokenised CSS: the "salle de mesure" palette of Proofseen (foundations/DESIGN_WEB.md §5). System fonts only:
 * zero network request, zero JavaScript. Hard rule (tested): nothing is ever hidden — no display:none, no zero opacity,
 * no zero font size — so what a visitor reads is exactly what a crawler reads.
 */
export const STYLES = `
:root{--bg:#070b14;--raised:#0a111f;--surface:#0e1626;--ink:#edf1f7;--muted:#a3aec2;--line:#1f2a40;--strong:#7c8aa8;--accent:#3fcf9c;--on-accent:#06110c;--warn:#f5a524;--focus:#8ab0ff;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
--ease:cubic-bezier(.2,0,0,1);color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:radial-gradient(56rem 30rem at 85% -6rem,color-mix(in srgb,var(--accent) 13%,transparent),transparent 70%),var(--bg);color:var(--ink);font:1.0625rem/1.65 var(--sans)}
a{color:inherit;text-underline-offset:.2em;text-decoration-thickness:1px}
a:focus-visible{outline:2px solid var(--focus);outline-offset:3px;border-radius:4px}
::selection{background:var(--accent);color:var(--on-accent)}
.wrap{width:min(100% - 2rem,58rem);margin-inline:auto}
.top{border-bottom:1px solid var(--line)}
.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:1rem;min-height:3.5rem;font-size:.9rem}
.top .me{font:600 1.05rem/1 var(--serif);text-decoration:none}
.top .lang{color:var(--muted);border:1px solid var(--strong);border-radius:999px;padding:.25rem .75rem;text-decoration:none}
main{padding-block:clamp(2.5rem,8vh,5rem) 4rem}
h1,h2,h3{font-family:var(--serif);font-weight:600;letter-spacing:-.015em;margin:0;text-wrap:balance}
h1{font-size:clamp(2.6rem,1.6rem + 4.5vw,4.6rem);line-height:1}
h2{display:flex;align-items:center;gap:.65rem;margin:4rem 0 1.4rem;font:500 .8rem/1.2 var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
h2::before{content:"";width:1rem;height:.6rem;border-inline:2px solid currentColor;background:linear-gradient(currentColor,currentColor) center/100% 1px no-repeat}
h3{font-size:1.35rem;line-height:1.25}
p{margin:0;text-wrap:pretty}
.muted{color:var(--muted)}
.status{display:inline-flex;align-items:center;gap:.55rem;margin-bottom:1.4rem;padding:.35rem .8rem;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:999px;font:500 .85rem/1.2 var(--mono);color:var(--accent)}
.status i{width:.55rem;height:.55rem;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px color-mix(in srgb,currentColor 22%,transparent)}
.status.off{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,var(--line))}
.headline{margin-top:1rem;font-size:clamp(1.15rem,1rem + .6vw,1.45rem);line-height:1.45;max-width:40rem}
.meta{margin-top:.6rem;color:var(--muted)}
.keys{display:flex;flex-wrap:wrap;gap:.6rem 1.8rem;margin-top:1.8rem;padding-top:1.2rem;border-top:1px solid var(--line);color:var(--muted);font-size:.95rem}
.keys p:first-child{color:var(--ink)}
.cta{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.8rem;padding:.8rem 1.25rem;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:600;text-decoration:none;box-shadow:0 10px 36px -14px color-mix(in srgb,var(--accent) 60%,transparent)}
.lede{font-size:1.15rem;line-height:1.7;max-width:44rem}
ul.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5rem}
ul.tags li{border:1px solid var(--line);border-radius:8px;padding:.3rem .7rem;background:var(--surface);font:500 .85rem/1.3 var(--mono)}
.missions{list-style:none;margin:0;padding:0;display:grid;gap:1rem}
.card{display:grid;gap:.6rem;background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 92%,var(--ink)),var(--surface) 45%);border:1px solid var(--line);border-radius:14px;padding:1.3rem 1.4rem;transition:border-color .2s var(--ease),transform .2s var(--ease)}
.card:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));transform:translateY(-2px)}
.card h3 a{text-decoration:none}.card h3 a:hover{text-decoration:underline}
.card .when{font:500 .8rem/1.3 var(--mono);color:var(--muted)}
.card .lead{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;margin-top:.3rem;padding-top:.8rem;border-top:1px solid var(--line)}
.card .lead b{font:600 1.6rem/1 var(--serif);color:var(--accent)}
.card .lead span{color:var(--muted);font-size:.92rem}
.links{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.links li{border-bottom:1px solid var(--line)}
.links a{display:flex;justify-content:space-between;gap:1rem;padding:.85rem 0;text-decoration:none}
.links a::after{content:"→";color:var(--accent)}
.links a:hover{color:var(--accent)}
.crumb{font:500 .85rem/1.3 var(--mono);color:var(--muted);text-decoration:none}
.crumb:hover{color:var(--ink)}
.title{margin-top:1.2rem;font-size:clamp(2rem,1.4rem + 2.6vw,3.2rem);line-height:1.08}
.proof{color:var(--accent)!important}
.byline{margin-top:.8rem;color:var(--muted)}
.context{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:1px;margin:2rem 0 1.6rem;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.context div{background:var(--surface);padding:.9rem 1rem}
.context dt{font:500 .72rem/1.2 var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.context dd{margin:.35rem 0 0}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem;margin:0}
.fact{display:grid;align-content:start;gap:.4rem;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.3rem}
.fact dd{margin:0}
.fact .v{order:-1;font:600 clamp(2rem,1.5rem + 2vw,2.8rem)/1 var(--serif);letter-spacing:-.02em;color:var(--accent);text-shadow:0 0 40px color-mix(in srgb,var(--accent) 35%,transparent)}
.fact dt{font-weight:500}
.fact .src{margin-top:.4rem;padding-top:.6rem;border-top:1px dashed var(--line);font:500 .78rem/1.4 var(--mono);color:var(--muted)}
.more{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:.8rem;list-style:none;margin:0;padding:0}
.more a{display:block;height:100%;padding:1rem 1.1rem;border:1px solid var(--line);border-radius:12px;text-decoration:none;background:var(--raised)}
.more a:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.more small{display:block;margin-top:.3rem;color:var(--muted);font:500 .78rem/1.3 var(--mono)}
.foot{border-top:1px solid var(--line);padding-block:2rem;font-size:.9rem;color:var(--muted)}
.foot .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
