import { wilson, type Interval } from "@proofseen/stats";
import type { Lang } from "@/i18n/types";

/*
 * Every figure on screen goes through here. Two rules, taken from the client report: a rate is never shown without its
 * range, and an observed share is never rounded down to a zero that was not counted.
 */

const NARROW_NBSP = "\u202f";
const LOCALE: Readonly<Record<Lang, string>> = { fr: "fr-FR", en: "en-GB" };

const decimals = (value: number, lang: Lang): string =>
  new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(value);

const withSign = (digits: string, lang: Lang): string => (lang === "fr" ? `${digits}${NARROW_NBSP}%` : `${digits}%`);

export const percent = (value: number, lang: Lang): string => {
  const points = value * 100;
  if (value > 0 && points < 0.05) return `< ${withSign(decimals(0.1, lang), lang)}`;
  return withSign(decimals(points, lang), lang);
};

export const range = (interval: Interval | null, lang: Lang): string => {
  if (interval === null) return lang === "fr" ? "non calculable" : "not computable";
  const low = percent(interval.low, lang);
  const high = percent(interval.high, lang);
  return lang === "fr" ? `[${low} ; ${high}]` : `[${low}, ${high}]`;
};

/** A share of observed citations, with the Wilson interval of that share. `null` when nothing was counted. */
export const shareWithRange = (successes: number, total: number): Interval | null => wilson(successes, total);

export const count = (value: number, lang: Lang): string => new Intl.NumberFormat(LOCALE[lang]).format(value).replace(/\u00a0/g, NARROW_NBSP);

export const date = (iso: string, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

/** Measurement cost in dollars, written the way the landing already states it: \u00ab 15,79 $ \u00bb, "$15.79". */
export const usd = (value: number, lang: Lang): string => {
  const digits = new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return lang === "fr" ? `${digits}${NARROW_NBSP}$` : `$${digits}`;
};

const MINUS = "\u2212";

/** A change between two measures, in percentage points: never in raw counts, the denominators can differ. */
export const points = (delta: number, lang: Lang): string => {
  const sign = delta > 0 ? "+" : delta < 0 ? MINUS : "";
  const digits = decimals(Math.abs(delta) * 100, lang);
  return lang === "fr" ? `${sign}${digits}${NARROW_NBSP}pt` : `${sign}${digits} pts`;
};

/** An amount in cents, in its currency, without cents when whole: « 650 € », "€650". */
export const money = (cents: number, currency: string, lang: Lang): string =>
  new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })
    .format(cents / 100)
    .replace(/\u00a0/g, NARROW_NBSP);

/**
 * The day of an instant, as read in Paris: a contract signed at 00:30 in Paris is signed that day, not the day before in
 * UTC. Calendar days stored without a time (start dates, due dates) keep `date`, which reads them in UTC.
 */
export const day = (instant: Date, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(instant);

/** A calendar month stored as its first day (UTC): « mars 2025 », "March 2025". */
export const month = (firstDay: Date, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(firstDay);
