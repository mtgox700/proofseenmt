/*
 * Modèle de document du rapport client, et ses deux rendus.
 *
 * Pourquoi un modèle plutôt que deux gabarits : le rapport est un document **contractuel**. Écrire une version
 * Markdown et une version HTML côte à côte, c'est accepter qu'elles disent un jour deux choses différentes — le même
 * piège que des dates recopiées dans deux traductions. Ici le fond est décrit une fois ; seule la forme est doublée.
 *
 * L'échappement appartient au rendu, pas au fond : un `|` casse un tableau Markdown, un `<` ouvre une balise HTML.
 * Le fond ne sait rien de tout cela, et ne peut donc pas être écrit de façon à remodeler l'un ou l'autre.
 */

/** Fragment de texte. `{ b }` est mis en valeur, `{ c }` est un extrait littéral ; le reste est du texte courant. */
export type Run = string | { readonly b: string } | { readonly c: string };
export type Text = readonly Run[];
/** Ce qu'une cellule ou un point de liste accepte à l'écriture : une chaîne simple, un fragment, ou une suite. */
export type Inline = string | Run | Text;

const toText = (value: Inline): Text => (typeof value === "string" ? [value] : Array.isArray(value) ? value : [value as Run]);

export type Block =
  | { readonly kind: "heading"; readonly level: 1 | 2 | 3; readonly text: Text }
  | { readonly kind: "paragraph"; readonly text: Text }
  | { readonly kind: "table"; readonly headers: readonly string[]; readonly rows: readonly (readonly Text[])[] }
  | { readonly kind: "list"; readonly items: readonly Text[] }
  | { readonly kind: "definitions"; readonly items: readonly { readonly term: Text; readonly detail: Text }[] };

export type ReportDocument = readonly Block[];

/** Raccourcis de composition : ils rendent les sections lisibles à l'écriture. */
export const b = (text: string): Run => ({ b: text });
export const c = (text: string): Run => ({ c: text });
export const heading = (level: 1 | 2 | 3, ...text: Text): Block => ({ kind: "heading", level, text });
export const paragraph = (...text: Text): Block => ({ kind: "paragraph", text });
export const list = (items: readonly Inline[]): Block => ({ kind: "list", items: items.map(toText) });
export const table = (headers: readonly string[], rows: readonly (readonly Inline[])[]): Block => ({
  kind: "table",
  headers,
  rows: rows.map((row) => row.map(toText)),
});
export const definitions = (items: readonly { readonly term: Inline; readonly detail: Inline }[]): Block => ({
  kind: "definitions",
  items: items.map((item) => ({ term: toText(item.term), detail: toText(item.detail) })),
});

/**
 * Entre un terme et son détail : le deux-points français, précédé d'une espace fine insécable pour qu'il ne passe
 * jamais seul en début de ligne. Le rapport n'est rendu qu'en français (`toHtml` reçoit `lang: "fr"`).
 */
const TERM_SEPARATOR = "\u202f: ";

const plain = (run: Run): string => (typeof run === "string" ? run : "b" in run ? run.b : run.c);

/**
 * Échappement Markdown : une valeur venue de la demande d'audit ne doit pas pouvoir forger une colonne de tableau,
 * fermer un extrait de code ou ouvrir un titre — donc glisser une promesse de résultat dans un rapport qui s'engage
 * à n'en faire aucune.
 */
const escapeMd = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/([`|])/g, "\\$1")
    // Les blancs sont ramenés à une espace — ce qui neutralise les sauts de ligne — mais **sans rogner les bords** :
    // un fragment se compose avec ses voisins, et rogner ici collerait « …IA : » à « Camille Dupont ».
    // Seuls les blancs ASCII sont visés : l'espace insécable avant « % » est de la typographie, pas un saut de ligne.
    .replace(/[ \t\r\n\f\v]+/g, " ");

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const mdRun = (run: Run): string => {
  if (typeof run === "string") return escapeMd(run);
  if ("b" in run) return `**${escapeMd(run.b)}**`;
  // Les accents graves sont retirés du contenu plutôt qu'échappés : dans un extrait, ils en sortiraient.
  return `\`${run.c.replace(/`/g, "").replace(/\s+/g, " ").trim()}\``;
};
const htmlRun = (run: Run): string => {
  if (typeof run === "string") return escapeHtml(run);
  if ("b" in run) return `<strong>${escapeHtml(run.b)}</strong>`;
  return `<code>${escapeHtml(run.c)}</code>`;
};
const mdText = (text: Text): string => text.map(mdRun).join("");
const htmlText = (text: Text): string => text.map(htmlRun).join("");

