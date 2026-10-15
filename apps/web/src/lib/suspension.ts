import { redirect } from "next/navigation";
import type { Lang } from "../i18n/types";

/*
 * A suspended account (C19) cannot use the app spaces: every page and every server action that goes through the
 * market context is sent to the page that says so, with the reason and a way to contest. That page itself does not use
 * the market context, so it never redirects to itself.
 */

export const suspendedPath = (lang: Lang): string => `/${lang}/app/suspendu`;

export const stopIfSuspended = (lang: Lang, suspension: { readonly at: Date; readonly reason: string } | null): void => {
  if (suspension !== null) redirect(suspendedPath(lang));
};
