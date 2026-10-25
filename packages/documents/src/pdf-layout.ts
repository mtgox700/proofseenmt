import { CHROME } from "./chrome";
import { typography } from "./format";
import { paperHallmark } from "./hallmark";
import type { Block, DocumentModel, ModelClause, ModelSignatory, Run } from "./model";
import { FONT_DISPLAY, FONT_MONO, FONT_TEXT } from "./pdf-fonts";

/*
 * Mise en page d'un contrat sérieux : A4, marges de 22 mm, titre en PS Display, corps en PS Text justifié, articles
 * numérotés dont le titre ne reste jamais seul en bas de page, parties en bloc à filet, trace (références, empreinte,
 * pagination) en PS Mono avec zéro barré. Aucune date, aucun hasard : le document ne dépend que du modèle.
 */

export type PdfNode = { readonly [key: string]: unknown };

export interface LayoutOptions {
  /** Adresse de vérification imprimée au pied de chaque page (page /verifier, L2.7). */
  readonly verifyUrl?: string;
  /**
   * SVG vectoriel du poinçon d'empreinte au niveau 64 (8 x 8 cases, viewBox 64), calculé depuis l'empreinte du contenu.
   * Par défaut (`undefined`) : le dessin de la marque (`hallmark.ts`, décision de Shogun L1-090 point 1). `null` : aucun
   * dessin, l'emplacement de 12 mm reste réservé et vide.
   */
  readonly hallmarkSvg?: ((digest: string) => string) | null;
}

const INK = "#0a0b10";
const MUTED = "#5d5b55";
const FAINT = "#8a8780";
const AURA = "#7c6cff";
const PAPER_TINT = "#f5f4f0";
const MARGIN_X = 62;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 84;
const BODY_SIZE = 10;
/** Le poinçon d'empreinte au pied de chaque page : environ 12 mm de côté (34 pt), puis un blanc. */
const MARK_SLOT = 34;
const MARK_GAP = 10;
const TRACE = { font: FONT_MONO, fontFeatures: ["zero"] } as const;

const groupsOfFour = (digest: string): string => (digest.slice(0, 16).match(/.{1,4}/g) ?? []).join(" ");

/** L'empreinte du CONTENU, seize premiers caractères en capitales groupées par quatre : ce que le pied de page imprime (décision L1-147, comme à l'écran). */
export const digestGroups = (digest: string): string => groupsOfFour(digest).toUpperCase();

/** L'empreinte d'un FICHIER (octets exacts), seize premiers caractères en minuscules groupées par quatre : jamais confondue avec celle du contenu. */
export const fileDigestGroups = (digest: string): string => groupsOfFour(digest).toLowerCase();

/*
 * Texte aligné à gauche, pas justifié : pdfmake répartit la justification entre les morceaux de texte (les mots, mais aussi
 * chaque changement de style), si bien qu'un montant en gras suivi d'une virgule ou « ci-dessus » coupé au trait d'union
 * s'écartent (constaté sur le contrat de référence, pages 1 et 2). Un drapeau à droite régulier vaut mieux qu'un trou.
 */
const runNode = (run: Run): PdfNode => (run.value === true ? { text: run.text, bold: true } : { text: run.text });

const paragraph = (block: Extract<Block, { kind: "paragraph" }>): PdfNode => ({ text: block.runs.map(runNode), margin: [0, 0, 0, 5] });

const bulletList = (items: readonly Extract<Block, { kind: "bullet" }>[]): PdfNode => ({
  ul: items.map((item) => ({ text: item.runs.map(runNode), margin: [0, 0, 0, 2] })),
  markerColor: AURA,
  margin: [14, 1, 0, 6],
});

const partyBlock = (block: Extract<Block, { kind: "party" }>): PdfNode => ({
  table: {
    widths: ["*"],
    body: [[{ stack: block.lines.map((line) => ({ text: line.text, ...(line.strong === true ? { bold: true, fontSize: 10.5, margin: [0, 0, 0, 2] } : { fontSize: 9.5, color: MUTED, lineHeight: 1.2 }) })) }]],
  },
  layout: { hLineWidth: () => 0, vLineWidth: (index: number) => (index === 0 ? 1.6 : 0), vLineColor: () => AURA, paddingLeft: () => 10, paddingTop: () => 2, paddingBottom: () => 2, paddingRight: () => 0 },
  margin: [8, 3, 0, 9],
});

