import type { Lang } from "@/i18n";

/** A path of this site that sign-in may bring the visitor back to: one of the two languages, letters, digits, dashes. */
const RETURNABLE = /^\/(?:fr|en)\/[\w/-]*$/;

/**
 * The sign-in address, with the page to come back to when there is one. Only a path of this site is kept: an address
 * of another host, or anything with a query or a scheme, falls back to plain sign-in.
 */
export const signInPath = (lang: Lang, returnTo?: string): string =>
  returnTo !== undefined && RETURNABLE.test(returnTo) ? `/${lang}/connexion?redirect_url=${encodeURIComponent(returnTo)}` : `/${lang}/connexion`;