export const toMarkdown = (document: ReportDocument): string => {
  const lines: string[] = [];
  for (const block of document) {
    switch (block.kind) {
      case "heading":
        lines.push(`${"#".repeat(block.level)} ${mdText(block.text)}`, "");
        break;
      case "paragraph":
        lines.push(mdText(block.text), "");
        break;
      case "list":
        lines.push(...block.items.map((item) => `- ${mdText(item)}`), "");
        break;
      case "table":
        lines.push(
          `| ${block.headers.map(escapeMd).join(" | ")} |`,
          `|${block.headers.map(() => "---").join("|")}|`,
          ...block.rows.map((row) => `| ${row.map(mdText).join(" | ")} |`),
          "",
        );
        break;
      case "definitions":
        for (const item of block.items) lines.push(`- ${mdText(item.term)}${TERM_SEPARATOR}${mdText(item.detail)}`, "");
        break;
    }
  }
  return lines.join("\n");
};

/**
 * Feuille de style minimale, en ligne : le client doit pouvoir ouvrir le fichier hors ligne, l'imprimer et le garder.
 * Aucun script, aucune ressource distante — un document qui appelle le réseau pour s'afficher n'est pas un document.
 */
const STYLE = `:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0 auto;padding:2.5rem 1.25rem 4rem;max-width:46rem;font:400 16px/1.65 ui-sans-serif,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#15202b;background:#fff}
h1{font-size:1.9rem;line-height:1.2;margin:0 0 1.5rem}
h2{font-size:1.3rem;margin:2.5rem 0 .75rem;padding-top:1.25rem;border-top:1px solid #dfe5ec}
h3{font-size:1.05rem;margin:1.75rem 0 .5rem}
p{margin:0 0 .9rem}
ul{margin:0 0 1rem;padding-left:1.1rem}
li{margin:0 0 .4rem}
/* Le tableau defile dans son cadre plutot que de pousser la page : sur telephone, six colonnes ne tiennent pas. */
.scroll{overflow-x:auto;margin:0 0 1.25rem;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:.92rem}
th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid #e6ebf1;vertical-align:top;min-width:6.5rem}
th{font-weight:600;background:#f5f8fa;border-bottom:1px solid #cfd8e3}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;background:#f2f5f8;padding:.1em .3em;border-radius:3px}
strong{font-weight:600}
@media print{body{padding:0;max-width:none}h2{break-after:avoid}table{break-inside:avoid}.scroll{overflow-x:visible}}`;

export interface HtmlOptions {
  readonly lang: string;
  readonly title: string;
}

export const toHtml = (document: ReportDocument, options: HtmlOptions): string => {
  const body: string[] = [];
  for (const block of document) {
    switch (block.kind) {
      case "heading":
        body.push(`<h${block.level}>${htmlText(block.text)}</h${block.level}>`);
        break;
      case "paragraph":
        body.push(`<p>${htmlText(block.text)}</p>`);
        break;
      case "list":
        body.push(`<ul>${block.items.map((item) => `<li>${htmlText(item)}</li>`).join("")}</ul>`);
        break;
      case "table":
        body.push(
          `<div class="scroll"><table><thead><tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>` +
            `<tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${htmlText(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
        );
        break;
      case "definitions":
        body.push(
          `<ul>${block.items.map((item) => `<li>${htmlText(item.term)}${TERM_SEPARATOR}${htmlText(item.detail)}</li>`).join("")}</ul>`,
        );
        break;
    }
  }
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(options.lang)}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    // Un rapport client n'a rien à faire dans un index : il parle d'une personne et n'a qu'un destinataire.
    '<meta name="robots" content="noindex,nofollow">',
    `<title>${escapeHtml(options.title)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    `<body>${body.join("")}</body>`,
    "</html>",
    "",
  ].join("\n");
};

/** Titre du document, pris sur son premier titre de niveau 1. */
export const documentTitle = (document: ReportDocument): string => {
  const first = document.find((block) => block.kind === "heading" && block.level === 1);
  return first === undefined || first.kind !== "heading" ? "Rapport Proofseen" : first.text.map(plain).join("");
};
