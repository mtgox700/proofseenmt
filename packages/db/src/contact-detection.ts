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
// Le cabochon d'un émoji chiffre (« 6️⃣ ») : le chiffre est là, entouré de deux marques invisibles.
const KEYCAP = new RegExp(`[${String.fromCharCode(0xfe0f, 0x20e3)}]`, "g");
// « jean at proton dot me », « jean (a) proton.me », « jean [at] gmail », « jean @ outlook dot fr »
const EMAIL_SPELLED =
  /\b(?:at|arobase)\b[^\n]{0,40}\b(?:dot|point)\b|[([]\s{0,2}(?:a|at|arobase)\s{0,2}[)\]]\s{0,2}[a-z0-9-]{2,63}|@\s{0,3}[a-z0-9-]{2,63}\s{1,3}(?:dot|point)\s{1,3}[a-z]{2,24}\b/i;
// Des noms de technologies qui ressemblent à des adresses : « ASP.NET », « Socket.IO » ne mènent nulle part.
const TECH_NAMES = /\b(?:asp|vb|ml|ado)\.net\b|\b(?:socket|draw)\.io\b/gi;
// Les raccourcisseurs (cutt.ly, linktr.ee, is.gd, x.gy) passent par leur extension ; « .sh » ou « .to » restent permis,
// un freelance tech écrit « deploy.sh » tous les jours.
const TLD = "com|fr|io|dev|net|org|co|eu|me|ch|be|de|lu|uk|es|it|nl|xyz|ai|app|info|biz|pro|tech|email|link|page|site|online|ly|ee|gd|gy";
// Un caractère de nom avant le point suffit : relire tout le nom à chaque position coûtait 63 pas par caractère.
const URL_LIKE = new RegExp(String.raw`\bhttps?://|\bwww\.|\b(?:bit\.ly|t\.me|wa\.me|x\.com|calendly\.com)\b|[a-z0-9-]\.(?:${TLD})\b`, "i");
const HANDLE =
  /\b(?:linkedin|whats\s{0,2}app|telegram|skype|discord|gmail|hotmail|protonmail|insta(?:gram)?|viber|wechat|snapchat|twitter|tiktok|facebook|messenger|threema)\b|\b(?:tg|ig|snap)\s{0,2}:/i;
// « g m a i l » : des lettres isolées séparées par une espace se relisent en un mot (pour les pseudonymes seulement).
const SPACED_LETTERS = /(?<=\b\p{L})\s(?=\p{L}\b)/gu;
// Une date ne compte comme date que seule : « 0612-34-56-78 » ou « 06/12/34/56/78 » est un numéro déguisé.
const DATE =
  /(?<![\d\-/.])(?:19|20)\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])(?![\d\-/.])|(?<![\d\-/.])(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/(?:19|20)?\d{2}(?![\d\-/.])/g;
// Une année seule (« Spring 6 ; 2018 2019 ») n'est pas un morceau de numéro : sans cela, une liste de versions et
// d'années se lit comme un téléphone et le texte est refusé.
const YEAR = /(?<![\d\-/.+])(?:19|20)\d{2}(?![\d\-/.])/g;
// Les séparateurs entre deux chiffres sont retirés en une passe, puis on cherche une suite de neuf chiffres ou plus.
// La barre verticale n'en est pas un : « Sprint 10 | 11 | 12 | 13 » est une liste, pas un numéro.
const DIGIT_SEPARATOR = /(\d)[\s.,;:\-()/_*#]{1,6}(?=\+?\d)/g;
// « O6 I2 34 56 78 » : une lettre qui ressemble à un chiffre, collée à un chiffre (au plus un séparateur), en est un.
const DIGIT_LOOKALIKE = /[Oo](?=[\s.\-_]?\d)|(?<=\d[\s.\-_]?)[Oo]|[Il](?=[\s.\-_]?\d)|(?<=\d[\s.\-_]?)[Il]/g;
const LOOKALIKE_DIGIT: Readonly<Record<string, string>> = { O: "0", o: "0", I: "1", l: "1" };
const LONG_NUMBER = /\d{9,}/;
// L'écriture « l1nk3d1n » n'échappe pas aux pseudonymes.
const LEET: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a" };

/** Message de refus commun à tous les champs publics : les routes le reconnaissent pour répondre « coordonnées refusées ». */
export const NO_CONTACT = "pas de coordonnées";

const DECIMAL_DIGIT = /\p{Nd}/u;

// La valeur de chaque chiffre déjà rencontré : un texte piégé de 10 000 chiffres arabes ne refait pas le calcul 10 000 fois.
const digitValues = new Map<number, string>();

const digitValue = (code: number): string => {
  const known = digitValues.get(code);
  if (known !== undefined) return known;
  // Les chiffres de chaque écriture sont contigus, de 0 à 9 : la position dans la suite donne la valeur.
  let start = code;
  while (start > code - 60 && DECIMAL_DIGIT.test(String.fromCodePoint(start - 1))) start -= 1;
  const value = String((code - start) % 10);
  digitValues.set(code, value);
  return value;
};

/** « ٠٦١٢ » ou « ０６１２ » : tout chiffre décimal d'une autre écriture est lu comme le chiffre ASCII qu'il vaut. */
const asciiDigits = (text: string): string => {
  // Le cas courant, un texte sans chiffre d'une autre écriture, ne paie rien.
  if (!/[^\t\n\r\x20-\x7E]/.test(text)) return text;
  return text.replace(/\p{Nd}/gu, (c) => (c >= "0" && c <= "9" ? c : digitValue(c.codePointAt(0) ?? 0)));
};

const normalise = (raw: string): string => asciiDigits(raw.normalize("NFKC").replace(INVISIBLE, "").replace(KEYCAP, ""));

/** Adresse e-mail, téléphone ou pseudonyme de messagerie : un moyen de joindre directement une personne. */
const directContact = (text: string): boolean => {
  if (EMAIL.test(text) || EMAIL_SPELLED.test(text) || HANDLE.test(text)) return true;
  // Une adresse écrite lettre par lettre (« j o h n @ p r o t o n . m e ») se lit une fois les espaces retirés.
  if (text.includes("@") && EMAIL.test(text.replace(/\s+/g, ""))) return true;
  if (HANDLE.test(text.replace(/[013457@]/g, (c) => LEET[c] ?? c)) || HANDLE.test(text.replace(SPACED_LETTERS, ""))) return true;
  const digits = text.replace(DIGIT_LOOKALIKE, (c) => LOOKALIKE_DIGIT[c] ?? c);
  return LONG_NUMBER.test(digits.replace(DATE, " ").replace(YEAR, " ").replace(DIGIT_SEPARATOR, "$1"));
};

/** Vrai si le texte contient une adresse, un lien, un numéro de téléphone ou un pseudonyme de messagerie externe. */
export const containsContact = (raw: string): boolean => {
  const text = normalise(raw);
  return directContact(text) || URL_LIKE.test(text.replace(TECH_NAMES, " "));
};

/**
 * Pour un nom d'entreprise : un nom de domaine y est permis (« Booking.com » est une raison sociale), un moyen de
 * joindre une personne ne l'est pas.
 */
export const containsDirectContact = (raw: string): boolean => directContact(normalise(raw));
