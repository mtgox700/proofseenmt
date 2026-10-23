/**
 * The calendar day of an instant as read in Paris, as `YYYY-MM-DD`: the `datetime` of a date that `day` (src/lib/format)
 * writes out. Read in UTC instead, a fact recorded at 00:30 in Paris would carry the day before in its markup.
 */
export const parisDay = (at: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
