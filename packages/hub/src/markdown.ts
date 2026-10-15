import { micromark } from "micromark";

/*
 * Markdown vers HTML sûr, pour les articles du blog. micromark (CommonMark, MIT) est sûr par défaut : le HTML brut du
 * texte est échappé, et les adresses dangereuses (javascript:, data:, vbscript:…) sont vidées. On ne lui passe jamais
 * `allowDangerousHtml` ni `allowDangerousProtocol`.
 *
 * Sur la sortie de micromark — du HTML qu'il a produit lui-même, donc régulier — trois retouches :
 * - les titres reçoivent un identifiant stable (pour les liens d'ancre et la table des matières), et un titre de
 *   niveau 1 descend au niveau 2 : la page a déjà son h1, le titre de l'article ;
 * - un lien externe reçoit rel="noopener" ;
 * - une image devient son texte alternatif : une page publique ne fait aucune requête vers un tiers.
 */

export interface MarkdownHeading {
  readonly id: string;
  readonly level: number;
  readonly text: string;
}

export interface RenderedMarkdown {
  readonly html: string;
  readonly headings: readonly MarkdownHeading[];
}

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'" };

/** Le texte d'un fragment produit par micromark : sans balises, entités décodées. */
const textOf = (html: string): string => html.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (m) => ENTITIES[m] ?? m);

const idOf = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "") || "section";

const isExternal = (href: string): boolean => /^https?:\/\//i.test(href);

export const renderMarkdown = (source: string): RenderedMarkdown => {
  const raw = micromark(source, { allowDangerousHtml: false, allowDangerousProtocol: false });
  const used = new Map<string, number>();
  const headings: MarkdownHeading[] = [];
  const withIds = raw.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_match, level: string, inner: string) => {
    const shown = Math.max(2, Number(level));
    const text = textOf(inner).trim();
    const base = idOf(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    headings.push({ id, level: shown, text });
    return `<h${shown} id="${id}">${inner}</h${shown}>`;
  });
  const html = withIds
    // Un lien dont micromark a vidé l'adresse (javascript:, data:…) ne garde que son texte : pas de lien vers nulle part.
    .replace(/<a href=""(?: title="[^"]*")?>([\s\S]*?)<\/a>/g, (_match, inner: string) => inner)
    .replace(/<a href="([^"]*)"/g,(match, href: string) => (isExternal(href) ? `${match} rel="noopener"` : match))
    .replace(/<img src="[^"]*" alt="([^"]*)"(?: title="[^"]*")? \/>/g, (_match, alt: string) => alt);
  return { html, headings };
};
