/*
 * Typographie française du rapport client : virgule décimale, espace insécable avant « % » et « pt », dates en toutes
 * lettres. Une seule source pour les deux rendus (Markdown et HTML) et pour le plan de correction.
 */

const NBSP = "\u00a0";
const MINUS = "\u2212";

const decimal = (value: number): string => value.toFixed(1).replace(".", ",");

/** Un taux, toujours à une décimale : un rapport contractuel ne change pas de précision d'une ligne à l'autre. */
export const pct = (value: number): string => `${decimal(value * 100)}${NBSP}%`;

/** Un écart entre deux mesures, en points de pourcentage, avec un vrai signe moins. */
export const points = (delta: number): string => {
  const sign = delta > 0 ? "+" : delta < 0 ? MINUS : "";
  return `${sign}${decimal(Math.abs(delta) * 100)}${NBSP}pt`;
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;

/** « 24 septembre 2026 », « 1er octobre 2026 ». Lit la date calendaire, sans fuseau : un relevé daté ne change pas de jour. */
export const day = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match === null) throw new RangeError(`date illisible : ${iso}`);
  const [, year, month, date] = match;
  const n = Number(date);
  return `${n === 1 ? "1er" : n} ${MONTHS[Number(month) - 1]} ${year}`;
};
