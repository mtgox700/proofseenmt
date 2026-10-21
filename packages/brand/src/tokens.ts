import { PALETTE, type Palette, type ThemeName } from "./palette";
import { FONT_STACKS, fontFaceCss, typeScaleCss } from "./type";

/*
 * The single source of the Proofseen design tokens. tokens.css is generated from here
 * (`pnpm exec tsx packages/brand/scripts/write-tokens.ts`) and test/tokens.test.ts fails if the two diverge.
 * React imports "@proofseen/brand/tokens.css"; the HTML hub inlines TOKENS_CSS. One palette, one scale, one name set.
 */

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const colours = (p: Palette): string =>
  (Object.keys(p) as (keyof Palette)[]).map((key) => `--ps-${kebab(key)}:${p[key]};`).join("");

const SHADOWS: Readonly<Record<ThemeName, string>> = {
  // Elevation is carried by the surface steps and a 1 px edge; shadows only separate floating layers. No glow.
  dark: "--ps-shadow-1:0 1px 0 rgb(0 0 0/.45),0 1px 3px rgb(0 0 0/.35);--ps-shadow-2:0 12px 32px -12px rgb(0 0 0/.7),0 0 0 1px var(--ps-line);",
  light: "--ps-shadow-1:0 1px 0 rgb(40 32 16/.06),0 1px 3px rgb(40 32 16/.08);--ps-shadow-2:0 12px 32px -12px rgb(40 32 16/.22),0 0 0 1px var(--ps-line);",
};

const theme = (name: ThemeName): string => `color-scheme:${name};${colours(PALETTE[name])}${SHADOWS[name]}`;

const FOUNDATION = [
  `--ps-font-display:${FONT_STACKS.display};`,
  `--ps-font-text:${FONT_STACKS.text};`,
  `--ps-font-mono:${FONT_STACKS.mono};`,
  "--ps-weight-display:600;--ps-weight-display-light:420;--ps-weight-text:400;--ps-weight-strong:600;--ps-weight-mono:500;",
  "--ps-track-label:.06em;",
  typeScaleCss(),
  // Space: a 4 px base.
  "--ps-space-1:.25rem;--ps-space-2:.5rem;--ps-space-3:.75rem;--ps-space-4:1rem;--ps-space-5:1.5rem;",
  "--ps-space-6:2rem;--ps-space-7:3rem;--ps-space-8:4rem;--ps-space-9:6rem;--ps-space-10:8rem;",
  // Grid: 12 columns, 76 rem wide, a fluid gutter, a 66 character measure for prose.
  "--ps-max:76rem;--ps-columns:12;--ps-gutter:clamp(1rem, .6479rem + 1.5023vw, 2rem);--ps-measure:66ch;",
  // Shape: square-cut edges for the interface; the scooped seal corner is reserved for verified things.
  "--ps-radius:4px;--ps-radius-seal:10px;--ps-border:1px;--ps-ring:2px;",
  // Motion: named for what they do. See BRAND_BOOK.md, section 7.
  "--ps-ease-out:cubic-bezier(.16,1,.3,1);--ps-ease-in-out:cubic-bezier(.65,0,.35,1);",
  "--ps-ease-strike:cubic-bezier(.55,0,1,.45);--ps-ease-ink:cubic-bezier(.2,.8,.2,1);",
  "--ps-dur-press:90ms;--ps-dur-ui:160ms;--ps-dur-strike:140ms;--ps-dur-ink:240ms;--ps-dur-reveal:320ms;--ps-dur-trace:640ms;",
  "--ps-z-header:10;--ps-z-overlay:30;--ps-z-skip:40;",
].join("\n");

const REDUCED = "--ps-dur-strike:0ms;--ps-dur-ink:0ms;--ps-dur-reveal:0ms;--ps-dur-trace:0ms;";

export const renderTokensCss = (): string =>
  [
    "/* Generated from packages/brand/src/tokens.ts: do not edit by hand. */",
    fontFaceCss(),
    `:root{${theme("dark")}\n${FOUNDATION}}`,
    `@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){${theme("light")}}}`,
    `:root[data-theme="light"]{${theme("light")}}`,
    `:root[data-theme="dark"]{${theme("dark")}}`,
    `@media (prefers-reduced-motion:reduce){:root{${REDUCED}}}`,
    "",
  ].join("\n");

export const TOKENS_CSS = renderTokensCss();
