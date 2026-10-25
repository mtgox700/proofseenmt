import { derive, isPureDerivation } from "./derive";
import { fail, ok, type Result } from "./errors";
import { isIsoDate } from "./format";
import type { ResolvedVariable } from "./model";
import type { TemplateDecl, VariableDecl } from "./schema";
import { freeTextsOf, isAbsent, validatorFor } from "./validate";

/*
 * Résolution des variables d'un rendu : ce que l'appelant fournit, validé à la frontière, plus ce que le moteur sait
 * calculer (`derived` pur) et les valeurs par défaut déclarées. Une valeur fournie ne l'emporte jamais sur un calcul pur
 * qui la contredit. Rend toutes les erreurs d'une même catégorie, pas la première seule.
 */

export interface ResolveOptions {
  /** Détecteur de coordonnées (packages/db `containsDirectContact`) : rend le motif de refus, ou null. */
  readonly rejectContact?: ((text: string) => string | null) | undefined;
  /** Refuse les valeurs par défaut qui ne sont que des HYPOTHESES (rendu réel, pas rendu de test). */
  readonly refuseHypothesisDefaults?: boolean | undefined;
}

export type Values = Readonly<Record<string, unknown>>;

export interface Resolved {
  readonly values: Values;
  readonly variables: Readonly<Record<string, ResolvedVariable>>;
  readonly hypotheses: readonly string[];
}

/** La date d'émission existe pour tout gabarit, déclarée ou non : elle décide de la validité des sources. */
export const ISSUED_ON = "document.issuedOn";

interface Issue {
  readonly name: string;
  readonly reason: string;
}

const entriesOf = (decl: TemplateDecl): readonly (readonly [string, VariableDecl])[] => Object.entries(decl.variables);

const validateSupplied = (decl: TemplateDecl, supplied: Values, options: ResolveOptions): { readonly values: Values; readonly issues: readonly Issue[] } => {
  const issues: Issue[] = Object.keys(supplied)
    .filter((name) => decl.variables[name] === undefined && name !== ISSUED_ON)
    .map((name) => ({ name, reason: "variable inconnue de ce gabarit" }));
  const parsed = entriesOf(decl).flatMap(([name, variable]): readonly (readonly [string, unknown])[] => {
    const raw = supplied[name];
    if (isAbsent(raw)) return [];
    const result = validatorFor(variable).safeParse(raw);
    if (!result.success) {
      issues.push({ name, reason: result.error.issues.map((issue) => issue.message).join(" ; ") });
      return [];
    }
    for (const text of freeTextsOf(variable, result.data)) {
      const reason = options.rejectContact?.(text) ?? null;
      if (reason !== null) issues.push({ name, reason });
    }
    return [[name, result.data]];
  });
  const issued = supplied[ISSUED_ON];
  const extra = decl.variables[ISSUED_ON] === undefined && typeof issued === "string" && isIsoDate(issued) ? [[ISSUED_ON, issued] as const] : [];
  return { values: Object.fromEntries([...parsed, ...extra]), issues };
};

/** Calcule les `derived` purs, en plusieurs passes quand l'un dépend de l'autre ; refuse une valeur fournie qui diffère. */
const applyDerivations = (decl: TemplateDecl, start: Values): { readonly values: Values; readonly derived: readonly string[]; readonly issues: readonly Issue[] } => {
  const pure = entriesOf(decl).filter(([, v]) => v.source.kind === "derived" && isPureDerivation(v.source.fn));
  let values = start;
  const derived: string[] = [];
  const issues: Issue[] = [];
  for (let pass = 0; pass < pure.length; pass += 1) {
    for (const [name, variable] of pure.filter(([n]) => !derived.includes(n))) {
      if (variable.source.kind !== "derived") continue;
      const computed = derive(variable.source.fn, variable.source.from.map((dep) => values[dep]));
      if (computed === undefined) continue;
      if (values[name] !== undefined && values[name] !== computed) issues.push({ name, reason: `diffère du calcul (${variable.source.fn}) : attendu ${String(computed)}, reçu ${String(values[name])}` });
      values = { ...values, [name]: computed };
      derived.push(name);
    }
  }
  return { values, derived, issues };
};

interface Defaults {
  readonly values: Values;
  readonly defaulted: readonly string[];
  readonly hypotheses: readonly string[];
  readonly issues: readonly Issue[];
}

