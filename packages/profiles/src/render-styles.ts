/*
 * The page rules of the former static site's pages (profile, entry list, contact, method), on top of the hub's public
 * styles (`PUBLIC_STYLES`: brand tokens, header, footer, reading rules). Brand tokens only, no colour written here
 * (Kensa review, B3: these pages were still in the old night blue and mint). No green: these pages carry no verified
 * fact of a third party, so nothing earns the brand's proof colour. Nothing hidden, hover only where hover exists.
 */
export const STYLES = [
  ".crumbs ol{list-style:none;margin:0 0 var(--ps-space-4);padding:0;display:flex;flex-wrap:wrap;column-gap:var(--ps-space-2);font:var(--ps-weight-mono) var(--ps-step--1)/1.4 var(--ps-font-mono);color:var(--ps-muted)}",
  ".crumbs li{display:inline-flex;align-items:center;min-height:2.75rem}",
  '.crumbs li+li::before{content:"/";margin-right:var(--ps-space-2);color:var(--ps-faint)}',
  ".crumbs a{display:inline-flex;align-items:center;min-height:2.75rem;text-decoration:none}",
  ".eyebrow{margin-bottom:var(--ps-space-3);font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}",
  ".headline{color:var(--ps-muted)}",
  ".lede{max-width:var(--ps-measure)}",
  "ul.tags a{display:inline-flex;align-items:center;min-height:2.75rem;margin:calc(-1*var(--ps-space-1)) calc(-1*var(--ps-space-3));padding:0 var(--ps-space-3);text-decoration:none;overflow-wrap:anywhere}",
  ".tags.ids{margin-top:var(--ps-space-4)}",
  ".ghost{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;color:var(--ps-muted);font-size:var(--ps-step--1)}",
  // The profile: header, then the panel (the decision), then the details; a rail from 60rem.
  '.profile{display:grid;gap:var(--ps-space-6);grid-template-columns:minmax(0,1fr);grid-template-areas:"head" "aside" "main"}',
  ".profile>header{grid-area:head}.profile>aside{grid-area:aside}.profile>.content{grid-area:main;min-width:0}",
  ".panel{display:grid;gap:var(--ps-space-4);padding:var(--ps-space-5);background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:var(--ps-radius)}",
  ".panel .status{margin:0;justify-self:start}",
  ".panel .cta{width:100%}",
  ".panel dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ps-space-4);margin:0}",
  ".panel dt,.band dt{font:var(--ps-weight-mono) var(--ps-step--2)/1.2 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}",
  ".panel dd{margin:var(--ps-space-1) 0 0;font-weight:var(--ps-weight-strong)}",
  ".trust{padding-top:var(--ps-space-4);border-top:1px solid var(--ps-line);font:var(--ps-weight-mono) var(--ps-step--2)/1.6 var(--ps-font-mono);color:var(--ps-muted)}",
  ".trust strong{color:var(--ps-text);font-weight:var(--ps-weight-strong)}",
  '@media (min-width:60rem){.profile{grid-template-columns:minmax(0,1fr) 21rem;grid-template-areas:"head aside" "main aside";column-gap:var(--ps-space-8)}.profile>aside .panel{position:sticky;top:calc(4rem + var(--ps-space-5))}}',
  // Entry lists: the figures band, the cards.
  ".band{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr));gap:1px;margin:var(--ps-space-6) 0 var(--ps-space-4);background:var(--ps-line);border:1px solid var(--ps-line);border-radius:var(--ps-radius);overflow:hidden}",
  ".band div{background:var(--ps-surface);padding:var(--ps-space-4)}",
  ".band dd{margin:var(--ps-space-2) 0 0;font:var(--ps-weight-display) var(--ps-step-3)/1 var(--ps-font-display);letter-spacing:var(--ps-track-3);font-variant-numeric:tabular-nums}",
  ".trustline{font:var(--ps-weight-mono) var(--ps-step--1)/1.5 var(--ps-font-mono);color:var(--ps-muted)}",
  ".note-line{margin-bottom:var(--ps-space-4)}",
  ".cards{list-style:none;margin:0;padding:0;display:grid;gap:var(--ps-space-4);grid-template-columns:repeat(auto-fill,minmax(min(100%,21rem),1fr))}",
  ".cards .card{position:relative;align-content:start}",
  '.cards .card h3 a::after{content:"";position:absolute;inset:0;border-radius:var(--ps-radius)}',
  ".card .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ps-space-2) var(--ps-space-3);margin:0;font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);color:var(--ps-muted)}",
  ".card .row .status{margin:0;padding:var(--ps-space-1) var(--ps-space-2)}",
  ".card .rate{color:var(--ps-text)}",
  // A mission, the contact steps, the method's groups.
  ".mission{display:grid;gap:var(--ps-space-3);padding:var(--ps-space-5);background:var(--ps-surface);border:1px solid var(--ps-line);border-radius:var(--ps-radius)}",
  ".mission h3{font-size:var(--ps-step-1);line-height:var(--ps-lead-1)}",
  ".mission .meta{margin:0;font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted)}",
  ".mission p{max-width:var(--ps-measure)}",
  "ul.did{margin:0;padding-left:1.1rem;display:grid;gap:var(--ps-space-1)}",
  "ol.steps{max-width:var(--ps-measure);margin:var(--ps-space-6) 0 0;padding:0;list-style:none;display:grid;gap:1px;background:var(--ps-line);border:1px solid var(--ps-line);border-radius:var(--ps-radius);overflow:hidden;counter-reset:step}",
  "ol.steps li{position:relative;padding:var(--ps-space-4) var(--ps-space-5) var(--ps-space-4) 3.4rem;background:var(--ps-surface);counter-increment:step}",
  "ol.steps li::before{content:counter(step);position:absolute;left:var(--ps-space-4);top:var(--ps-space-4);width:1.5rem;height:1.5rem;display:grid;place-items:center;border:1px solid var(--ps-line-strong);border-radius:50%;font:var(--ps-weight-mono) var(--ps-step--2)/1 var(--ps-font-mono)}",
  ".contact-action{margin-top:var(--ps-space-6)}",
  ".updated{margin-top:var(--ps-space-7);font-size:var(--ps-step--1)}",
  ".wrap:not(.wide) ol.missions{max-width:48rem}",
  ".method-kinds{margin:var(--ps-space-1) 0 0;padding-left:1.1rem;display:grid;gap:var(--ps-space-1)}",
  ".page-note{max-width:var(--ps-measure);margin-top:var(--ps-space-8);padding-top:var(--ps-space-4);border-top:1px solid var(--ps-line);color:var(--ps-muted);font-size:var(--ps-step--1)}",
  ".page-note a,.trust a,.trustline a,.mission .meta a{display:inline-block;padding-block:.375rem}",
].join("\n");
