/*
 * What the browser may know about Stripe: its publishable key (`pk_test_…` or `pk_live_…`, public by design) and the
 * address Stripe.js must be loaded from. Nothing here reads a secret: this file is imported by client components.
 */

/** Stripe requires Stripe.js to be loaded from its own domain, never bundled or self-hosted. */
export const STRIPE_JS_URL = "https://js.stripe.com/v3";

const PUBLISHABLE = /^pk_(test|live)_[A-Za-z0-9]+$/;

/** The publishable key if it is well formed, else `null`: a malformed value hides the payment screens. */
export const publishableKey = (raw: string | undefined): string | null => {
  const key = (raw ?? "").trim();
  return PUBLISHABLE.test(key) ? key : null;
};

/** Test mode is read from the key itself: a `pk_test_` key never moves real money. */
export const isTestKey = (key: string): boolean => key.startsWith("pk_test_");

/** The Stripe-hosted onboarding page a payout-account button may send the browser to, and nothing else. */
export const isStripeOnboardingUrl = (raw: unknown): raw is string => {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === "connect.stripe.com" || url.hostname.endsWith(".stripe.com"));
  } catch {
    return false;
  }
};
