/*
 * Les jours et les mois des statistiques. Un jour est celui du calendrier de Paris, écrit « AAAA-MM-JJ » : une visite à
 * 00 h 30 à Paris compte pour ce jour-là, pas pour la veille en temps universel. En base, un jour est une date sans
 * heure, lue à minuit UTC.
 */

/** Fenêtre des courbes du tableau de bord freelance. */
export const STATS_WINDOW_DAYS = 90;

/** Durée de conservation des compteurs : treize mois, pour comparer un mois à celui de l'année précédente. */
export const STATS_RETENTION_MONTHS = 13;

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

const PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Le jour de Paris d'un instant, « AAAA-MM-JJ ». */
export const parisDay = (instant: Date): string => {
  const parts = Object.fromEntries(PARIS.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year ?? ""}-${parts.month ?? ""}-${parts.day ?? ""}`;
};

export const isDay = (value: string): boolean => DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** La date stockée d'un jour : minuit UTC. */
export const dayDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** Le jour d'une date stockée. */
export const dayOf = (stored: Date): string => stored.toISOString().slice(0, 10);

/** Les `count` jours qui finissent à `last` inclus, du plus ancien au plus récent. */
export const daysEnding = (last: string, count: number): readonly string[] => {
  const end = dayDate(last).getTime();
  return Array.from({ length: Math.max(0, count) }, (_, i) => dayOf(new Date(end - (count - 1 - i) * DAY_MS)));
};

/** Le mois d'un jour, « AAAA-MM ». */
export const monthOf = (day: string): string => day.slice(0, 7);

/** Les `count` mois qui finissent à `last` inclus (« AAAA-MM »), du plus ancien au plus récent. */
export const monthsEnding = (last: string, count: number): readonly string[] => {
  if (!MONTH.test(last)) return [];
  const year = Number(last.slice(0, 4));
  const month = Number(last.slice(5, 7)) - 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => new Date(Date.UTC(year, month - (count - 1 - i), 1)).toISOString().slice(0, 7));
};

/** Le premier jour gardé à la date `today` : treize mois avant, le même jour du mois (borné à la fin du mois). */
export const retentionStart = (today: string): string => {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1 - STATS_RETENTION_MONTHS;
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return dayOf(new Date(Date.UTC(year, month, Math.min(Number(today.slice(8, 10)), lastOfMonth))));
};
