import type { LoadedTemplate } from "@proofseen/documents";
import { containsDirectContact } from "@proofseen/db";
import type { Lang } from "@/i18n/types";
import type { VaultDictionary } from "@/i18n/market/vault-fr";

/*
 * The choices of the parties for the service agreement (storyboard L1.6, §4 E2, T10): which fields the form shows, read
 * from the template's own declaration (type, labels, bounds, who it belongs to), and what the server keeps of a posted
 * form. The layout (which variable goes in which fieldset, in which order) is the storyboard's; everything a field says
 * comes from the template, never from a variable's name.
 *
 * Two rules that matter:
 *  - a field whose condition is not met is IGNORED, even if posted: a field hidden by CSS is still sent by the browser;
 *  - no radio, box or number is preselected for a value the template marks HYPOTHESIS.
 */

type Decl = LoadedTemplate["decl"];
type VariableDecl = Decl["variables"][string];
export type Owner = "common" | "client" | "provider";
export type Control = "radio" | "boolean" | "number" | "textarea" | "text";

/** When a field counts: another choice has one of these values, or an optional article is added. */
export type Condition = { readonly kind: "var"; readonly name: string; readonly values: readonly string[] } | { readonly kind: "clause"; readonly clause: string };

export interface FieldSpec {
  readonly name: string;
  /** The id of the control, or of the first radio of the group (the error summary links to it). */
  readonly id: string;
  readonly control: Control;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly min: number | null;
  readonly max: number | null;
  readonly maxLength: number | null;
  readonly required: boolean;
  readonly condition: Condition | null;
  readonly hint: string | null;
}

export interface ToggleSpec {
  readonly clause: string;
  readonly id: string;
  readonly label: string;
  readonly owner: Owner;
  readonly fields: readonly FieldSpec[];
}

export interface GroupSpec {
  readonly id: string;
  readonly legend: string;
  readonly owner: Owner;
  readonly fields: readonly FieldSpec[];
  readonly toggles: readonly ToggleSpec[];
  /** The fieldset shows only when this holds (CSS `:has`), and its fields are ignored otherwise. */
  readonly condition: Condition | null;
  /** « Seulement si … », shown where `:has()` is not supported. */
  readonly onlyIf: string | null;
}

type Legend = keyof VaultDictionary["prepare"]["legends"];
interface LayoutGroup {
  readonly id: string;
  readonly legend: Legend | "optional";
  readonly fields: readonly string[];
  readonly toggles?: readonly { readonly clause: string; readonly fields: readonly string[] }[];
  readonly onlyIf?: keyof VaultDictionary["prepare"]["onlyIfText"];
}

/** The storyboard's order (§4 E2): one fieldset per subject. */
const LAYOUT: readonly LayoutGroup[] = [
  { id: "work-mode", legend: "workMode", fields: ["input.workMode"] },
  { id: "ip-regime", legend: "ipRegime", fields: ["input.ipRegime"] },
  { id: "ip-rights", legend: "ipRights", fields: ["input.ipPurpose", "input.ipTerritory", "input.ipDurationYears"], onlyIf: "ipRights" },
  { id: "acceptance", legend: "acceptance", fields: ["input.acceptanceWindowDays"] },
  { id: "confidentiality", legend: "confidentiality", fields: ["input.confidentialityYears"] },
  { id: "personal-data", legend: "personalData", fields: ["input.processesPersonalData", "input.dpaDetails"] },
  { id: "subcontracting", legend: "subcontracting", fields: ["input.subcontractingAllowed"] },
  {
    id: "optional",
    legend: "optional",
    fields: [],
    toggles: [
      { clause: "insurance", fields: ["input.insurerName", "input.insurancePolicy"] },
      { clause: "non-solicitation", fields: ["input.nonSolicitationMonths"] },
      { clause: "reference", fields: [] },
    ],
  },
];

type HintKey = Exclude<keyof VaultDictionary["prepare"]["hints"], "onlyIf">;
const HINTS: Readonly<Record<string, HintKey>> = {
  "input.ipRegime": "ipRegime",
  "input.ipPurpose": "ipPurpose",
  "input.ipDurationYears": "ipDuration",
  "input.acceptanceWindowDays": "acceptanceWindow",
  "input.confidentialityYears": "confidentiality",
  "input.processesPersonalData": "personalData",
  "input.subcontractingAllowed": "subcontracting",
  "input.nonSolicitationMonths": "nonSolicitationMonths",
};
const TOGGLE_HINTS: Readonly<Record<string, HintKey>> = { insurance: "insurance", "non-solicitation": "nonSolicitation", reference: "reference" };

