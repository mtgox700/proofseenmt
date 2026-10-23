import { AMBIENT_CAP, HEADER_INK, PALETTE, type Palette, rgbA } from "./palette";
import { FONT_STACKS, fontFaceCss, typeScaleCss } from "./type";

/*
 * The single source of the Proofseen design tokens, v2 (BRAND_BOOK_V2). tokens.css is generated from here
 * (`pnpm exec tsx packages/brand/scripts/write-tokens.ts`) and test/tokens.test.ts fails if the two diverge.
 * React imports "@proofseen/brand/tokens.css"; the HTML hub inlines TOKENS_CSS. One palette, one scale, one name set.
 *
 * Dark only: one `:root`, `color-scheme:dark`, no `prefers-color-scheme` branch and no `[data-theme]` switch.
 * Every halo and every ambience is written in rgb() from a palette colour (rgbA), never typed by hand.
 */

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const colours = (p: Palette): string =>
  (Object.keys(p) as (keyof Palette)[]).map((key) => `--ps-${kebab(key)}:${p[key]};`).join("");

const { proof, aura, azur, text, bg } = PALETTE.dark;
const black = "#000000";

/** Depth: the surface steps and a 1 px edge carry elevation; these shadows only separate floating layers. */
const SHADOWS = `--ps-shadow-1:0 1px 0 ${rgbA(black, 0.5)},0 1px 3px ${rgbA(black, 0.4)};--ps-shadow-2:0 18px 48px -16px ${rgbA(black, 0.8)},0 0 0 1px var(--ps-line);`;

/*
 * The glow (BRAND_BOOK_V2 section 4). Green attests: only a verified element and the poinçon wear a proof halo. Violet
 * lights: the main button, the edge of a card under the pointer. A glow is never animated (no transition of
 * box-shadow or filter): it is set, or it sits on a pseudo-element whose opacity moves.
 */
const spot = (hex: string): string =>
  `radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 0%), ${rgbA(hex, 0.7)}, ${rgbA(hex, 0)} 60%)`;

const EDGE_SPOTS = `--ps-edge-spot:${spot(aura)};--ps-edge-spot-proof:${spot(proof)};`;

/*
 * A custom property that reads var() is resolved where it is declared: on :root, a `--spot-x` set on a card would never
 * reach the spot. An element that follows the pointer (a script sets --spot-x and --spot-y on it) carries `data-spot`,
 * and the two spots are declared again there, so they resolve with its own coordinates.
 */
const SPOT_HOST = `:where([data-spot]){${EDGE_SPOTS}}`;

const GLOW = [
  `--ps-glow-proof:0 0 0 1px ${rgbA(proof, 0.55)},0 0 18px -2px ${rgbA(proof, 0.45)},0 0 48px -8px ${rgbA(proof, 0.3)};`,
  `--ps-glow-proof-strike:0 0 0 1px ${rgbA(proof, 0.9)},0 0 28px 2px ${rgbA(proof, 0.55)},0 0 80px -6px ${rgbA(proof, 0.35)};`,
  `--ps-halo-proof:radial-gradient(closest-side, ${rgbA(proof, 0.28)}, ${rgbA(proof, 0)});`,
  `--ps-glow-aura:0 0 0 1px ${rgbA(aura, 0.45)},0 10px 40px -10px ${rgbA(aura, 0.55)};`,
  `--ps-glow-cta:0 0 0 1px ${rgbA(text, 0.9)},0 8px 32px -8px ${rgbA(aura, 0.65)},0 0 64px -16px ${rgbA(aura, 0.5)};`,
  EDGE_SPOTS,
].join("\n");

/*
 * The ambient light, under the caps of BRAND_BOOK_V2 section 2.2: no layer above 18 % aura or 10 % azure, so a text
 * keeps its contrast at the worst point. Three scenes only (hero, the proof, the exit), the deep one for the footer.
 */
