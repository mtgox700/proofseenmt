/*
 * Repérage des coordonnées dans un message : adresse, lien, téléphone, pseudonyme de messagerie externe. Le résultat
 * signale, il ne censure pas : l'utilisateur doit voir ce qu'il a réellement écrit.
 */

/*
 * Toutes les expressions sont bornées ou sans retour arrière : un message piégé de 10 000 caractères bloquait le
 * processus près d'une demi-seconde avec la version précédente.
 */
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;
const EMAIL = /[^\s@]{1,64}@[^\s@]{1,253}\.[a-z]{2,24}/i;
// « jean at proton dot me », « jean (a) proton.me », « jean [at] gmail »
const EMAIL_SPELLED = /\b(?:at|arobase)\b[^\n]{0,40}\b(?:dot|point)\b|[([]\s{0,2}(?:a|at|arobase)\s{0,2}[)\]]\s{0,2}[a-z0-9-]{2,63}/i;
const TLD = "com|fr|io|dev|net|org|co|eu|me|ch|be|de|lu|uk|es|it|nl|xyz|ai|app|info|biz|pro|tech|email|link|page|site|online";
// Un caractère de nom avant le point suffit : relire tout le nom à chaque position coûtait 63 pas par caractère.
const URL_LIKE = new RegExp(String.raw`\bhttps?://|\bwww\.|\b(?:bit\.ly|t\.me|wa\.me|x\.com|calendly\.com)\b|[a-z0-9-]\.(?:${TLD})\b`, "i");
const HANDLE =
  /\b(?:linkedin|whatsapp|telegram|skype|discord|gmail|hotmail|protonmail|insta(?:gram)?|viber|wechat|snapchat|twitter|tiktok|facebook|messenger)\b|\btg\s{0,2}:/i;
// Une date ne compte comme date que seule : « 0612-34-56-78 » ou « 06/12/34/56/78 » est un numéro déguisé.
const DATE =
  /(?<![\d\-/.])(?:19|20)\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])(?![\d\-/.])|(?<![\d\-/.])(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/(?:19|20)?\d{2}(?![\d\-/.])/g;
// Les séparateurs entre deux chiffres sont retirés en une passe, puis on cherche une suite de neuf chiffres ou plus.
const DIGIT_SEPARATOR = /(\d)[\s.,;:\-()/]{1,3}(?=\+?\d)/g;
const LONG_NUMBER = /\d{9,}/;
// L'écriture « l1nk3d1n » n'échappe pas aux pseudonymes.
const LEET: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a" };

/** Vrai si le texte contient une adresse, un lien, un numéro de téléphone ou un pseudonyme de messagerie externe. */
export const containsContact = (raw: string): boolean => {
  const text = raw.normalize("NFKC").replace(INVISIBLE, "");
  if (EMAIL.test(text) || EMAIL_SPELLED.test(text) || URL_LIKE.test(text) || HANDLE.test(text)) return true;
  // Une adresse écrite lettre par lettre (« j o h n @ p r o t o n . m e ») se lit une fois les espaces retirés.
  if (text.includes("@") && EMAIL.test(text.replace(/\s+/g, ""))) return true;
  if (HANDLE.test(text.replace(/[013457@]/g, (c) => LEET[c] ?? c))) return true;
  return LONG_NUMBER.test(text.replace(DATE, " ").replace(DIGIT_SEPARATOR, "$1"));
};
