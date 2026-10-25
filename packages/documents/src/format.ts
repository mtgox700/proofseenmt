/*
 * Formatage pur des valeurs d'un document, sans `Intl` : les données ICU changent d'une version de Node à l'autre et
 * feraient varier l'empreinte du PDF (TEMPLATE_FORMAT.md §3.1). Chaque fonction refuse ce qui n'est pas de son domaine
 * (RangeError) : la validation d'une saisie vit à la frontière (variables.ts), ici on ne devine rien.
 */

export type Lang = "fr" | "en";

const NNBSP = " ";
const NBSP = " ";

const MONTHS: Readonly<Record<Lang, readonly string[]>> = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_UTC_DATETIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|\+00:00)$/;
const CURRENCY = /^[A-Z]{3}$/;

const isLeap = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const monthLength = (year: number, month: number): number => (month === 2 ? (isLeap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31);

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const parseDate = (iso: string): DateParts | null => {
  const match = ISO_DATE.exec(iso);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= monthLength(year, month) ? { year, month, day } : null;
};

/** Vrai pour un jour réel du calendrier grégorien écrit AAAA-MM-JJ (années bissextiles comprises). */
export const isIsoDate = (value: string): boolean => parseDate(value) !== null;

/** Nombre de jours entiers de `from` à `to` (négatif si `to` précède `from`), en UTC : aucun fuseau, aucune horloge. */
export const daysBetween = (from: string, to: string): number => {
  const [a, b] = [parseDate(from), parseDate(to)];
  if (a === null || b === null) throw new RangeError(`date ISO attendue, reçu ${from} et ${to}`);
  const day = (p: DateParts): number => Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
  return day(b) - day(a);
};

const assertSafeInteger = (value: number, what: string): void => {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${what}: entier sûr attendu, reçu ${String(value)}`);
};

const group = (digits: string, separator: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

/** Entier avec séparateur de milliers : U+202F en français, virgule en anglais. */
export const formatInt = (value: number, lang: Lang): string => {
  assertSafeInteger(value, "int");
  const sign = value < 0 ? "-" : "";
  return sign + group(String(Math.abs(value)), lang === "fr" ? NNBSP : ",");
};

/** `1 234,56 EUR` (fr, U+00A0 avant le code) ou `EUR 1,234.56` (en). Centimes entiers, jamais négatifs dans un gabarit v1. */
export const formatMoney = (cents: number, currency: string, lang: Lang): string => {
  assertSafeInteger(cents, "money");
  if (cents < 0) throw new RangeError("money: un montant de gabarit n'est jamais négatif");
  if (!CURRENCY.test(currency)) throw new RangeError(`money: code ISO 4217 attendu, reçu ${currency}`);
  const whole = group(String(Math.trunc(cents / 100)), lang === "fr" ? NNBSP : ",");
  const fraction = String(cents % 100).padStart(2, "0");
  return lang === "fr" ? `${whole},${fraction}${NBSP}${currency}` : `${currency}${NBSP}${whole}.${fraction}`;
};

/** Points de base en pourcentage, sans zéro inutile : 1000 donne `10 %`, 1111 donne `11,11 %`, 2050 donne `20,5 %`. */
export const formatBp = (bp: number, lang: Lang): string => {
  assertSafeInteger(bp, "bp");
  if (bp < 0 || bp > 10_000) throw new RangeError(`bp: 0 à 10000 attendu, reçu ${bp}`);
  const fraction = String(bp % 100).padStart(2, "0").replace(/0+$/, "");
  const whole = String(Math.trunc(bp / 100));
  const number = fraction === "" ? whole : `${whole}${lang === "fr" ? "," : "."}${fraction}`;
  return lang === "fr" ? `${number}${NBSP}%` : `${number}%`;
};

/** `24 octobre 2026` (le premier du mois s'écrit `1er` en français) ou `24 October 2026`. */
export const formatDate = (iso: string, lang: Lang): string => {
  const parts = parseDate(iso);
  if (parts === null) throw new RangeError(`date AAAA-MM-JJ attendue, reçu ${iso}`);
  const day = lang === "fr" && parts.day === 1 ? "1er" : String(parts.day);
  return `${day} ${MONTHS[lang][parts.month - 1]} ${parts.year}`;
};

/** Date et heure en UTC seulement (`Z` ou `+00:00`) : jamais l'heure locale du serveur. */
export const formatDateTime = (iso: string, lang: Lang): string => {
  const match = ISO_UTC_DATETIME.exec(iso);
  const [date, hh, mm, ss] = [match?.[1], match?.[2], match?.[3], match?.[4]];
  if (date === undefined || hh === undefined || mm === undefined || ss === undefined || !isIsoDate(date) || Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) {
    throw new RangeError(`date et heure UTC attendues (AAAA-MM-JJThh:mm:ssZ), reçu ${iso}`);
  }
  return `${formatDate(date, lang)}${lang === "fr" ? " à " : ", "}${hh}:${mm}:${ss} UTC`;
};

/*
 * Typographie française : l'espace avant ; ! ? devient U+202F, avant « : » U+00A0, et les guillemets français se collent
 * aux mots qu'ils entourent (U+202F). Sans cela, un « ? » ou un « » » reste seul en début de ligne (relevé L1-021).
 * Seules les espaces ordinaires sont remplacées : idempotent, et une adresse ou une heure (`14:03:07`) n'est pas touchée.
 */
export const frenchSpacing = (text: string): string =>
  text
    .replace(/ +([;!?])/g, `${NNBSP}$1`)
    .replace(/ +:/g, `${NBSP}:`)
    .replace(/« +/g, `«${NNBSP}`)
    .replace(/ +»/g, `${NNBSP}»`)
    .replace(/(\d) +(?=[%€])/g, `$1${NBSP}`)
    .replace(/\b([nN]°) +(?=\d)/g, `$1${NBSP}`);

/** La typographie de la langue du document ; l'anglais n'a pas de règle d'espacement à appliquer. */
export const typography = (lang: Lang, text: string): string => (lang === "fr" ? frenchSpacing(text) : text);
