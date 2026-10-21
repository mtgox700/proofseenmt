/*
 * La typographie française des pages du hub : une espace fine insécable (U+202F) avant « : ; ? ! » et à l'intérieur
 * des guillemets, pour qu'aucune ligne ne commence par un deux-points ou un guillemet fermant (revue Kensa, m6).
 *
 * Appliquée au document entier, au rendu, sur le texte seulement : jamais dans une balise ni un attribut, jamais dans
 * un script (JSON-LD), une feuille de style, un bloc de code ou un champ de saisie. Une page anglaise n'est pas touchée.
 * Une espace fine reste une espace pour un moteur : `\s` la reconnaît, et `marketplace-verify` la ramène à une espace
 * avant de chercher un fait dans le HTML.
 */

export const NARROW_NBSP = "\u202f";

/** Le texte seul : une espace (ordinaire ou insécable) avant une ponctuation double devient une espace fine insécable. */
export const frenchSpacing = (text: string): string =>
  text.replace(/[ \u00a0]+([:;?!»])/g, `${NARROW_NBSP}$1`).replace(/«[ \u00a0]+/g, `«${NARROW_NBSP}`);

const RAW_ELEMENTS = /^<(script|style|pre|code|textarea)\b/i;

/** Le document : le texte entre les balises passe par `frenchSpacing`, sauf dans les éléments laissés tels quels. */
export const typeset = (lang: "fr" | "en", html: string): string => {
  if (lang !== "fr") return html;
  const parts = html.split(/(<[^>]*>)/);
  const out: string[] = [];
  let raw: string | null = null;
  for (const part of parts) {
    if (part.startsWith("<")) {
      const open = RAW_ELEMENTS.exec(part);
      if (raw === null && open !== null) raw = open[1]!.toLowerCase();
      else if (raw !== null && part.toLowerCase().startsWith(`</${raw}`)) raw = null;
      out.push(part);
    } else {
      out.push(raw === null ? frenchSpacing(part) : part);
    }
  }
  return out.join("");
};
