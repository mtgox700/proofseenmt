import { z } from "zod";
import type { Lang } from "@/i18n/types";
import { parisDay } from "@/lib/paris-day";

/*
 * Dates of the primitives: real or refused. A date that does not parse throws, it is never drawn as « Invalid Date »
 * nor replaced by now (LEGENDS_P2_CONCEPT §C.0, rule 2: no invented date). Written as read in Paris, where the
 * platform's days are counted; the machine form goes in <time datetime>.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const instantSchema = z.union([z.date(), z.string()]).transform((value, ctx) => {
  const at = value instanceof Date ? new Date(value.getTime()) : DAY.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(at.getTime())) {
    ctx.addIssue({ code: "custom", message: "a real date is required" });
    return z.NEVER;
  }
  return at;
});

export type Instant = z.input<typeof instantSchema>;
export type Precision = "day" | "minute";

const LOCALE: Readonly<Record<Lang, string>> = { fr: "fr-FR", en: "en-GB" };
/** Written by code point, never typed: the no-break space Intl writes, and the narrow one French typography wants. */
const NBSP = new RegExp(String.fromCharCode(0xa0), "g");
const NARROW = String.fromCharCode(0x202f);

/** « 24 octobre 2026 à 14:03 », "24 October 2026 at 14:03"; or the day alone. */
export function writtenDate(at: Date, lang: Lang, precision: Precision): string {
  const options: Intl.DateTimeFormatOptions =
    precision === "day" ? { dateStyle: "long", timeZone: "Europe/Paris" } : { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" };
  return new Intl.DateTimeFormat(LOCALE[lang], options).format(at).replace(NBSP, NARROW);
}

/** The machine form for <time datetime>: the Paris day, or the instant in UTC to the second. */
export function machineDate(at: Date, precision: Precision): string {
  return precision === "day" ? parisDay(at) : `${at.toISOString().slice(0, 19)}Z`;
}

/** How long something has waited, at the moment it was measured: « 12 min », « 5 h », « 3 j ». */
export function waited(since: Date, at: Date, lang: Lang): string {
  const minutes = Math.max(0, Math.floor((at.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}${NARROW}min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}${NARROW}h`;
  return `${Math.floor(minutes / (60 * 24))}${NARROW}${lang === "fr" ? "j" : "d"}`;
}
