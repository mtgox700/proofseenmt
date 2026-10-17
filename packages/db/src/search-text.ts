/*
 * Texte de recherche « plié » : minuscules, lettres sans leurs accents, ligatures défaites. « Développeur », « DÉVELOPPEUR »
 * et « developpeur » donnent le même texte, et une recherche tapée sans accent trouve donc le mot accentué.
 *
 * Le pliage est fait dans l'application, pas par l'extension Postgres `unaccent` (absente de PGlite, où tournent les
 * tests) : la colonne `JobPost.searchText` est écrite par le dépôt, et la requête plie le texte cherché de la même façon.
 * La migration 20261017090000_search_unaccent remplit les missions existantes avec la fonction SQL `proofseen_fold`, qui
 * fait le même travail sur les lettres latines ; toute réécriture d'une mission repasse ensuite par ce pliage-ci.
 */

const MARKS = new RegExp(String.raw`\p{M}`, "gu");

/** Les lettres que la décomposition Unicode ne sépare pas de leur « accent ». */
const LIGATURES: Readonly<Record<string, string>> = { œ: "oe", æ: "ae", ß: "ss", ø: "o", đ: "d", ł: "l", ı: "i" };
const LIGATURE = new RegExp(`[${Object.keys(LIGATURES).join("")}]`, "g");

export const foldText = (text: string): string =>
  text
    .normalize("NFD")
    .replace(MARKS, "")
    .toLowerCase()
    .replace(LIGATURE, (c) => LIGATURES[c] ?? c);

/** Le texte cherché d'une mission : intitulé, description et compétences, pliés ensemble. */
export const missionSearchText = (title: string, description: string, skillsText: string): string => foldText(`${title} ${description} ${skillsText}`);
