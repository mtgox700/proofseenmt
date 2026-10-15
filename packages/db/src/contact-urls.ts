import { containsDirectContact, containsReachableContact } from "./contact-detection";

/*
 * Une adresse web publiée (réalisation du portfolio, vérification d'une certification, site d'une entreprise) ne doit
 * pas devenir un moyen de joindre quelqu'un hors de Proofseen. Deux contrôles :
 *
 * - l'hôte : refusé s'il est, ou s'il est un sous-domaine, d'un service de messagerie, de réseau social, de prise de
 *   rendez-vous, de raccourcissement de liens ou de page de liens (CONTACT_HOSTS, la seule liste à tenir à jour), ou si
 *   le détecteur de coordonnées y lit un pseudonyme de messagerie, un e-mail ou un téléphone ;
 * - le chemin, la requête et le fragment, une fois décodés : refusés s'ils portent un e-mail ou un téléphone.
 *
 * Les identifiants techniques (uuid, jetons hexadécimaux, numéros d'objet comme « /gallery/123456789 ») sont retirés
 * avant la lecture : ce sont des numéros, pas des téléphones. Un numéro de téléphone commence par 0 ou par + ; un
 * numéro international écrit sans + dans un chemin passe (risque résiduel, documenté).
 */

export const CONTACT_HOSTS = [
  // Messageries et réseaux sociaux, où l'on écrit directement à la personne.
  "wa.me",
  "wa.link",
  "whatsapp.com",
  "t.me",
  "telegram.me",
  "telegram.dog",
  "telegram.org",
  "signal.me",
  "signal.group",
  "m.me",
  "messenger.com",
  "fb.me",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "lnkd.in",
  "line.me",
  "viber.com",
  "discord.gg",
  "discord.com",
  "skype.com",
  "wechat.com",
  "weixin.qq.com",
  "threema.id",
  "snapchat.com",
  // Prise de rendez-vous et visioconférence : un rendez-vous pris hors de la plateforme.
  "calendly.com",
  "cal.com",
  "savvycal.com",
  "tidycal.com",
  "zcal.co",
  "youcanbook.me",
  "koalendar.com",
  "doodle.com",
  "calendar.app.google",
  "meetings.hubspot.com",
  "meet.google.com",
  "zoom.us",
  "whereby.com",
  // Raccourcisseurs : la destination réelle est cachée, et peut changer après la validation.
  "bit.ly",
  "bitly.com",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "v.gd",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
  "shorturl.at",
  "rb.gy",
  "tiny.cc",
  "s.id",
  "t.ly",
  "x.gd",
  "short.io",
  "bl.ink",
  "qrco.de",
  // Pages de liens : une page de coordonnées sous un autre nom.
  "linktr.ee",
  "tr.ee",
  "beacons.ai",
  "lnk.bio",
  "bio.link",
  "linkin.bio",
  "taplink.cc",
  "campsite.bio",
  "about.me",
] as const;

/** Vrai pour un hôte de la liste ou l'un de ses sous-domaines (« api.whatsapp.com »), jamais pour « notcalendly.com ». */
export const isContactHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return CONTACT_HOSTS.some((listed) => host === listed || host.endsWith(`.${listed}`));
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Un jeton d'au moins 16 caractères mêlant lettres et chiffres : une empreinte, une clé de partage, jamais un numéro.
const TOKEN = /\b(?=[a-z0-9]*[a-z])(?=[a-z0-9]*\d)[a-z0-9]{16,}\b/gi;
// Un numéro d'objet : six chiffres ou plus qui ne commencent ni par 0 ni par + (un téléphone commence par l'un ou l'autre).
const OBJECT_NUMBER = /(?<![\d+])[1-9]\d{5,}(?!\d)/g;

const withoutIdentifiers = (text: string): string => text.replace(UUID, " ").replace(TOKEN, " ").replace(OBJECT_NUMBER, " ");

/** Un morceau d'adresse décodé ; tel quel si son échappement est mal formé. */
const decoded = (part: string): string => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/*
 * Chaque morceau est lu à part, joint par une barre verticale, que le détecteur ne prend pas pour un séparateur de
 * chiffres : « /2023/06/15/123 » reste quatre nombres, pas un numéro de onze chiffres.
 */
const pathParts = (url: URL): string => {
  const segments = url.pathname.split("/").map(decoded);
  const query = [...url.searchParams.entries()].map(([key, value]) => `${key} ${value}`);
  return [...segments, ...query, decoded(url.hash.replace(/^#/, ""))].map(withoutIdentifiers).join(" | ");
};

/** Vrai si l'adresse mène à un service de contact direct, ou porte un e-mail ou un téléphone ; une adresse illisible aussi. */
export const urlCarriesContact = (raw: string): boolean => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }
  if (isContactHost(url.hostname)) return true;
  if (containsDirectContact(withoutIdentifiers(url.hostname.replace(/\./g, " ")))) return true;
  return containsReachableContact(pathParts(url));
};
