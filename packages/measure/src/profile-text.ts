import { compactText } from "@proofseen/core";

/*
 * Le texte d'un profil tel qu'il peut entrer dans une question posée aux moteurs.
 *
 * Deux risques, tous deux venant de ce que le freelance a lui-même saisi :
 * - **souffler son identité** : un titre ou une compétence qui contient son nom ou son domaine, même déguisé par des
 *   caractères invisibles ou de la ponctuation (« J.e.a.n.n.e », « jeanne_dupont », un espace de largeur nulle), ferait
 *   compter une citation qu'on a provoquée. La comparaison se fait sur les seules lettres et chiffres, en minuscules ;
 * - **glisser des consignes** : un saut de ligne, un caractère de contrôle ou un délimiteur dans un champ lui
 *   permettrait de sortir de sa place dans la question. Chaque champ tient sur une ligne, sans ces caractères.
 */

const FORMAT = new RegExp(String.raw`\p{Cf}`, "gu");
const CONTROL = new RegExp(String.raw`\p{Cc}`, "gu");
/** Délimiteurs de la question et des gabarits : jamais dans un champ, qui ne peut donc ni fermer le sien ni en ouvrir un. */
const DELIMITERS = /[<>«»{}[\]`]/g;
const WORD_SPLIT = new RegExp(String.raw`[^\p{L}\p{N}]+`, "u");

/** Plus court qu'une forme comparée sans frontière de mot, et une coïncidence deviendrait probable. */
const MIN_STEM_LENGTH = 4;
/** Plateformes partagées : le domaine n'est pas la personne, c'est le premier segment du chemin qui la désigne. */
const SHARED_HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org", "linkedin.com", "malt.fr", "malt.com", "medium.com", "dev.to", "behance.net", "dribbble.com"]);
const GENERIC_LABELS = new Set(["blog", "site", "portfolio", "github", "gitlab", "vercel", "netlify", "pages", "herokuapp", "wordpress", "medium", "substack", "blogspot", "hashnode"]);
const GENERIC_SEGMENTS = new Set(["profile", "profiles", "freelancer", "users", "user", "about", "portfolio"]);

/** Un champ saisi, sur une ligne : sans caractère invisible ni de contrôle, sans délimiteur, espaces resserrés. */
export const clean = (value: string | null): string =>
  (value ?? "").replace(FORMAT, "").replace(CONTROL, " ").replace(DELIMITERS, " ").replace(/\s+/g, " ").trim();

const stemsOfUrl = (url: string): string[] => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }
  const host = parsed.hostname.toLowerCase().replace(/[.]$/, "").replace(/^www[.]/, "");
  if (SHARED_HOSTS.has(host)) {
    const handle = parsed.pathname.split("/").map((segment) => compactText(segment)).find((segment) => segment.length >= MIN_STEM_LENGTH && !GENERIC_SEGMENTS.has(segment));
    return handle === undefined ? [] : [handle];
  }
  // Le domaine sans son TLD : « www.jeanne-dupont.example.fr » donne « jeannedupont » et « example ».
  return host
    .split(".")
    .slice(0, -1)
    .map((label) => compactText(label))
    .filter((label) => label.length >= MIN_STEM_LENGTH && !GENERIC_LABELS.has(label));
};

/** Les formes qui désignent la personne : son nom entier et chacun de ses mots, ses domaines prouvés. */
export const identityStems = (displayName: string, urls: readonly string[]): readonly string[] => {
  const name = clean(displayName);
  const words = name.split(WORD_SPLIT).map((word) => compactText(word));
  const stems = [compactText(name), ...words, ...urls.flatMap(stemsOfUrl)].filter((stem) => stem.length >= MIN_STEM_LENGTH);
  return [...new Set(stems)];
};

/** Le champ contient l'une de ces formes, une fois réduit à ses lettres et chiffres. */
export const namesSomeone = (value: string, stems: readonly string[]): boolean => {
  const compact = compactText(value);
  return stems.some((stem) => compact.includes(stem));
};
