/*
 * Payment links (Stripe Payment Links), injected by environment variables at build time. A value that is not a Stripe
 * page over https is refused: a typo in a deployment setting must never turn the order button into a link elsewhere.
 */

export type OfferKey = "audit" | "turnkey";

const STRIPE_LINK = /^https:\/\/(buy|checkout)\.stripe\.com\/[A-Za-z0-9_\-/]+$/;

export const paymentLink = (raw: string | undefined): string | null => {
  const value = raw?.trim() ?? "";
  return STRIPE_LINK.test(value) ? value : null;
};

/** Read once per render; the variable names are written in full so the bundler can inline them. */
export const paymentLinks = (): Readonly<Record<OfferKey, string | null>> => ({
  audit: paymentLink(process.env.NEXT_PUBLIC_PAYMENT_LINK_AUDIT),
  turnkey: paymentLink(process.env.NEXT_PUBLIC_PAYMENT_LINK_TURNKEY),
});
