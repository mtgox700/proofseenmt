import { z } from "zod";

/*
 * The period of an accounting export: two calendar days in Paris time, both included, at most a year apart. Invoices
 * are dated in Paris time on the export itself, so the boundaries are Paris midnights too: an invoice issued at 23:30
 * UTC on 30 November belongs to December on both sides.
 */

/** Calendar days this side of any date arithmetic surprise; invoices exist only from 2026. */
const Day = z.iso.date().refine((day) => day >= "2000-01-01" && day <= "2099-12-31");
/** Days included, a leap year at most. */
const MAX_DAYS = 366;
const DAY_MS = 86_400_000;

const PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });

const parisDayHour = (instant: number): string => {
  const part = (type: Intl.DateTimeFormatPartTypes): string => PARIS.formatToParts(instant).find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}`;
};

/** The instant Paris enters `day` (UTC+1 in winter, UTC+2 in summer). */
export const parisDayStart = (day: string): Date => {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  const offsetHours = [1, 2].find((h) => parisDayHour(utcMidnight - h * 3_600_000) === `${day}T00`) ?? 1;
  return new Date(utcMidnight - offsetHours * 3_600_000);
};

export type Period = { readonly from: Date; readonly to: Date } | null;

/** `[from, to)` for the days given, or `null` if they are malformed, reversed or more than a year apart. */
export const exportPeriod = (params: URLSearchParams): Period => {
  const from = Day.safeParse(params.get("from"));
  const to = Day.safeParse(params.get("to"));
  if (!from.success || !to.success) return null;
  const span = (Date.parse(to.data) - Date.parse(from.data)) / DAY_MS;
  if (span < 0 || span >= MAX_DAYS) return null;
  const next = new Date(Date.parse(to.data) + DAY_MS).toISOString().slice(0, 10);
  return { from: parisDayStart(from.data), to: parisDayStart(next) };
};
