/*
 * A period typed in a back-office filter: two calendar days (UTC), the second included. Anything unreadable falls back
 * to the default window ending today; a reversed period is put back in order. Never more than three years.
 */

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 3 * 366;

export interface Period {
  /** For the database: `from` included, `to` excluded (the day after the last day). */
  readonly cohort: { readonly from: Date; readonly to: Date };
  /** For the form fields, as typed back. */
  readonly from: string;
  readonly to: string;
}

const dayOf = (raw: string | undefined): Date | null => {
  if (raw === undefined || !ISO_DAY.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : date;
};

const iso = (date: Date): string => date.toISOString().slice(0, 10);

export const periodOf = (rawFrom: string | undefined, rawTo: string | undefined, now: Date = new Date(), defaultDays = 30): Period => {
  const today = new Date(`${iso(now)}T00:00:00Z`);
  const to = dayOf(rawTo) ?? today;
  const from = dayOf(rawFrom) ?? new Date(to.getTime() - (defaultDays - 1) * DAY_MS);
  const [first, last] = from.getTime() <= to.getTime() ? [from, to] : [to, from];
  const start = last.getTime() - first.getTime() > MAX_DAYS * DAY_MS ? new Date(last.getTime() - MAX_DAYS * DAY_MS) : first;
  return { cohort: { from: start, to: new Date(last.getTime() + DAY_MS) }, from: iso(start), to: iso(last) };
};
