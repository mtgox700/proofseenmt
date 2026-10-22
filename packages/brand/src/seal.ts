/*
 * The poinçon of the interface (BRAND_BOOK sections 6 and 8.1, CONNECTED_PLAN section 2): the dated cartouche that only
 * a fact verified by a third party carries, its line of proof, the trace (source, verifier, date in the trace face), the
 * green square, and the two gestures of the strike. Written once for both surfaces:
 * - the HTML hub assembles these rules into the profile page (`PROFILE_STYLES` of @proofseen/hub), byte for byte what it
 *   emitted before this module existed (held by packages/hub/test/profile-styles.test.ts);
 * - the React connected space imports seal.css, generated from here and kept in step by test/tokens.test.ts.
 *
 * The rule of green: `--ps-proof` touches the cartouche, the square and the line of a verified fact, and nothing else.
 * Nothing starts hidden: the ring of ink rests as a transparent border, and the cartouche is drawn before it strikes.
 */

/** The line of proof under a claim, its trace, and the cartouche with its poinçon corners where `corner-shape` exists. */
export const SEAL_LINE = [
  ".proofline{position:relative;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:var(--ps-space-3) var(--ps-space-5);padding-top:var(--ps-space-4);border-top:1px dashed var(--ps-line)}",
  ".proofline::before{content:\"\";position:absolute;left:calc(.25rem - var(--fil) - 3.5px);top:calc(var(--ps-space-4) + .55rem - 4px);width:8px;height:8px;background:var(--ps-proof)}",
  ".trace{display:grid;gap:var(--ps-space-1);margin:0;font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted)}",
  ".trace div{display:flex;flex-wrap:wrap;gap:0 var(--ps-space-2)}",
  ".trace dt{letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-faint)}",
  ".trace dd{margin:0;color:var(--ps-text);overflow-wrap:anywhere}",
  ".seal{position:relative;display:inline-flex;align-items:center;min-height:2rem;padding:var(--ps-space-1) var(--ps-space-3);border:1px solid var(--ps-proof);border-radius:var(--ps-radius);background:var(--ps-proof-wash);color:var(--ps-proof);font:var(--ps-weight-mono) var(--ps-step--1)/1.35 var(--ps-font-mono)}",
  ".seal::after{content:\"\";position:absolute;inset:-1px;border:1px solid transparent;border-radius:inherit;pointer-events:none}",
  "@supports (corner-shape:scoop){.seal{border-radius:var(--ps-radius-seal);corner-shape:scoop}.seal::after{corner-shape:scoop}}",
] as const;

/** The square of the poinçon (filled: verified; open: a line still to come) and the one-line stamp that carries it. */
export const SEAL_SQUARE = [
  ".sq{flex:none;display:inline-block;width:8px;height:8px;background:var(--ps-proof)}",
  ".sq.open{background:none;border:1px solid var(--ps-line-strong)}",
  ".stamp{display:flex;align-items:baseline;gap:var(--ps-space-2);color:var(--ps-proof);font:var(--ps-weight-mono) var(--ps-step--1)/1.4 var(--ps-font-mono)}",
] as const;

/*
 * The strike and the ink, as proportions of one chronology of 1 020 ms (CONCEPT section 3): the thread is traced (0 to
 * 63 %, 640 ms), the cartouche strikes (63 to 76 %, 140 ms) and comes back (76 to 88 %, 120 ms), the ring of ink spreads
 * (76 to 100 %, 240 ms). Both start from a visible state.
 */
export const SEAL_KEYFRAMES = [
  "@keyframes ps-strike{0%,63%{transform:scale(1.06);animation-timing-function:var(--ps-ease-strike)}76%{transform:scale(.97);animation-timing-function:var(--ps-ease-out)}88%,100%{transform:scale(1)}}",
  "@keyframes ps-ink{0%,76%{transform:scale(1);border-color:var(--ps-proof);animation-timing-function:var(--ps-ease-ink)}100%{transform:scale(1.05,1.45);border-color:transparent}}",
] as const;

/*
 * React only. A cartouche set on its own (an acknowledgement, a line of a file) sits beside its trace. The strike of a
 * real event is played once, by whoever sets `data-strike` (the server for an acknowledgement read from the database,
 * or the island that remembers what a device has already seen): the same keyframes, started 640 ms in, since no thread
 * is traced here, so the cartouche strikes at once. Reduced motion: nothing moves, the cartouche is there.
 */
export const SEAL_REACT = [
  ".sealed{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ps-space-2) var(--ps-space-4);min-width:0}",
  ".sealed .seal{max-width:100%;margin:0}",
  "@media (prefers-reduced-motion:no-preference){.seal[data-strike]{animation:ps-strike 1020ms linear -640ms both}.seal[data-strike]::after{animation:ps-ink 1020ms linear -640ms both}}",
] as const;

export const SEAL_CSS = [...SEAL_LINE, ...SEAL_SQUARE, ...SEAL_KEYFRAMES, ...SEAL_REACT].join("\n");

export const renderSealCss = (): string => ["/* Generated from packages/brand/src/seal.ts: do not edit by hand. */", SEAL_CSS, ""].join("\n");
