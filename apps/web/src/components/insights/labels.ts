import type { Lang } from "@/i18n";

/* Day and month labels of the dashboards. Days and months are calendar values (`AAAA-MM-JJ`, `AAAA-MM`): read in UTC. */

const LOCALE: Readonly<Record<Lang, string>> = { fr: "fr-FR", en: "en-GB" };

/** « 15 oct. », "15 Oct". */
export const shortDay = (day: string, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** « 15 octobre 2026 », "15 October 2026". */
export const longDay = (day: string, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** « oct. 2026 », "Oct 2026". */
export const shortMonth = (month: string, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

/** « octobre 2026 », "October 2026". */
export const longMonth = (month: string, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
