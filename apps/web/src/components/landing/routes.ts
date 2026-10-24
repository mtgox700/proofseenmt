import type { Lang } from "@/i18n";

/*
 * The addresses the home page leads to, in one place. Posting a mission needs a company account: the public link opens
 * account creation and brings the visitor back to the mission form afterwards (Clerk reads `redirect_url`); a visitor
 * who already has an account signs in from there, and the form's own guard returns there too (lib/sign-in-path.ts).
 */
export const signUpHref = (lang: Lang): string => `/${lang}/creer-un-compte`;
export const postMissionHref = (lang: Lang): string => `/${lang}/creer-un-compte?redirect_url=${encodeURIComponent(`/${lang}/app/missions/nouvelle`)}`;
export const CONTACT_HREF = "mailto:contact@proofseen.com";
