/*
 * Lecture du texte d'une clause (TEMPLATE_FORMAT.md §4) : paragraphes séparés par une ligne vide, puces `- ` dont la
 * suite est indentée, placeholders `{{chemin.de.variable}}` sans expression ni filtre. Le texte est découpé AVANT
 * l'insertion des valeurs : une valeur saisie qui contient `{{...}}` ou `- ` reste du texte, jamais de la structure.
 */

export const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;

export const placeholdersOf = (text: string): readonly string[] => [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");

export type Segment = { readonly literal: string } | { readonly variable: string };

export interface TextBlock {
  readonly kind: "paragraph" | "bullet";
  readonly segments: readonly Segment[];
}

/** Découpe une ligne en morceaux de texte et en variables, dans l'ordre. */
export const splitSegments = (line: string): readonly Segment[] => {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of line.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ literal: line.slice(cursor, start) });
    segments.push({ variable: match[1] ?? "" });
    cursor = start + match[0].length;
  }
  if (cursor < line.length) segments.push({ literal: line.slice(cursor) });
  return segments;
};

interface Draft {
  readonly kind: TextBlock["kind"];
  readonly lines: readonly string[];
}

const BULLET = /^- (.*)$/;

const toBlock = (draft: Draft): TextBlock => ({ kind: draft.kind, segments: splitSegments(draft.lines.join(" ")) });

/** Découpe le corps d'une clause en paragraphes et en puces (suites de lignes jointes par une espace). */
export const parseBlocks = (body: string): readonly TextBlock[] => {
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  const close = (): void => {
    if (current !== null) drafts.push(current);
    current = null;
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") close();
    else if (BULLET.test(line.trimStart()) && !raw.startsWith("  ")) {
      close();
      current = { kind: "bullet", lines: [(BULLET.exec(line.trimStart())?.[1] ?? "").trim()] };
    } else if (current !== null && (current.kind === "paragraph" || raw.startsWith("  "))) {
      current = { kind: current.kind, lines: [...current.lines, line.trim()] };
    } else {
      close();
      current = { kind: "paragraph", lines: [line.trim()] };
    }
  }
  close();
  return drafts.map(toBlock);
};
