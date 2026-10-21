/*
 * Typography of Proofseen: two served families, one free.
 * - PS Display: Source Serif 4 (Adobe, SIL OFL 1.1), optical size pinned at 48, weight axis 400 to 700, Latin subset.
 *   Renamed because "Source" is a Reserved Font Name and a subset is a modified version under the OFL.
 * - PS Mono: Source Code Pro (Adobe, SIL OFL 1.1), static 500, Latin subset, slashed zero available ("zero").
 *   The trace: references, dates, hashes, amounts, sources.
 * - Body text: the system UI font, zero bytes, the same on the React pages and the HTML hub.
 * Fallback faces carry measured metric overrides (scripts/metrics in BRAND_BOOK.md) so the swap moves nothing.
 */

export const FONT_FILES = {
  display: "/fonts/ps-display-v1.woff2",
  mono: "/fonts/ps-mono-v1.woff2",
} as const;

export const FONT_STACKS = {
  display: `"PS Display", "PS Display Fallback", "PS Display Fallback Times", Georgia, serif`,
  text: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
  mono: `"PS Mono", "PS Mono Fallback", "PS Mono Fallback Courier", ui-monospace, "SFMono-Regular", Menlo, monospace`,
} as const;

interface FallbackFace {
  readonly family: string;
  readonly local: string;
  readonly weight: string;
  readonly sizeAdjust: string;
  readonly ascent: string;
  readonly descent: string;
}

/** Measured on 2026-10-21 with fontTools against the Windows copies of each fallback (BRAND_BOOK.md, section 4). */
const FALLBACKS: readonly FallbackFace[] = [
  { family: "PS Display Fallback", local: "Georgia", weight: "400 500", sizeAdjust: "94%", ascent: "110.21%", descent: "35.64%" },
  { family: "PS Display Fallback", local: "Georgia Bold", weight: "600 700", sizeAdjust: "82.22%", ascent: "126.01%", descent: "40.74%" },
  { family: "PS Display Fallback Times", local: "Times New Roman", weight: "400 500", sizeAdjust: "101.93%", ascent: "101.64%", descent: "32.86%" },
  { family: "PS Display Fallback Times", local: "Times New Roman Bold", weight: "600 700", sizeAdjust: "97.98%", ascent: "105.74%", descent: "34.19%" },
  { family: "PS Mono Fallback", local: "Consolas", weight: "400 700", sizeAdjust: "109.13%", ascent: "90.17%", descent: "25.02%" },
  { family: "PS Mono Fallback Courier", local: "Courier New", weight: "400 700", sizeAdjust: "99.98%", ascent: "98.42%", descent: "27.30%" },
];

const WEB_FONT_FACES = [
  `@font-face{font-family:"PS Display";src:url(${FONT_FILES.display}) format("woff2");font-weight:400 700;font-style:normal;font-display:swap}`,
  `@font-face{font-family:"PS Mono";src:url(${FONT_FILES.mono}) format("woff2");font-weight:500;font-style:normal;font-display:swap}`,
];

export const fontFaceCss = ({ webFonts = true }: { readonly webFonts?: boolean } = {}): string =>
  [
    ...(webFonts ? WEB_FONT_FACES : []),
    ...FALLBACKS.map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:local("${f.local}");font-weight:${f.weight};size-adjust:${f.sizeAdjust};` +
        `ascent-override:${f.ascent};descent-override:${f.descent};line-gap-override:0%}`,
    ),
  ].join("\n");

export interface TypeStep {
  readonly name: string;
  /** px at a 375 px wide viewport. */
  readonly min: number;
  /** px at 1440 px and above. */
  readonly max: number;
  /** letter-spacing in em: negative as it grows (optical tracking). */
  readonly tracking: number;
  readonly leading: number;
}

const VIEW_MIN = 375;
const VIEW_MAX = 1440;

/** Minor third (1.2) on phones, perfect fourth (1.333) on wide screens, from a 16 to 17 px body. */
export const TYPE_SCALE: readonly TypeStep[] = [
  { name: "-2", min: 12, max: 12.5, tracking: 0.01, leading: 1.45 },
  { name: "-1", min: 14, max: 14.5, tracking: 0.005, leading: 1.5 },
  { name: "0", min: 16, max: 17, tracking: 0, leading: 1.6 },
  { name: "1", min: 19.2, max: 22.67, tracking: -0.006, leading: 1.3 },
  { name: "2", min: 23.04, max: 30.21, tracking: -0.012, leading: 1.18 },
  { name: "3", min: 27.65, max: 40.27, tracking: -0.018, leading: 1.1 },
  { name: "4", min: 33.18, max: 53.68, tracking: -0.024, leading: 1.05 },
  { name: "5", min: 39.81, max: 71.56, tracking: -0.028, leading: 1.0 },
];

const rem = (px: number): string => `${+(px / 16).toFixed(4)}rem`;

/** clamp() that is exactly `min` at 375 px and `max` at 1440 px. */
export const fluid = (min: number, max: number): string => {
  if (min === max) return rem(min);
  const slope = (max - min) / (VIEW_MAX - VIEW_MIN);
  const intercept = min - slope * VIEW_MIN;
  return `clamp(${rem(min)}, ${rem(intercept)} + ${+(slope * 100).toFixed(4)}vw, ${rem(max)})`;
};

export const typeScaleCss = (): string =>
  TYPE_SCALE.map(
    (s) => `--ps-step-${s.name}:${fluid(s.min, s.max)};--ps-track-${s.name}:${s.tracking}em;--ps-lead-${s.name}:${s.leading};`,
  ).join("\n");
