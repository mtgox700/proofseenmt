/*
 * The Proofseen palette, v2 (BRAND_BOOK_V2 section 2): dark only. A night ink slightly blue, a warm paper for the text,
 * one proof colour (vert poinçon) that only what is verified wears, one light (the violet aura and its azure partner)
 * that never says "proof", and three state colours that are never decoration. There is no light theme any more: the
 * public pages and the connected space share this one palette, and test/tokens.test.ts refuses a second one.
 * Every pair a screen may use is listed in CONTRAST_PAIRS and measured by test/tokens.test.ts (WCAG 2.x).
 */

export type ThemeName = "dark";

export interface Palette {
  /** The deepest ground: footer, ground of the hero. */
  readonly bgDeep: string;
  /** Page background. */
  readonly bg: string;
  /** Cards, panels, table rows: one step above the page. */
  readonly surface: string;
  /** The hovered row, a raised panel: two steps above. */
  readonly raised: string;
  /** Menus and dialogs: three steps above. */
  readonly overlay: string;
  /** Body and headings. */
  readonly text: string;
  /** Secondary text: captions, dates, metadata. */
  readonly muted: string;
  /** Tertiary text, still AA: legal lines, placeholders. */
  readonly faint: string;
  /** Decorative rules and separators only: never the edge of a control. */
  readonly line: string;
  /** Edges of inputs, buttons and any control (3:1 minimum). */
  readonly lineStrong: string;
  /** The proof colour: only what is verified, and the poinçon. */
  readonly proof: string;
  /** Text and icons on a proof fill. */
  readonly onProof: string;
  /** Background of a verified block (proof mixed into the night). */
  readonly proofWash: string;
  /** To correct, not confirmed, expiring. */
  readonly signal: string;
  /** Blocking errors. */
  readonly danger: string;
  /** Focus ring and links in running text: the aura made legible (equal to auraText). */
  readonly focus: string;
  /** The light: ambience, hover edges, the halo of the main button. A graphic colour (3:1), never running text. */
  readonly aura: string;
  /** The aura as text: links, section labels, the end of the hero's gradient. */
  readonly auraText: string;
  /** The aura's gradient partner. Never alone, never text. */
  readonly azur: string;
}

export const PALETTE: Readonly<Record<ThemeName, Palette>> = {
  dark: {
    bgDeep: "#06070a",
    bg: "#0a0b10",
    surface: "#11131a",
    raised: "#191c25",
    overlay: "#222633",
    text: "#f2efe8",
    muted: "#b4b1aa",
    faint: "#94918b",
    line: "#262a36",
    lineStrong: "#71768a",
    proof: "#6fd690",
    onProof: "#06140b",
    proofWash: "#0f2119",
    signal: "#f0b44c",
    danger: "#f2907b",
    focus: "#a99dff",
    aura: "#7c6cff",
    auraText: "#a99dff",
    azur: "#3d7bff",
  },
};

/** The one browser chrome colour (<meta name="theme-color">): the page background. No second value, no media query. */
export const THEME_COLOR: string = PALETTE.dark.bg;

/*
 * The logo printed on paper (a PDF, an invoice, a press kit) and the poinçon of the favicon in a light browser tab: the
 * only places the brand meets a light ground it does not own. These inks are never the theme of a page.
 */
export const PAPER_INKS = { bg: "#f4f1ea", text: "#15140f", proof: "#0c6a41" } as const;

export type PaletteKey = keyof Palette;

export interface ContrastPair {
  readonly fg: PaletteKey;
  readonly bg: PaletteKey;
  /** 4.5 for text, 3 for user-interface components and meaningful graphics (WCAG 1.4.3 and 1.4.11). */
  readonly min: 4.5 | 3;
}

/** Every ground a text may sit on, from the deepest to the menus. */
export const GROUNDS: readonly PaletteKey[] = ["bgDeep", "bg", "surface", "raised", "overlay"];

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  ...(["text", "muted", "faint", "proof", "signal", "danger", "focus", "auraText"] as const).flatMap((fg) =>
    GROUNDS.map((bg) => ({ fg, bg, min: 4.5 as const })),
  ),
  { fg: "text", bg: "proofWash", min: 4.5 },
  { fg: "muted", bg: "proofWash", min: 4.5 },
  { fg: "proof", bg: "proofWash", min: 4.5 },
  { fg: "onProof", bg: "proof", min: 4.5 },
  // The main button: ink on paper. And ink on the full aura, the only text a violet fill may carry.
  { fg: "bg", bg: "text", min: 4.5 },
  { fg: "bg", bg: "aura", min: 4.5 },
  ...GROUNDS.map((bg) => ({ fg: "lineStrong" as const, bg, min: 3 as const })),
  ...GROUNDS.map((bg) => ({ fg: "aura" as const, bg, min: 3 as const })),
];

/*
 * The ambient light (BRAND_BOOK_V2 section 2.2): the most a text may have under it, at the worst point (both halos
 * stacked). At 18 % aura and 10 % azure over the page, `faint` keeps 4.58:1. The ambience tokens are written from these
 * numbers, and the header keeps at least HEADER_INK of ink over whatever scrolls under it.
 */
export const AMBIENT_CAP = { aura: 0.18, azur: 0.1 } as const;
export const HEADER_INK = 0.9;

const hexChannels = (hex: string): readonly [number, number, number] => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [parseInt(match[1] ?? "0", 16), parseInt(match[2] ?? "0", 16), parseInt(match[3] ?? "0", 16)];
};

const hex2 = (value: number): string => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");

/** `over` laid on `under` at `alpha`, as a browser composites it (sRGB): the ground a text really sits on. */
export const mix = (under: string, over: string, alpha: number): string => {
  const [r1, g1, b1] = hexChannels(under);
  const [r2, g2, b2] = hexChannels(over);
  return `#${hex2(r1 + (r2 - r1) * alpha)}${hex2(g1 + (g2 - g1) * alpha)}${hex2(b1 + (b2 - b1) * alpha)}`;
};

/** A palette colour as `rgb(r g b / a)`, the one form a halo or an ambience is written in (audit-page.js reads rgb()). */
export const rgbA = (hex: string, alpha: number): string => {
  const [r, g, b] = hexChannels(hex);
  return `rgb(${r} ${g} ${b} / ${String(alpha).replace(/^0\./, ".")})`;
};

/** The brightest ground under a text in an ambience: the page, then the aura and the azure at their caps. */
export const AMBIENT_WORST: string = mix(mix(PALETTE.dark.bg, PALETTE.dark.aura, AMBIENT_CAP.aura), PALETTE.dark.azur, AMBIENT_CAP.azur);

const channel = (value: number): number => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const [r, g, b] = hexChannels(hex).map(channel);
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};