/** `input.ipDurationYears` becomes `f-ip-duration-years`. */
export const fieldId = (name: string): string => `f-${name.replace(/^input\./, "").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
export const clauseField = (clause: string): string => `clause.${clause}`;

const ownerOf = (roles: readonly string[] | undefined): Owner => {
  const set = new Set(roles ?? []);
  if (set.has("buyer") && set.has("seller")) return "common";
  return set.has("buyer") ? "client" : set.has("seller") ? "provider" : "common";
};

const toggleOwner = (by: string | undefined): Owner => (by === "buyer" ? "client" : by === "seller" ? "provider" : "common");

function conditionOf(decl: VariableDecl): Condition | null {
  const when = decl.requiredWhen;
  if (when === undefined) return null;
  if ("clause" in when) return when.included ? { kind: "clause", clause: when.clause } : null;
  if (when.in !== undefined) return { kind: "var", name: when.var, values: when.in.map(String) };
  if (when.eq !== undefined) return { kind: "var", name: when.var, values: [String(when.eq)] };
  return null;
}

const controlOf = (decl: VariableDecl): Control =>
  decl.type === "enum" ? "radio" : decl.type === "boolean" ? "boolean" : decl.type === "int" ? "number" : decl.type === "text" ? "textarea" : "text";

export type Billing = "fixed" | "monthly";

/** The template's label of a variable, or the label of the variant this contract has when the template's covers two. */
export function labelFor(name: string, decl: VariableDecl, lang: Lang, t: VaultDictionary["prepare"], billing: Billing | null): string {
  if (name === "input.acceptanceWindowDays" && billing === "fixed") return t.variantLabels.acceptanceWindowFixed;
  return (lang === "en" ? decl.label.en : undefined) ?? decl.label.fr;
}

function fieldOf(name: string, decl: VariableDecl, lang: Lang, t: VaultDictionary["prepare"], billing: Billing | null): FieldSpec {
  const labels = decl.labels?.[lang] ?? decl.labels?.fr ?? {};
  const hint = HINTS[name];
  return {
    name,
    id: fieldId(name),
    control: controlOf(decl),
    label: labelFor(name, decl, lang, t, billing),
    options: decl.type === "enum" ? (decl.values ?? []).map((value) => ({ value, label: labels[value] ?? value })) : [],
    min: decl.min ?? null,
    max: decl.max ?? null,
    maxLength: decl.maxLength ?? null,
    required: decl.required,
    condition: conditionOf(decl),
    hint: hint === undefined ? null : t.hints[hint],
  };
}

/** The fieldsets of the form, from the template's declaration; a variable the template does not declare is left out. */
export function choiceGroups(decl: Decl, lang: Lang, t: VaultDictionary["prepare"], billing: Billing | null = null): readonly GroupSpec[] {
  const field = (name: string): FieldSpec[] => {
    const variable = decl.variables[name];
    return variable === undefined || variable.source.kind !== "input" ? [] : [fieldOf(name, variable, lang, t, billing)];
  };
  return LAYOUT.map((group): GroupSpec => {
    const fields = group.fields.flatMap(field);
    const toggles = (group.toggles ?? []).flatMap((toggle): ToggleSpec[] => {
      const clause = decl.clauses.find((c) => c.id === toggle.clause && c.kind === "optional");
      const hint = TOGGLE_HINTS[toggle.clause];
      if (clause === undefined || hint === undefined) return [];
      return [{ clause: toggle.clause, id: fieldId(`clause-${toggle.clause}`), label: t.hints[hint], owner: toggleOwner(clause.toggledBy), fields: toggle.fields.flatMap(field) }];
    });
    const owners = new Set([...fields.map((f) => ownerOf(decl.variables[f.name]?.editableBy)), ...toggles.map((tg) => tg.owner)]);
    const owner: Owner = owners.size === 1 ? ([...owners][0] as Owner) : "common";
    const shared = fields.length > 0 && fields.every((f) => f.condition !== null) ? (fields[0] as FieldSpec).condition : null;
    return {
      id: group.id,
      legend: group.legend === "optional" ? t.optionalLegend : t.legends[group.legend],
      owner,
      fields,
      toggles,
      condition: shared,
      onlyIf: group.onlyIf === undefined ? null : t.onlyIfText[group.onlyIf],
    };
  }).filter((group) => group.fields.length > 0 || group.toggles.length > 0);
}

/** Every field of the form, the fields of the optional articles included. */
export const allFields = (groups: readonly GroupSpec[]): readonly FieldSpec[] => groups.flatMap((g) => [...g.fields, ...g.toggles.flatMap((tg) => tg.fields)]);

/** The legend of the fieldset that holds a variable: « Données personnelles » for `input.processesPersonalData`. */
export const legendOf = (groups: readonly GroupSpec[], name: string): string | null => groups.find((g) => [...g.fields, ...g.toggles.flatMap((tg) => tg.fields)].some((f) => f.name === name))?.legend ?? null;

export type ProblemKind = "choose" | "number" | "text" | "contact";
export interface Problem {
  readonly name: string;
  readonly kind: ProblemKind;
}

/** What was posted, as text, to put back in the form when it comes back with its errors. */
export type Draft = Readonly<Record<string, string>>;

export interface ReadChoices {
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly optionalClauses: Readonly<Record<string, "included" | "excluded">>;
  readonly draft: Draft;
  readonly problems: readonly Problem[];
}

const INT = /^[0-9]{1,4}$/;

function holds(condition: Condition | null, read: (name: string) => string | null): boolean {
  if (condition === null) return true;
  if (condition.kind === "clause") return read(clauseField(condition.clause)) === "included";
  const value = read(condition.name);
  return value !== null && condition.values.includes(value);
}

function parse(field: FieldSpec, raw: string): { readonly value: unknown } | { readonly problem: ProblemKind } {
  if (field.control === "radio") return field.options.some((o) => o.value === raw) ? { value: raw } : { problem: "choose" };
  if (field.control === "boolean") return raw === "true" ? { value: true } : raw === "false" ? { value: false } : { problem: "choose" };
  if (field.control === "number") {
    const n = INT.test(raw) ? Number(raw) : Number.NaN;
    return Number.isInteger(n) && (field.min === null || n >= field.min) && (field.max === null || n <= field.max) ? { value: n } : { problem: "number" };
  }
  if (field.maxLength !== null && raw.length > field.maxLength) return { problem: "text" };
  return containsDirectContact(raw) ? { problem: "contact" } : { value: raw };
}

/**
 * The choices of a posted form: each field parsed by its declaration, ignored when its condition does not hold, and a
 * problem for each field required now and missing or invalid. Nothing outside the declared fields is read.
 */
export function readChoices(groups: readonly GroupSpec[], get: (name: string) => string | null): ReadChoices {
  const read = (name: string): string | null => {
    const raw = get(name)?.trim() ?? "";
    return raw === "" ? null : raw;
  };
  const optionalClauses: Record<string, "included" | "excluded"> = {};
  const draft: Record<string, string> = {};
  for (const toggle of groups.flatMap((g) => g.toggles)) {
    const included = read(clauseField(toggle.clause)) === "included";
    optionalClauses[toggle.clause] = included ? "included" : "excluded";
    if (included) draft[clauseField(toggle.clause)] = "included";
  }
  const inputs: Record<string, unknown> = {};
  const problems: Problem[] = [];
  const readClause = (name: string): string | null => (name.startsWith("clause.") ? (optionalClauses[name.slice(7)] ?? null) : read(name));
  for (const field of allFields(groups)) {
    if (!holds(field.condition, readClause)) continue;
    const raw = read(field.name);
    if (raw !== null) draft[field.name] = raw;
    const required = field.required || field.condition !== null;
    if (raw === null) {
      if (required) problems.push({ name: field.name, kind: field.control === "number" ? "number" : field.control === "textarea" || field.control === "text" ? "text" : "choose" });
      continue;
    }
    const parsed = parse(field, raw);
    if ("problem" in parsed) problems.push({ name: field.name, kind: parsed.problem });
    else inputs[field.name] = parsed.value;
  }
  return { inputs, optionalClauses, draft, problems };
}

/**
 * The values a form starts with: those of the current version (its frozen choices) for a version 2 and later, else the
 * template's defaults that are decisions, never an HYPOTHESIS default (§4 E2: « Une case ou un bouton radio n'est
 * jamais présélectionné pour une valeur que le gabarit marque HYPOTHÈSE »).
 */
export function initialDraft(decl: Decl, groups: readonly GroupSpec[], current: { readonly values: Readonly<Record<string, unknown>>; readonly optionalClauses: Readonly<Record<string, string>> } | null): Draft {
  const draft: Record<string, string> = {};
  for (const field of allFields(groups)) {
    const variable = decl.variables[field.name];
    const value = current === null ? (variable?.defaultStatus === "HYPOTHESIS" ? undefined : variable?.default) : current.values[field.name];
    if (value !== undefined && value !== null && typeof value !== "object") draft[field.name] = String(value);
  }
  for (const toggle of groups.flatMap((g) => g.toggles)) if (current?.optionalClauses[toggle.clause] === "included") draft[clauseField(toggle.clause)] = "included";
  return draft;
}

/** The problems the engine named (409 « gabarit incomplet », `missing`), as fields of the form or as facts of the contract. */
export function engineProblems(groups: readonly GroupSpec[], missing: readonly string[]): { readonly fields: readonly Problem[]; readonly facts: readonly string[] } {
  const byName = new Map(allFields(groups).map((field) => [field.name, field]));
  const fields: Problem[] = [];
  const facts: string[] = [];
  for (const name of missing) {
    const field = byName.get(name);
    if (field === undefined) facts.push(name);
    else fields.push({ name, kind: field.control === "number" ? "number" : field.control === "textarea" || field.control === "text" ? "text" : "choose" });
  }
  return { fields, facts };
}
