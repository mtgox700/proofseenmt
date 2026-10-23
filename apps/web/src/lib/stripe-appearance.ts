import { FONT_STACKS, PALETTE } from "@proofseen/brand";

/*
 * The Stripe payment form in the page's own colours (CONNECTED_PLAN §3, lot 4): Stripe's Appearance API, its variables and
 * rules drawn from the brand palette. Built on the server and handed to the payment form as plain strings, so the palette
 * module never ships to the browser. One set: the brand is dark only (BRAND_BOOK_V2, section 2), so the form is too,
 * whatever the system asks. Same language as the page's own fields: background of the page, edge at 3:1 (`lineStrong`),
 * focus ring of 2 px in the focus colour (the aura made legible), radius of 6 px, the system face. Never the proof green:
 * paying is not a verified fact, and Stripe's success colour is set to the ink.
 */

export interface StripeAppearance {
  readonly theme: "night";
  readonly variables: Readonly<Record<string, string>>;
  readonly rules: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** The form's one appearance, on the night of the brand. */
export const stripeAppearance = (): StripeAppearance => {
  const p = PALETTE.dark;
  const ring = `0 0 0 2px ${p.focus}`;
  return {
    theme: "night",
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
      borderRadius: "6px",
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
