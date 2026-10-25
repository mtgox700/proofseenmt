import { evaluateCondition, evaluateLeaf, UnresolvableCondition } from "./conditions";
import { fail, ok, type Result } from "./errors";
import type { ClauseDecl, TemplateDecl } from "./schema";
import type { Values } from "./variables";

/*
 * Choix des clauses d'un rendu : quelles clauses sont retenues (verrouillée toujours, conditionnelle selon les données,
 * optionnelle selon les parties), avec quelle variante, sous quelles décisions du founder, et avec quelles variables
 * exigées par le choix. L'ordre des contrôles est celui du format : une décision non prise (`decision_pending`) est
 * signalée avant une donnée manquante qu'elle explique.
 */

export type ClauseChoice = "included" | "excluded";

export interface Selected {
  readonly clause: ClauseDecl;
  readonly variant: string | null;
}

/** Les parties ne peuvent que retenir ou retirer une clause optionnelle : le reste est décidé par le gabarit et les données. */
export const checkOptionalClauses = (decl: TemplateDecl, choices: Readonly<Record<string, ClauseChoice>>): Result<null> => {
  for (const [id, choice] of Object.entries(choices)) {
    const clause = decl.clauses.find((c) => c.id === id);
    if (clause === undefined) return fail("unknown_clause", `clause inconnue : ${id}`, { clause: id });
    if (clause.kind !== "optional" && choice === "excluded") {
      return fail("locked_clause_removed", `la clause ${id} est ${clause.kind === "locked" ? "verrouillée" : "conditionnelle"} : aucune partie ne la retire`, { clause: id });
    }
    if (clause.kind !== "optional") return fail("unknown_clause", `la clause ${id} n'est pas optionnelle : elle ne se retient pas par choix`, { clause: id });
  }
  return ok(null);
};

const isIncluded = (clause: ClauseDecl, values: Values, choices: Readonly<Record<string, ClauseChoice>>): boolean => {
  if (clause.kind === "locked") return true;
  if (clause.kind === "conditional") return clause.when === undefined ? false : evaluateCondition(clause.when, (name) => values[name]);
  return (choices[clause.id] ?? clause.default) === "included";
};

const variantOf = (clause: ClauseDecl, decl: TemplateDecl, values: Values): Result<string | null> => {
  if (clause.variantBy === undefined) return ok(null);
  const value = values[clause.variantBy];
  if (value === undefined) {
    const source = decl.variables[clause.variantBy]?.source;
    const gate = source?.kind === "pending" ? (clause.gates ?? []).find((g) => g.decision === source.request) : undefined;
    if (gate !== undefined) return fail("decision_pending", `la décision ${gate.decision} du founder n'est pas prise`, { clause: clause.id, decision: gate.decision, variables: [clause.variantBy] });
    return fail("missing_variable", `variable manquante pour choisir la variante de ${clause.id} : ${clause.variantBy}`, { clause: clause.id, variables: [clause.variantBy] });
  }
  const variant = String(value);
  const gate = (clause.gates ?? []).find((g) => g.variant === variant);
  if (gate !== undefined) return fail("decision_pending", `la variante ${variant} de ${clause.id} attend la décision ${gate.decision} du founder`, { clause: clause.id, decision: gate.decision });
  return ok(variant);
};

/** Les clauses retenues, dans l'ordre du gabarit, avec leur variante. */
export const selectClauses = (decl: TemplateDecl, values: Values, choices: Readonly<Record<string, ClauseChoice>>): Result<readonly Selected[]> => {
  const selected: Selected[] = [];
  for (const clause of decl.clauses) {
    try {
      if (!isIncluded(clause, values, choices)) continue;
    } catch (error) {
      if (!(error instanceof UnresolvableCondition)) throw error;
      return fail("condition_unresolvable", `la condition de ${clause.id} lit ${error.variable}, qui n'a pas de valeur`, { clause: clause.id, variables: [error.variable] });
    }
    const variant = variantOf(clause, decl, values);
    if (!variant.ok) return variant;
    selected.push({ clause, variant: variant.value });
  }
  return ok(selected);
};

const requiredByCondition = (decl: TemplateDecl, values: Values, ids: ReadonlySet<string>): Result<readonly string[]> => {
  const needed: string[] = [];
  for (const [name, variable] of Object.entries(decl.variables)) {
    const when = variable.requiredWhen;
    if (when === undefined || values[name] !== undefined) continue;
    try {
      const applies = "clause" in when ? ids.has(when.clause) === when.included : evaluateLeaf(when, (n) => values[n]);
      if (applies) needed.push(name);
    } catch (error) {
      if (!(error instanceof UnresolvableCondition)) throw error;
      return fail("condition_unresolvable", `l'obligation de ${name} lit ${error.variable}, qui n'a pas de valeur`, { variables: [name, error.variable] });
    }
  }
  return ok(needed);
};

/**
 * Variables qu'exigent les clauses retenues (`requires`, `variantRequires`) et les conditions `requiredWhen`, qu'elles
 * aient une valeur ou non : l'appelant complète par les défauts déclarés (variables.ts, `completeForSelection`).
 */
export const requiredBySelection = (decl: TemplateDecl, values: Values, selected: readonly Selected[]): Result<readonly string[]> => {
  const ids = new Set(selected.map((s) => s.clause.id));
  const byCondition = requiredByCondition(decl, values, ids);
  if (!byCondition.ok) return byCondition;
  const byClause = selected.flatMap(({ clause, variant }) => [...(clause.requires ?? []), ...(variant === null ? [] : (clause.variantRequires?.[variant] ?? []))]);
  return ok([...new Set([...byCondition.value, ...byClause])]);
};
