import type { Condition, LeafCondition } from "./schema";

/*
 * Évaluation des conditions `when` et `requiredWhen` (TEMPLATE_FORMAT.md §3.4). Aucun effet de bord. Une condition qui lit
 * une variable absente ne rend jamais « faux » : elle lève `UnresolvableCondition`, parce qu'une clause de vigilance ne
 * doit pas disparaître d'un contrat à cause d'une donnée manquante. Seul `present` lit une variable facultative.
 */

/** Lit la valeur résolue d'une variable ; `undefined` quand elle est absente. */
export type Lookup = (name: string) => unknown;

export class UnresolvableCondition extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(`condition unresolvable: ${variable}`);
    this.name = "UnresolvableCondition";
    this.variable = variable;
  }
}

const isLeaf = (condition: Condition): condition is LeafCondition => "var" in condition;

const asNumber = (variable: string, value: unknown): number => {
  if (typeof value !== "number") throw new UnresolvableCondition(variable);
  return value;
};

/** Évalue une feuille (une variable, un opérateur). */
export const evaluateLeaf = (leaf: LeafCondition, get: Lookup): boolean => {
  const value = get(leaf.var);
  if (leaf.present !== undefined) return (value !== undefined) === leaf.present;
  if (value === undefined) throw new UnresolvableCondition(leaf.var);
  if (leaf.eq !== undefined) return value === leaf.eq;
  if (leaf.neq !== undefined) return value !== leaf.neq;
  if (leaf.in !== undefined) return leaf.in.includes(value as string | number | boolean);
  if (leaf.gte !== undefined) return asNumber(leaf.var, value) >= leaf.gte;
  return asNumber(leaf.var, value) <= (leaf.lte ?? Number.NaN);
};

export const evaluateCondition = (condition: Condition, get: Lookup): boolean => {
  if (isLeaf(condition)) return evaluateLeaf(condition, get);
  if ("all" in condition) return condition.all.every((c) => evaluateCondition(c, get));
  if ("any" in condition) return condition.any.some((c) => evaluateCondition(c, get));
  return !evaluateCondition(condition.not, get);
};

/** Toutes les feuilles d'une condition, pour les contrôles de cohérence (variable déclarée, variable gardée). */
export const leavesOf = (condition: Condition | undefined): readonly LeafCondition[] => {
  if (condition === undefined) return [];
  if (isLeaf(condition)) return [condition];
  if ("all" in condition) return condition.all.flatMap(leavesOf);
  if ("any" in condition) return condition.any.flatMap(leavesOf);
  return leavesOf(condition.not);
};