/** Les puces consécutives forment une seule liste ; le reste suit l'ordre du modèle. */
export const blockNodes = (blocks: readonly Block[]): readonly PdfNode[] =>
  blocks.reduce<readonly (PdfNode | readonly Extract<Block, { kind: "bullet" }>[])[]>((acc, block) => {
    const last = acc[acc.length - 1];
    if (block.kind === "bullet") return Array.isArray(last) ? [...acc.slice(0, -1), [...last, block]] : [...acc, [block]];
    return [...acc, block.kind === "party" ? partyBlock(block) : paragraph(block)];
  }, []).map((node) => (Array.isArray(node) ? bulletList(node as Extract<Block, { kind: "bullet" }>[]) : (node as PdfNode)));

const clauseHeading = (clause: ModelClause, article: string): PdfNode => ({
  text: [
    { text: `${article.toUpperCase()} ${clause.number}\n`, ...TRACE, fontSize: 7, color: FAINT, characterSpacing: 0.9 },
    { text: clause.heading, font: FONT_DISPLAY, fontSize: 12.5, color: INK, lineHeight: 1.15 },
  ],
  headlineLevel: 1,
  margin: [0, 15, 0, 5],
});

export const clauseNodes = (model: DocumentModel): readonly PdfNode[] =>
  model.clauses.flatMap((clause) => [clauseHeading(clause, CHROME[model.language].article), ...blockNodes(clause.blocks)]);

const signatory = (entry: ModelSignatory): PdfNode => ({
  stack: [
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.6, lineColor: INK }] },
    { text: entry.label.toUpperCase(), ...TRACE, fontSize: 7, color: FAINT, characterSpacing: 0.9, margin: [0, 6, 0, 3] },
    ...(entry.name === null ? [] : [{ text: entry.name, bold: true, fontSize: 10.5 }]),
    { text: entry.caption, fontSize: 8.5, color: MUTED, margin: [0, 2, 0, 0] },
  ],
});

export const signatureNodes = (model: DocumentModel): readonly PdfNode[] => [
  {
    unbreakable: true,
    stack: [
      { text: CHROME[model.language].signatures, font: FONT_DISPLAY, fontSize: 12.5, margin: [0, 24, 0, 12] },
      { columns: model.signatories.map(signatory), columnGap: 28 },
    ],
  },
];

const reviewNotice = (text: string): PdfNode => ({
  table: { widths: ["*"], body: [[{ text, fontSize: 8.5, color: INK, lineHeight: 1.3, alignment: "left" }]] },
  layout: { hLineWidth: () => 0, vLineWidth: (index: number) => (index === 0 ? 2 : 0), vLineColor: () => AURA, fillColor: () => PAPER_TINT, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 7, paddingBottom: () => 7 },
  margin: [0, 6, 0, 14],
});

export const titleNodes = (model: DocumentModel): readonly PdfNode[] => [
  ...(model.reviewNotice === null ? [] : [reviewNotice(model.reviewNotice)]),
  { text: model.title, font: FONT_DISPLAY, fontSize: 25, color: INK, lineHeight: 1.08, margin: [0, 4, 0, 6] },
  ...(model.subtitle === null ? [] : [{ text: model.subtitle, ...TRACE, fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 10] }]),
  { canvas: [{ type: "line", x1: 0, y1: 0, x2: 595.28 - 2 * MARGIN_X, y2: 0, lineWidth: 0.8, lineColor: INK }], margin: [0, 0, 0, 4] },
];