const AMBIENT = [
  "--ps-ambient-hero:" +
    `radial-gradient(60% 55% at 18% 6%, ${rgbA(aura, AMBIENT_CAP.aura)}, ${rgbA(aura, 0)} 70%),` +
    `radial-gradient(45% 45% at 88% 16%, ${rgbA(azur, AMBIENT_CAP.azur)}, ${rgbA(azur, 0)} 72%),` +
    `radial-gradient(70% 60% at 50% 115%, ${rgbA(aura, 0.1)}, ${rgbA(aura, 0)} 70%);`,
  `--ps-ambient-section:radial-gradient(55% 60% at 50% 0%, ${rgbA(aura, 0.12)}, ${rgbA(aura, 0)} 70%);`,
  `--ps-ambient-deep:radial-gradient(80% 70% at 50% 100%, ${rgbA(azur, 0.08)}, ${rgbA(azur, 0)} 70%);`,
  // The sticky header over a photo or an ambience: never less than 90 % of ink (section 2.2).
  `--ps-header-ink:${rgbA(bg, HEADER_INK)};`,
].join("\n");

const FOUNDATION = [
  `--ps-font-display:${FONT_STACKS.display};`,
  `--ps-font-text:${FONT_STACKS.text};`,
  `--ps-font-mono:${FONT_STACKS.mono};`,
  "--ps-weight-display:600;--ps-weight-display-light:420;--ps-weight-text:400;--ps-weight-strong:600;--ps-weight-mono:500;",
  "--ps-track-label:.06em;",
  typeScaleCss(),
  // Space: a 4 px base, and the breath between two sections (96 px on a phone, 176 px at 1440).
  "--ps-space-1:.25rem;--ps-space-2:.5rem;--ps-space-3:.75rem;--ps-space-4:1rem;--ps-space-5:1.5rem;",
  "--ps-space-6:2rem;--ps-space-7:3rem;--ps-space-8:4rem;--ps-space-9:6rem;--ps-space-10:8rem;",
  "--ps-section-y:clamp(6rem, 4.2rem + 7.7vw, 11rem);",
  // Grid: 12 columns, 76 rem wide, a fluid gutter, a 66 character measure for prose.
  "--ps-max:76rem;--ps-columns:12;--ps-gutter:clamp(1rem, .6479rem + 1.5023vw, 2rem);--ps-measure:66ch;",
  // Shape: 6 px for controls, 20 px for cards, 16 px for photos, the pill for filters and skill chips only. The scooped
  // seal corner stays reserved for what is verified.
  "--ps-radius:6px;--ps-radius-card:20px;--ps-radius-media:16px;--ps-radius-pill:999px;--ps-radius-seal:10px;--ps-border:1px;--ps-ring:2px;",
  // Motion: named for what they do. See BRAND_BOOK.md section 7 and BRAND_BOOK_V2 section 8.
  "--ps-ease-out:cubic-bezier(.16,1,.3,1);--ps-ease-in-out:cubic-bezier(.65,0,.35,1);",
  "--ps-ease-strike:cubic-bezier(.55,0,1,.45);--ps-ease-ink:cubic-bezier(.2,.8,.2,1);--ps-ease-glow:cubic-bezier(.22,1,.36,1);",
  "--ps-dur-press:90ms;--ps-dur-ui:160ms;--ps-dur-strike:140ms;--ps-dur-ink:240ms;--ps-dur-reveal:320ms;--ps-dur-trace:640ms;",
  "--ps-dur-glow:420ms;--ps-dur-media:900ms;--ps-dur-aurora:32s;",
  "--ps-z-header:10;--ps-z-overlay:30;--ps-z-skip:40;",
].join("\n");

const REDUCED = "--ps-dur-strike:0ms;--ps-dur-ink:0ms;--ps-dur-reveal:0ms;--ps-dur-trace:0ms;--ps-dur-glow:0ms;--ps-dur-media:0ms;";

export interface TokensCssOptions {
  /** The two served fonts. A site without the /fonts/ folder (the static site of hub:build) keeps the fallbacks. Default true. */
  readonly webFonts?: boolean;
}

export const renderTokensCss = ({ webFonts = true }: TokensCssOptions = {}): string =>
  [
    "/* Generated from packages/brand/src/tokens.ts: do not edit by hand. */",
    fontFaceCss({ webFonts }),
    `:root{color-scheme:dark;${colours(PALETTE.dark)}${SHADOWS}\n${GLOW}\n${AMBIENT}\n${FOUNDATION}}`,
    SPOT_HOST,
    `@media (prefers-reduced-motion:reduce){:root{${REDUCED}}}`,
    "",
  ].join("\n");

export const TOKENS_CSS = renderTokensCss();