/** Valeurs par défaut des seules variables `names` (celles que le document exige) ; jamais pour une variable inutilisée. */
const defaultsFor = (decl: TemplateDecl, values: Values, names: readonly string[], options: ResolveOptions): Defaults => {
  const applicable = entriesOf(decl).filter(
    ([name, v]) => names.includes(name) && values[name] === undefined && v.default !== undefined && !(options.refuseHypothesisDefaults === true && v.defaultStatus === "HYPOTHESIS"),
  );
  const issues: Issue[] = [];
  const taken = applicable.filter(([name, variable]) => {
    const check = validatorFor(variable).safeParse(variable.default);
    if (!check.success) issues.push({ name, reason: `valeur par défaut invalide : ${check.error.issues.map((i) => i.message).join(" ; ")}` });
    return check.success;
  });
  return {
    values: { ...values, ...Object.fromEntries(taken.map(([name, variable]) => [name, variable.default])) },
    defaulted: taken.map(([name]) => name),
    hypotheses: taken.filter(([, variable]) => variable.defaultStatus === "HYPOTHESIS").map(([name]) => name),
    issues,
  };
};

const describeIssues = (issues: readonly Issue[]): string => issues.map((issue) => `${issue.name} : ${issue.reason}`).join(" | ");

/** Les variables obligatoires sans valeur, et la devise absente d'un montant présent. */
export const requiredMissing = (decl: TemplateDecl, values: Values): readonly string[] => {
  const unconditional = entriesOf(decl).filter(([name, v]) => v.required && values[name] === undefined).map(([name]) => name);
  const currencies = entriesOf(decl)
    .filter(([name, v]) => v.type === "money" && values[name] !== undefined && typeof v.currency === "string" && values[v.currency] === undefined)
    .map(([, v]) => v.currency as string);
  return [...new Set([...unconditional, ...currencies])];
};

export const describeMissing = (decl: TemplateDecl, names: readonly string[]): string =>
  names
    .map((name) => {
      const source = decl.variables[name]?.source;
      return source?.kind === "pending" ? `${name} (colonne ou saisie manquante, ${source.request})` : name;
    })
    .join(", ");

/** D'où vient chaque valeur : saisie, calcul du moteur ou défaut du gabarit. Une valeur déjà connue garde son origine. */
const withOrigins = (
  values: Values,
  known: Readonly<Record<string, ResolvedVariable>>,
  derived: readonly string[],
  defaulted: readonly string[],
): Readonly<Record<string, ResolvedVariable>> =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]): [string, ResolvedVariable] => {
      const origin = derived.includes(name) ? "derived" : defaulted.includes(name) ? "default" : "input";
      return [name, known[name] ?? { value, origin }];
    }),
  );

/** Valide ce que l'appelant fournit, calcule les dérivés purs, applique les défauts des variables toujours obligatoires. */
export const resolveVariables = (decl: TemplateDecl, supplied: Values, options: ResolveOptions): Result<Resolved> => {
  const checked = validateSupplied(decl, supplied, options);
  const derivations = applyDerivations(decl, checked.values);
  const alwaysRequired = entriesOf(decl).filter(([, v]) => v.required).map(([name]) => name);
  const defaults = defaultsFor(decl, derivations.values, alwaysRequired, options);
  const issues = [...checked.issues, ...derivations.issues, ...defaults.issues];
  if (issues.length > 0) return fail("invalid_variable", describeIssues(issues), { variables: issues.map((i) => i.name) });
  const missing = requiredMissing(decl, defaults.values);
  if (missing.length > 0) return fail("missing_variable", `variables manquantes : ${describeMissing(decl, missing)}`, { variables: missing });
  return ok({ values: defaults.values, variables: withOrigins(defaults.values, {}, derivations.derived, defaults.defaulted), hypotheses: defaults.hypotheses });
};

/**
 * Les variables que le choix des clauses a rendues obligatoires : on prend leur valeur par défaut déclarée (ce n'est
 * alors une HYPOTHESE listée qu'à cet endroit), sinon elles manquent.
 */
export const completeForSelection = (decl: TemplateDecl, resolved: Resolved, needed: readonly string[], options: ResolveOptions): Result<Resolved> => {
  const defaults = defaultsFor(decl, resolved.values, needed, options);
  if (defaults.issues.length > 0) return fail("invalid_variable", describeIssues(defaults.issues), { variables: defaults.issues.map((i) => i.name) });
  const missing = needed.filter((name) => defaults.values[name] === undefined);
  if (missing.length > 0) return fail("missing_variable", `variables manquantes : ${describeMissing(decl, missing)}`, { variables: missing });
  return ok({
    values: defaults.values,
    variables: withOrigins(defaults.values, resolved.variables, [], defaults.defaulted),
    hypotheses: [...resolved.hypotheses, ...defaults.hypotheses],
  });
};
