import type { Lang } from "@/i18n";

/** A path of this site that sign-in may bring the visitor back to: one of the two languages, letters, digits, dashes. */
const RETURNABLE = /^\/(?:fr|en)\/[\w/-]*$/;

/**
 * The sign-in address, with the page to come back to when there is one. Only a path of this site is kept: an address
 * of another host, or anything with a query or a scheme, falls back to plain sign-in.
 */
export const signInPath = (lang: Lang, returnTo?: string): string =>
  returnTo !== undefined && RETURNABLE.test(returnTo) ? `/${lang}/connexion?redirect_url=${encodeURIComponent(returnTo)}` : `/${lang}/connexion`;

/** A value read from a query or a form, kept only if it is a path of this site that a visitor may come back to. */
export const returnPath = (value: unknown): string | null => (typeof value === "string" && RETURNABLE.test(value) ? value : null);

/**
 * The role choice of a new account, carrying the page it was going to (Kensa n1): a new company account that came to
 * post a mission chooses its side, then lands on the mission form instead of the dashboard.
 */
export const welcomePath = (lang: Lang, returnTo?: string): string =>
  returnTo !== undefined && RETURNABLE.test(returnTo) ? `/${lang}/app/bienvenue?redirect_url=${encodeURIComponent(returnTo)}` : `/${lang}/app/bienvenue`;
