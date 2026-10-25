import type { DocumentModel, LoadedTemplate } from "@proofseen/documents";
import type { Lang } from "@/i18n/types";
import type { VaultDictionary } from "@/i18n/market/vault-fr";
import type { Comparison } from "./compare";

/*
 * « En bref », the comparison that speaks (storyboard L1.6, §4 E5, T7): one sentence per changed choice, computed from
 * the frozen values of the two versions and the template's own declaration, without any language model. Each sentence
 * has one of the forms of the storyboard's table; nothing is invented:
 *  - a choice from a list says its two labels, from the template;
 *  - a number says its unit, read from the label of the template (« …, en jours »);
 *  - free text only says that it changed and in which article;
 *  - an optional article added or removed is said by its heading; a conditional one says which choice it follows;
 *  - a new version of the Proofseen template says how many articles it rewrote.
 * The lines « Pour vous » and « Pour le Client » come only from a table written by the Trésor in the template (L1-132):
 * until it exists, only the neutral sentence is shown.
 * Facts of the contract (`contract.*`, `seller`) are frozen at its creation and the number and date of issue
 * (`document.*`) always differ: neither is ever a change.
 */

type Decl = LoadedTemplate["decl"];
type VariableDecl = Decl["variables"][string];

export interface VersionFacts {
  readonly number: number;
  readonly templateVersion: number;
  readonly values: Readonly<Record<string, unknown>>;
  readonly optionalClauses: Readonly<Record<string, string>>;
  readonly model: DocumentModel;
}

/** What a change means for each party, from the template (`explain`, L1-132); `{n}` is the new value. */
export interface PartyLines {
  readonly provider?: string;
  readonly client?: string;
  readonly both?: string;
}
export type ExplainTable = Readonly<Record<string, Readonly<Record<string, PartyLines>>>>;

export type ChangeKind = "choice" | "number" | "boolean" | "text" | "clause-added" | "clause-removed" | "model";

export interface Change {
  readonly kind: ChangeKind;
  /** The key attribution reads (attribution.ts); null for a change of the template, which no party made. */
  readonly key: string | null;
  readonly sentence: string;
  /** The clause the change is read in, for the link and the order. */
  readonly clause: string | null;
  readonly parties: PartyLines | null;
}

export interface Explanation {
  readonly changes: readonly Change[];
  /** Clauses rewritten by a new version of the template, none of whose choices changed: « Modifiée par le modèle ». */
  readonly byModel: ReadonlySet<string>;
}

