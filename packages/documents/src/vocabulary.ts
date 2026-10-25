import type { LanguageText } from "./schema";

/*
 * Vocabulaire tenu (TEMPLATE_FORMAT.md §1 principe 8, raisons au §8) : aucun tiret cadratin, aucun emoji, et les mots
 * qui promettraient ce que Proofseen ne fait pas (signature « qualifiée », « séquestre », « arbitrage », résultat
 * « garanti »). « employeur » n'apparaît que dans une phrase qui le nie (Proofseen n'est l'employeur de personne).
 */

const FORBIDDEN_CHARS: readonly (readonly [RegExp, string])[] = [
  [/—/u, "em dash U+2014"],
  [/–/u, "en dash U+2013"],
  [/\p{Extended_Pictographic}/u, "emoji"],
];

const FORBIDDEN_WORDS: readonly RegExp[] = [
  /\bqualifi[ée]e?s?\b/iu,
  /s[ée]questre/iu,
  /\bgaranti\b/iu,
  /garantie de r[ée]sultat/iu,
  /\barbitrage\b/iu,
  /\bqualified\b/iu,
  /\bescrow\b/iu,
  /\bguaranteed\b/iu,
  /\barbitration\b/iu,
];

const EMPLOYER = /employeur|employer/iu;
const NEGATION = /\b(?:n'est|ni|aucun|aucune|not|nor|neither|no)\b/iu;

/** Tous les textes d'un fichier de langue, à plat. */
export const textsOf = (text: LanguageText): readonly string[] => [
  text.title,
  ...(text.subtitle === undefined ? [] : [text.subtitle]),
  text.reviewNotice,
  text.reviewFooter,
  ...Object.values(text.clauses).flatMap((clause) => [clause.heading, ...(clause.body === undefined ? [] : [clause.body]), ...Object.values(clause.variants ?? {})]),
];

const sentencesOf = (text: string): readonly string[] => text.replace(/\s*\n\s*/gu, " ").split(/[.;]\s/u);

export const vocabularyProblems = (where: string, text: LanguageText): readonly string[] => {
  const all = textsOf(text);
  const chars = FORBIDDEN_CHARS.filter(([pattern]) => all.some((t) => pattern.test(t))).map(([, name]) => `${where}: forbidden ${name}`);
  const words = FORBIDDEN_WORDS.flatMap((pattern) => all.map((t) => pattern.exec(t)?.[0]).filter((m): m is string => m !== undefined)).map((word) => `${where}: forbidden word "${word}"`);
  const employer = all
    .flatMap(sentencesOf)
    .filter((sentence) => EMPLOYER.test(sentence) && !NEGATION.test(sentence))
    .map((sentence) => `${where}: "employeur" without a negation: ${sentence.trim().slice(0, 60)}`);
  return [...chars, ...words, ...employer];
};
