import { CHROME } from "./chrome";
import { formatDate, typography, type Lang } from "./format";
import type { Block, ModelClause, ModelSignatory, Run } from "./model";
import type { LoadedTemplate } from "./registry";
import type { Selected } from "./select";
import { PLACEHOLDER, parseBlocks, type TextBlock } from "./text";
import { formatVariable, inlineText } from "./values";
import type { Values } from "./variables";

/*
 * Du choix des clauses au modèle de document : les textes sont découpés d'abord (paragraphes, puces, placeholders), les
 * valeurs insérées ensuite, la typographie française appliquée au seul texte du gabarit. Un placeholder seul sur sa ligne
 * et de type party, list ou text devient un bloc ; ailleurs il s'insère dans la phrase.
 */

interface Context {
  readonly template: LoadedTemplate;
  readonly lang: Lang;
  readonly values: Values;
}

const valueOf = (name: string, context: Context): string => {
  // Seul « placeholder » qui n'est pas une variable : la date de relecture, lue dans la donnée `review` du gabarit.
  if (name === "review.reviewedOn") {
    const reviewedOn = context.template.decl.review.reviewedOn;
    if (reviewedOn === null) throw new Error("review.reviewedOn est nul : la relecture n'est pas attestée");
    return formatDate(reviewedOn, context.lang);
  }
  const decl = context.template.decl.variables[name];
  const value = context.values[name];
  if (decl === undefined || value === undefined) throw new Error(`placeholder sans valeur : ${name}`);
  return inlineText(formatVariable(name, decl, value, context.values, context.lang));
};

/** Texte d'un titre, d'un sous-titre ou d'un pied de page : placeholders résolus, typographie appliquée. */
export const resolveInline = (text: string, context: Context): string =>
  typography(context.lang, text.replace(/\s*\n\s*/g, " ").trim()).replace(PLACEHOLDER, (_all, name: string) => valueOf(name, context));

const runsOf = (block: TextBlock, context: Context): readonly Run[] =>
  block.segments.map((segment): Run => ("literal" in segment ? { text: typography(context.lang, segment.literal) } : { text: valueOf(segment.variable, context), value: true }));

const expandBlock = (block: TextBlock, context: Context): readonly Block[] => {
  const only = block.segments.length === 1 ? block.segments[0] : undefined;
  const name = only !== undefined && "variable" in only ? only.variable : null;
  const decl = name === null ? undefined : context.template.decl.variables[name];
  const value = name === null ? undefined : context.values[name];
  if (name !== null && decl !== undefined && value !== undefined && block.kind === "paragraph") {
    const formatted = formatVariable(name, decl, value, context.values, context.lang);
    if (formatted.kind === "party") return [{ kind: "party", lines: formatted.lines }];
    if (formatted.kind === "list") return formatted.items.map((item): Block => ({ kind: "bullet", runs: [{ text: item }] }));
    if (formatted.kind === "text") return formatted.paragraphs.map((paragraph): Block => ({ kind: "paragraph", runs: [{ text: paragraph }] }));
  }
  return [{ kind: block.kind, runs: runsOf(block, context) }];
};

const bodyOf = (selected: Selected, context: Context): string => {
  const text = context.template.texts[context.lang]?.clauses[selected.clause.id];
  const body = selected.variant === null ? text?.body : text?.variants?.[selected.variant];
  if (body === undefined) throw new Error(`texte absent pour la clause ${selected.clause.id} (${context.lang})`);
  return body;
};

export const composeClauses = (selected: readonly Selected[], context: Context): readonly ModelClause[] =>
  selected.map(({ clause, variant }, index) => {
    const heading = context.template.texts[context.lang]?.clauses[clause.id]?.heading ?? clause.id;
    return {
      id: clause.id,
      number: index + 1,
      heading: resolveInline(heading, context),
      variant,
      blocks: parseBlocks(bodyOf({ clause, variant }, context)).flatMap((block) => expandBlock(block, context)),
    };
  });

const captionOf = (mode: string | undefined, lang: Lang): string => {
  const chrome = CHROME[lang];
  if (mode === "issuance") return chrome.issuedOnProofseen;
  if (mode === "acceptance") return chrome.acceptedOnProofseen;
  return mode === "acknowledgement" ? chrome.acknowledgedOnProofseen : chrome.signedOnProofseen;
};

/** Les signataires prévus : le libellé vient de la variable du même nom que le rôle, le nom de la partie quand elle existe. */
export const composeSignatories = (context: Context): readonly ModelSignatory[] =>
  context.template.decl.signature.signatories.map(({ role, mode }) => {
    const decl = context.template.decl.variables[role];
    const value = context.values[role];
    const name = decl?.type === "party" && typeof value === "object" && value !== null ? (value as { legalName: string }).legalName : null;
    return { role, label: decl?.label[context.lang] ?? decl?.label.fr ?? role, name, caption: captionOf(mode, context.lang) };
  });

/** Texte du gabarit lu pour l'avertissement de relecture et le pied de page, ou null quand la relecture tient. */
export const reviewTexts = (context: Context, shown?: boolean): { readonly notice: string | null; readonly footer: string | null } => {
  const { decl, digest } = context.template;
  // `shown` : un rejeu reprend ce que le document émis disait, pas l'état d'une relecture attestée depuis.
  const holds = shown === undefined ? decl.review.status === "reviewed" && decl.review.reviewedDigest === digest : !shown;
  const text = context.template.texts[context.lang];
  if (text === undefined) return { notice: null, footer: null };
  if (holds) {
    // Relecture attestée : plus d'avertissement ; le pied dit « relu par un avocat le <date> » avec la date de la donnée `review`.
    const footer = text.reviewedFooter !== undefined && decl.review.reviewedOn !== null ? resolveInline(text.reviewedFooter, context) : null;
    return { notice: null, footer };
  }
  return { notice: resolveInline(text.reviewNotice, context), footer: resolveInline(text.reviewFooter, context) };
};

