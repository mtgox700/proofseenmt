/*
 * The Proofseen palette. Two inks (encre, papier) and one accent (vert poincon), plus three state colours that are
 * never decoration. Dark is the brand; light follows prefers-color-scheme or [data-theme="light"].
 * Every pair a screen may use is listed in CONTRAST_PAIRS and measured by test/tokens.test.ts (WCAG 2.x).
 */

export type ThemeName = "dark" | "light";

export interface Palette {
  /** Page background. */
  readonly bg: string;
  /** Cards, panels, table rows: one step above the page. */
  readonly surface: string;
  /** Menus, popovers, the hovered row: two steps above. */
  readonly raised: string;
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
  /** The proof colour: only what is verified, and the poincon. */
  readonly proof: string;
  /** Text and icons on a proof fill. */
  readonly onProof: string;
  /** Background of a verified block (proof mixed into surface). */
  readonly proofWash: string;
  /** To correct, not confirmed, expiring. */
  readonly signal: string;
  /** Blocking errors. */
  readonly danger: string;
  /** Focus ring and links in running text. */
  readonly focus: string;
}

export const PALETTE: Readonly<Record<ThemeName, Palette>> = {
  dark: {
    bg: "#0e0e0c",
    surface: "#161613",
    raised: "#1e1e1a",
    text: "#eeeae1",
    muted: "#aaa59a",
    faint: "#8f8a7f",
    line: "#2b2a26",
    lineStrong: "#77736a",
    proof: "#6fd690",
    onProof: "#0b1a10",
    proofWash: "#212d22",
    signal: "#f0b44c",
    danger: "#f08a74",
    focus: "#93b6ff",
  },
  light: {
    bg: "#f4f1ea",
    surface: "#fbf9f4",
    raised: "#ffffff",
    text: "#15140f",
    muted: "#5c584e",
    faint: "#6e695e",
    line: "#dcd7cb",
    lineStrong: "#8a8579",
    proof: "#0c6a41",
    onProof: "#f4f1ea",
    proofWash: "#e3ebe2",
    signal: "#8a4b00",
    danger: "#b0281c",
    focus: "#2a55c8",
  },
};

/** Browser chrome colour per theme (<meta name="theme-color" media=...>). */
export const THEME_COLOR: Readonly<Record<ThemeName, string>> = { dark: PALETTE.dark.bg, light: PALETTE.light.bg };

export type PaletteKey = keyof Palette;

export interface ContrastPair {
  readonly fg: PaletteKey;
  readonly bg: PaletteKey;
  /** 4.5 for text, 3 for user-interface components and meaningful graphics (WCAG 1.4.3 and 1.4.11). */
  readonly min: 4.5 | 3;
}

const TEXT_ON: readonly PaletteKey[] = ["bg", "surface", "raised"];

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  ...(["text", "muted", "faint", "proof", "signal", "danger", "focus"] as const).flatMap((fg) =>
    TEXT_ON.map((bg) => ({ fg, bg, min: 4.5 as const })),
  ),
  { fg: "text", bg: "proofWash", min: 4.5 },
  { fg: "muted", bg: "proofWash", min: 4.5 },
  { fg: "proof", bg: "proofWash", min: 4.5 },
  { fg: "onProof", bg: "proof", min: 4.5 },
  ...TEXT_ON.map((bg) => ({ fg: "lineStrong" as const, bg, min: 3 as const })),
];

const channel = (value: number): number => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => channel(parseInt(part ?? "0", 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};
