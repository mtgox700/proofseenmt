/*
 * The profile card, written once for both surfaces (lot c of the redesign, STORYBOARD c.3): the HTML hub inlines
 * PROFILE_CARD_CSS in the public directory, the React company search imports profile-card.css (generated from here,
 * kept in step by test/tokens.test.ts). The markup comes from one function of @proofseen/hub (`profileCardBody`).
 *
 * Reading order, top to bottom: the trace line (reference and date, the file number), identity, context, dated
 * availability, the card's register (verified facts, each on a green square), what is declared (ruled tags), then the
 * foot. The rule of green: `--ps-proof` touches the squares of verified facts and the legend key that names them, and
 * nothing else. No score, no rank, no glow. Nothing hidden, no colour typed, hover only where hover exists.
 */

const LEGEND = [
  ".ps-legend{list-style:none;margin:var(--ps-space-5) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:var(--ps-space-2) var(--ps-space-5);" +
    "font:var(--ps-weight-mono) var(--ps-step--2)/1.45 var(--ps-font-mono);color:var(--ps-muted)}",
  ".ps-legend li{display:inline-flex;align-items:center;gap:var(--ps-space-2)}",
  // The two keys of the register: a filled square for what a third party verified, a ruled one for what is declared.
  ".ps-legend li::before,.fc-proof li::before,.fc-none::before{content:\"\";flex:none;box-sizing:border-box;width:8px;height:8px}",
  ".ps-legend .k-proof::before,.fc-proof li::before{background:var(--ps-proof)}",
  ".ps-legend .k-decl::before,.fc-none::before{border:1px solid var(--ps-line-strong)}",
];

const CARD = [
  ".fiche-card{position:relative;flex:1 1 auto;display:flex;flex-direction:column;gap:var(--ps-space-3);height:100%;min-width:0;margin:0;" +
    "padding:var(--ps-space-4) var(--ps-space-5);background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:var(--ps-radius);" +
    "transition:border-color var(--ps-dur-ui) var(--ps-ease-out)}",
  // React wraps the shared markup in one element: it must not change the layout of the card.
  ".fc-body{display:contents}",
  ".fiche-card p{margin:0}",
  ".fc-trace{padding-bottom:var(--ps-space-3);border-bottom:1px dashed var(--ps-line);font:var(--ps-weight-mono) var(--ps-step--2)/1.45 var(--ps-font-mono);" +
    "letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted);overflow-wrap:anywhere}",
  ".fc-id{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--ps-space-3);align-items:center}",
  // A photo is an identity photo (4 px radius, as on the profile); a monogram is set in the trace face, never a face.
  ".fc-avatar{width:56px;height:56px;display:grid;place-items:center;object-fit:cover;border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);" +
    "background:var(--ps-raised);color:var(--ps-muted);font:var(--ps-weight-mono) var(--ps-step--1)/1 var(--ps-font-mono);letter-spacing:var(--ps-track-label)}",
  ".fc-name{margin:0;font:var(--ps-weight-display) var(--ps-step-1)/var(--ps-lead-1) var(--ps-font-display);letter-spacing:var(--ps-track-1);overflow-wrap:anywhere}",
  ".fc-name a{color:inherit;text-decoration:none}",
  // One stop per card: the name's link covers the whole card; its focus ring is drawn around the card.
  ".fc-name a::after{content:\"\";position:absolute;inset:0;border-radius:var(--ps-radius)}",
  ".fc-name a:focus-visible{outline:none}.fc-name a:focus-visible::after{outline:var(--ps-ring) solid var(--ps-focus);outline-offset:2px}",
  ".fc-role{margin-top:var(--ps-space-1);font-size:var(--ps-step--1);line-height:1.45;color:var(--ps-text);overflow-wrap:anywhere}",
  ".fc-ctx{display:flex;flex-wrap:wrap;gap:var(--ps-space-1) var(--ps-space-4);font-size:var(--ps-step--1);color:var(--ps-muted)}",
  ".fc-ctx b{color:var(--ps-text);font-weight:var(--ps-weight-strong)}",
  // Availability is a declaration: ink, never green. Past 30 days without a confirmation it says so, in amber and words.
  ".fc-avail{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--ps-space-2);font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted)}",
  ".fc-state{color:var(--ps-text)}.fc-state.off{color:var(--ps-muted)}.fc-state.stale{color:var(--ps-signal)}",
  ".fc-proof,.fc-none{padding-top:var(--ps-space-3);border-top:1px solid var(--ps-line)}",
  ".fc-proof{list-style:none;margin:0;padding-left:0;display:grid;gap:var(--ps-space-1);font-size:var(--ps-step--1);line-height:1.4;color:var(--ps-text)}",
  ".fc-proof li,.fc-none{display:flex;align-items:flex-start;gap:var(--ps-space-2)}",
  ".fc-proof li::before{margin-top:.42em}",
  ".fc-none{font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted)}.fc-none::before{margin-top:.45em}",
  ".fc-decl{display:grid;gap:var(--ps-space-2)}",
  ".fc-tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--ps-space-1)}",
  ".fc-tags li{padding:var(--ps-space-1) var(--ps-space-2);border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);" +
    "font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-text);overflow-wrap:anywhere}",
  ".fc-tags li.plus{border-style:dashed;color:var(--ps-muted)}",
  ".fc-langs{font-size:var(--ps-step--2);line-height:1.45;color:var(--ps-muted)}",
  ".fc-foot,.fc-actions{margin-top:auto;padding-top:var(--ps-space-3);border-top:1px solid var(--ps-line)}",
  ".fc-foot{display:flex;justify-content:flex-end;font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono)}",
  ".fc-go{color:var(--ps-text);text-decoration:none;white-space:nowrap}",
  // Actions of the connected search (contact, add to a list) sit above the card's link layer.
  ".fc-actions{position:relative;z-index:1;display:flex;flex-wrap:wrap;align-items:center;gap:var(--ps-space-2)}",
  ".fiche-card:focus-within{border-color:var(--ps-line-strong)}",
  "@media (hover:hover) and (pointer:fine){.fiche-card:hover{border-color:var(--ps-line-strong)}.fc-name a:hover{text-decoration:underline}}",
  "@media (prefers-reduced-motion:reduce){.fiche-card{transition:none}}",
];

export const PROFILE_CARD_CSS = [...LEGEND, ...CARD].join("\n");

export const renderProfileCardCss = (): string =>
  ["/* Generated from packages/brand/src/profile-card.ts: do not edit by hand. */", PROFILE_CARD_CSS, ""].join("\n");