export interface ExplainArgs {
  readonly lang: Lang;
  readonly template: LoadedTemplate;
  readonly older: VersionFacts;
  readonly newer: VersionFacts;
  readonly comparison: Comparison;
  readonly t: VaultDictionary["compare"];
  /** The legend of the fieldset of a choice, for « (suit le choix Données personnelles) ». */
  readonly legendOf: (name: string) => string | null;
  readonly table?: ExplainTable;
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

/** The variables a clause reads: in its declaration (variant, condition, requirements) and in its texts. */
export function clauseVariables(template: LoadedTemplate, lang: Lang, id: string): ReadonlySet<string> {
  const names = new Set<string>();
  const decl = template.decl.clauses.find((clause) => clause.id === id);
  if (decl !== undefined) {
    if (decl.variantBy !== undefined) names.add(decl.variantBy);
    for (const name of decl.requires ?? []) names.add(name);
    for (const list of Object.values(decl.variantRequires ?? {})) for (const name of list) names.add(name);
    if (decl.when !== undefined && "var" in decl.when) names.add(decl.when.var);
  }
  const text = template.texts[lang]?.clauses[id];
  const all = [text?.heading ?? "", text?.body ?? "", ...Object.values(text?.variants ?? {})].join("\n");
  for (const match of all.matchAll(PLACEHOLDER)) names.add(match[1] as string);
  return names;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const labelOf = (decl: VariableDecl, lang: Lang): string => (lang === "en" ? decl.label.en : undefined) ?? decl.label.fr;

type Unit = "days" | "months" | "years";
/** « Délai de recette ou de validation du relevé, en jours » is the label « Délai de recette ou de validation du relevé » and the unit days. */
export function splitUnit(label: string, suffix: VaultDictionary["compare"]["units"]["suffix"]): { readonly label: string; readonly unit: Unit | null } {
  for (const unit of ["days", "months", "years"] as const) if (label.endsWith(suffix[unit])) return { label: label.slice(0, -suffix[unit].length), unit };
  return { label, unit: null };
}

function sentenceFor(name: string, decl: VariableDecl, before: unknown, after: unknown, args: ExplainArgs, heading: string | null): { readonly kind: ChangeKind; readonly sentence: string } {
  const { lang, t } = args;
  const label = labelOf(decl, lang);
  const unset = t.phrase.unset;
  if (decl.type === "enum") {
    const labels = decl.labels?.[lang] ?? decl.labels?.fr ?? {};
    const say = (value: unknown) => (value === undefined || value === null ? unset : (labels[String(value)] ?? String(value)));
    return { kind: "choice", sentence: t.phrase.choice(label, say(before), say(after)) };
  }
  if (decl.type === "boolean" && typeof before === "boolean" && typeof after === "boolean") return { kind: "boolean", sentence: t.phrase.boolean(label, before, after) };
  if (decl.type === "int") {
    const split = splitUnit(label, t.units.suffix);
    const say = (value: unknown) => (typeof value !== "number" ? unset : split.unit === null ? String(value) : `${value} ${t.units[split.unit](value)}`);
    return { kind: "number", sentence: t.phrase.number(split.label, say(before), say(after)) };
  }
  return { kind: "text", sentence: t.phrase.text(label, heading ?? label) };
}

function partyLines(table: ExplainTable | undefined, key: string, after: unknown): PartyLines | null {
  const row = table?.[key];
  if (row === undefined) return null;
  const lines = row[String(after)] ?? row["*"];
  if (lines === undefined) return null;
  const fill = (key: keyof PartyLines) => (lines[key] === undefined ? {} : { [key]: (lines[key] as string).replace(/\{n\}/g, String(after)) });
  return { ...fill("provider"), ...fill("client"), ...fill("both") };
}

export function explainChanges(args: ExplainArgs): Explanation {
  const { lang, template, older, newer, comparison, t } = args;
  const decl = template.decl;
  const order = new Map(comparison.clauses.map((diff, index) => [diff.clause.id, index]));
  const heading = (id: string | null) => (id === null ? null : (comparison.clauses.find((diff) => diff.clause.id === id)?.clause.heading ?? null));
  const changedClauses = new Set(comparison.clauses.filter((diff) => diff.kind !== "identical").map((diff) => diff.clause.id));
  const clauseOrder = comparison.clauses.map((diff) => diff.clause.id);
  const varsOf = new Map(clauseOrder.map((id) => [id, clauseVariables(template, lang, id)]));
  const anchorOf = (name: string): string | null => clauseOrder.find((id) => changedClauses.has(id) && varsOf.get(id)?.has(name)) ?? clauseOrder.find((id) => varsOf.get(id)?.has(name)) ?? null;
  // A choice required only by an article added or removed is said by that article, not twice.
  const addedOrRemoved = comparison.clauses.filter((diff) => diff.kind === "added" || diff.kind === "removed").map((diff) => diff.clause.id);
  const requiredByMoved = new Set(addedOrRemoved.flatMap((id) => decl.clauses.find((c) => c.id === id)?.requires ?? []));

  const changes: { readonly change: Change; readonly at: number }[] = [];
  const changedNames = new Set<string>();
  const names = [...new Set([...Object.keys(older.values), ...Object.keys(newer.values)])];
  for (const name of names) {
    const variable = decl.variables[name];
    if (variable === undefined || variable.source.kind !== "input" || name.startsWith("document.")) continue;
    if (same(older.values[name], newer.values[name])) continue;
    changedNames.add(name);
    if (requiredByMoved.has(name)) continue;
    const clause = anchorOf(name);
    const { kind, sentence } = sentenceFor(name, variable, older.values[name], newer.values[name], args, heading(clause));
    changes.push({ change: { kind, key: name, sentence, clause, parties: partyLines(args.table, name, newer.values[name]) }, at: clause === null ? Number.MAX_SAFE_INTEGER : (order.get(clause) ?? 0) });
  }
  for (const diff of comparison.clauses) {
    if (diff.kind !== "added" && diff.kind !== "removed") continue;
    const clauseDecl = decl.clauses.find((c) => c.id === diff.clause.id);
    const when = clauseDecl?.when !== undefined && "var" in clauseDecl.when ? clauseDecl.when.var : null;
    const follows = when === null ? null : args.legendOf(when);
    const base = diff.kind === "added" ? t.phrase.clauseAdded(diff.clause.heading) : t.phrase.clauseRemoved(diff.clause.heading);
    const sentence = follows === null ? base : `${base.slice(0, -1)}${t.phrase.follows(follows)}.`;
    const key = clauseDecl?.kind === "optional" ? `clause:${diff.clause.id}` : when;
    const parties = partyLines(args.table, `clause:${diff.clause.id}`, diff.kind === "added" ? "included" : "excluded");
    changes.push({ change: { kind: diff.kind === "added" ? "clause-added" : "clause-removed", key, sentence, clause: diff.clause.id, parties }, at: order.get(diff.clause.id) ?? 0 });
  }
  const byModel = new Set<string>();
  if (older.templateVersion !== newer.templateVersion) {
    for (const diff of comparison.clauses) {
      if (diff.kind !== "modified") continue;
      const reads = varsOf.get(diff.clause.id) ?? new Set<string>();
      if (![...reads].some((name) => changedNames.has(name))) byModel.add(diff.clause.id);
    }
    changes.push({ change: { kind: "model", key: null, sentence: t.phrase.model(String(older.templateVersion), String(newer.templateVersion), byModel.size), clause: null, parties: null }, at: -1 });
  }
  return { changes: [...changes].sort((a, b) => a.at - b.at).map((entry) => entry.change), byModel };
}