export const headerFor = (model: DocumentModel): ((page: number) => PdfNode) => (page) => ({
  margin: [MARGIN_X, 28, MARGIN_X, 0],
  columns: [
    { text: "Proofseen", font: FONT_DISPLAY, fontSize: 10.5, color: INK, width: "auto" },
    page === 1 ? { text: "" } : { text: model.title.toUpperCase(), ...TRACE, fontSize: 6.5, color: FAINT, characterSpacing: 0.9, alignment: "right", margin: [0, 3, 0, 0] },
  ],
});

export const footerFor = (model: DocumentModel, options: LayoutOptions): ((page: number, pages: number) => PdfNode) => {
  const chrome = CHROME[model.language];
  // 12 mm = 34 pt, réservés qu'il y ait un dessin ou non (L1-090 point 1).
  const draw = options.hallmarkSvg === undefined ? paperHallmark : options.hallmarkSvg;
  const slot = draw === null ? { text: "", width: MARK_SLOT + MARK_GAP } : { width: MARK_SLOT + MARK_GAP, stack: [{ svg: draw(model.contentDigest), width: MARK_SLOT, height: MARK_SLOT }] };
  return (page, pages) => ({
    margin: [MARGIN_X, 10, MARGIN_X, 0],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 595.28 - 2 * MARGIN_X, y2: 0, lineWidth: 0.4, lineColor: FAINT }], margin: [0, 0, 0, 5] },
      {
        columns: [
          slot,
          {
            width: "*",
            margin: [0, 7, 0, 0],
            stack: [
              { text: [{ text: `${chrome.digestLabel.toUpperCase()}  `, fontSize: 6, color: FAINT, characterSpacing: 0.7 }, { text: digestGroups(model.contentDigest), fontSize: 8, color: INK }], ...TRACE },
              // Ce que l'empreinte désigne (le contenu, pas le fichier) et où la vérifier : elle ne peut pas contenir celle du fichier.
              { text: typography(model.language, options.verifyUrl === undefined ? chrome.digestNote : `${chrome.digestNote} ${chrome.verifyLabel} ${options.verifyUrl}`), fontSize: 6.5, color: FAINT, margin: [0, 2, 0, 0] },
            ],
          },
          { width: "auto", text: chrome.page(page, pages), ...TRACE, fontSize: 8, color: MUTED, alignment: "right", margin: [0, 9, 0, 0] },
        ],
      },
      ...(model.reviewFooter === null ? [] : [{ text: model.reviewFooter, fontSize: 7, color: FAINT, margin: [0, 5, 0, 0] }]),
    ],
  });
};

const pdfInfo = (model: DocumentModel): PdfNode => {
  const date = new Date(`${model.issuedOn}T00:00:00.000Z`);
  return {
    title: model.title,
    author: "Proofseen",
    subject: `${model.templateId} v${model.templateVersion}`,
    keywords: `${model.templateId}, ${model.contentDigest.slice(0, 16)}`,
    creator: "Proofseen",
    producer: "Proofseen",
    creationDate: date,
    modDate: date,
  };
};

/** Le document pdfmake complet : une fonction du seul modèle, donc déterministe. */
export const documentDefinition = (model: DocumentModel, options: LayoutOptions = {}): PdfNode => ({
  pageSize: "A4",
  pageMargins: [MARGIN_X, MARGIN_TOP, MARGIN_X, MARGIN_BOTTOM],
  version: "1.7",
  language: model.language === "fr" ? "fr-FR" : "en-GB",
  info: pdfInfo(model),
  defaultStyle: { font: FONT_TEXT, fontSize: BODY_SIZE, lineHeight: 1.27, color: INK },
  header: headerFor(model),
  footer: footerFor(model, options),
  ...(model.watermark === null ? {} : { watermark: { text: model.watermark, font: FONT_DISPLAY, color: AURA, opacity: 0.1, fontSize: 56, bold: false } }),
  content: [...titleNodes(model), ...clauseNodes(model), ...signatureNodes(model)],
});

/** Règle contre le titre orphelin : un titre d'article en dernière position de page passe à la page suivante. */
export const pageBreakBefore = (node: { readonly headlineLevel?: number }, followingNodesOnPage: readonly unknown[]): boolean =>
  node.headlineLevel === 1 && followingNodesOnPage.length === 0;
