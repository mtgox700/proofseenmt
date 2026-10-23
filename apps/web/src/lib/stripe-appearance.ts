import { FONT_STACKS, PALETTE, type ThemeName } from "@proofseen/brand";

/*
 * The Stripe payment form in the page's own colours (CONNECTED_PLAN §3, lot 4): Stripe's Appearance API, its variables and
 * rules drawn from the brand palette, one set per theme. Built on the server and handed to the payment form as plain
 * strings, so the palette module never ships to the browser; the form picks the set of the theme in force when it mounts.
 * Same language as the page's own fields: background of the page, edge at 3:1 (`lineStrong`), focus ring of 2 px in the
 * focus colour, radius of 4 px, the system face. Never the proof green: paying is not a verified fact, and Stripe's
 * success colour is set to the ink.
 */

export interface StripeAppearance {
  readonly theme: "stripe" | "night";
  readonly variables: Readonly<Record<string, string>>;
  readonly rules: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export type StripeAppearances = Readonly<Record<ThemeName, StripeAppearance>>;

const appearanceFor = (theme: ThemeName): StripeAppearance => {
  const p = PALETTE[theme];
  const ring = `0 0 0 2px ${p.focus}`;
  return {
    theme: theme === "dark" ? "night" : "stripe",
    variables: {
      colorPrimary: p.text,
      colorBackground: p.bg,
      colorText: p.text,
      colorTextSecondary: p.muted,
      colorTextPlaceholder: p.faint,
      colorDanger: p.danger,
      colorWarning: p.signal,
      colorSuccess: p.text,
      fontFamily: FONT_STACKS.text,
      fontSizeBase: "16px",
      spacingUnit: "4px",
      borderRadius: "4px",
      focusBoxShadow: ring,
      focusOutline: "none",
    },
    rules: {
      ".Input": { border: `1px solid ${p.lineStrong}`, boxShadow: "none", backgroundColor: p.bg },
      ".Input:focus": { borderColor: p.focus, boxShadow: ring },
      ".Input--invalid": { borderColor: p.danger, boxShadow: "none" },
      ".Tab": { border: `1px solid ${p.lineStrong}`, boxShadow: "none", backgroundColor: p.surface },
      ".Tab:focus": { boxShadow: ring },
      ".Tab--selected": { borderColor: p.text, backgroundColor: p.raised, color: p.text },
      ".Label": { color: p.muted },
      ".Error": { color: p.danger },
    },
  };
};

/** Both sets, for the two themes of the brand. */
export const stripeAppearances = (): StripeAppearances => ({ dark: appearanceFor("dark"), light: appearanceFor("light") });
