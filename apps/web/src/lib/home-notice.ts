/*
 * The one-click actions offered on the freelancer home (C23: publish, availability still right, no longer available)
 * are the profile page's own server actions. A hidden `retour=accueil` field brings the person back home with one short
 * notice; only known notices are read back from the address, and nothing the address carries is shown as text.
 */

export const HOME_RETURN_FIELD = "retour";
export const HOME_RETURN_VALUE = "accueil";

export const HOME_NOTICES = ["publie", "dispo-confirmee", "indisponible"] as const;
export type HomeNotice = (typeof HOME_NOTICES)[number];

/** Whether the form was sent from the home page and should land back there. */
export const returnsHome = (formData: FormData): boolean => formData.get(HOME_RETURN_FIELD) === HOME_RETURN_VALUE;

export const homeNoticeHref = (lang: string, notice: HomeNotice): string => `/${lang}/app?avis=${notice}`;

export const readHomeNotice = (raw: string | undefined): HomeNotice | null => HOME_NOTICES.find((notice) => notice === raw) ?? null;
