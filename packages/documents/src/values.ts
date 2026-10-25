import { formatBp, formatDate, formatDateTime, formatInt, formatMoney, type Lang } from "./format";
import type { PartyLine } from "./model";
import { partyLines, type PartyData } from "./party";
import type { VariableDecl } from "./schema";
import type { Values } from "./variables";

/*
 * Une valeur de variable telle qu'elle s'imprime. Quatre formes : une suite de mots dans une phrase (`inline`), un bloc
 * de lignes (`party`), des puces (`list`), des paragraphes (`text`). Le type de la variable décide, jamais le gabarit.
 */

export type Formatted =
  | { readonly kind: "inline"; readonly text: string }
  | { readonly kind: "party"; readonly lines: readonly PartyLine[] }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "text"; readonly paragraphs: readonly string[] };

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

const currencyOf = (decl: VariableDecl, values: Values): string => {
  if (typeof decl.currency === "object") return decl.currency.literal;
  const code = decl.currency === undefined ? undefined : values[decl.currency];
  if (typeof code !== "string") throw new Error("devise absente : la validation aurait dû la refuser");
  return code;
};

const enumLabel = (name: string, decl: VariableDecl, value: unknown, lang: Lang): string => {
  const label = decl.labels?.[lang]?.[String(value)];
  if (label === undefined) throw new Error(`libellé ${lang} absent pour ${name}=${String(value)}`);
  return label;
};

const scalarText = (name: string, decl: VariableDecl, value: unknown, values: Values, lang: Lang): string => {
  switch (decl.type) {
    case "money":
      return formatMoney(value as number, currencyOf(decl, values), lang);
    case "int":
      return formatInt(value as number, lang);
    case "bp":
      return formatBp(value as number, lang);
    case "date":
      return formatDate(value as string, lang);
    case "datetime":
      return formatDateTime(value as string, lang);
    case "enum":
      return enumLabel(name, decl, value, lang);
    default:
      return collapse(String(value));
  }
};

export const formatVariable = (name: string, decl: VariableDecl, value: unknown, values: Values, lang: Lang): Formatted => {
  if (decl.type === "party") return { kind: "party", lines: partyLines(value as PartyData, lang) };
  if (decl.type === "list") return { kind: "list", items: (value as readonly string[]).map(collapse) };
  if (decl.type === "text") {
    return { kind: "text", paragraphs: (value as string).split(/\n{2,}/).map(collapse).filter((p) => p !== "") };
  }
  if (decl.type === "boolean") throw new Error(`${name} est un booléen : il sert aux conditions, il ne s'imprime pas`);
  return { kind: "inline", text: scalarText(name, decl, value, values, lang) };
};

/** La forme d'une valeur dans une phrase : les blocs s'y aplatissent (un gabarit bien écrit ne le demande jamais). */
export const inlineText = (formatted: Formatted): string => {
  switch (formatted.kind) {
    case "inline":
      return formatted.text;
    case "party":
      return formatted.lines.map((l) => l.text).join(", ");
    case "list":
      return formatted.items.join(" ; ");
    case "text":
      return formatted.paragraphs.join(" ");
  }
};
