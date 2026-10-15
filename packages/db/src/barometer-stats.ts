/*
 * Les statistiques des baromètres, pures et testables sans base : quartiles, regroupement, seuil d'effectif.
 *
 * Méthode des quartiles : interpolation linéaire entre les rangs (la méthode 7 de Hyndman et Fan, celle de
 * PERCENTILE.INC des tableurs et de numpy par défaut). Un groupe sous MIN_BAROMETER_SAMPLE valeurs ne sort pas : sur
 * trois TJM, une « médiane » désignerait presque des personnes et ne décrirait rien.
 */

export const MIN_BAROMETER_SAMPLE = 10;

export interface RateStat {
  readonly key: string;
  readonly label: string;
  /** Nombre de valeurs du groupe : toujours publié avec la statistique. */
  readonly n: number;
  readonly p25Cents: number;
  readonly medianCents: number;
  readonly p75Cents: number;
}

/** Le quantile q (entre 0 et 1) d'une liste triée par ordre croissant, par interpolation linéaire. */
export const quantile = (sorted: readonly number[], q: number): number => {
  if (sorted.length === 0) throw new RangeError("quantile d'une liste vide");
  const position = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const below = Math.floor(position);
  const low = sorted[below] ?? 0;
  const high = sorted[Math.min(below + 1, sorted.length - 1)] ?? low;
  return low + (high - low) * (position - below);
};

/** Arrondi à l'euro : une précision au centime serait une fausse précision. */
const toEuro = (cents: number): number => Math.round(cents / 100) * 100;

/** Les statistiques d'un groupe, ou `null` sous le seuil d'effectif. */
export const rateStat = (key: string, label: string, values: readonly number[], minSample = MIN_BAROMETER_SAMPLE): RateStat | null => {
  if (values.length < minSample) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return { key, label, n: sorted.length, p25Cents: toEuro(quantile(sorted, 0.25)), medianCents: toEuro(quantile(sorted, 0.5)), p75Cents: toEuro(quantile(sorted, 0.75)) };
};

export interface Observation {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

/**
 * Regroupe des observations par clé et ne garde que les groupes qui atteignent le seuil, par ordre alphabétique du
 * libellé : un ordre neutre. Le libellé d'un groupe est le premier rencontré pour sa clé.
 */
export const groupStats = (observations: readonly Observation[], minSample = MIN_BAROMETER_SAMPLE): readonly RateStat[] => {
  const groups = new Map<string, { readonly label: string; readonly values: number[] }>();
  for (const { key, label, value } of observations) {
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { label, values: [value] });
    else group.values.push(value);
  }
  return [...groups.entries()]
    .flatMap(([key, { label, values }]) => rateStat(key, label, values, minSample) ?? [])
    .sort((a, b) => a.label.localeCompare(b.label, "fr") || a.key.localeCompare(b.key));
};

/** Le TJM d'une mission : le milieu de sa fourchette, ou la seule borne donnée ; `null` sans aucune. */
export const missionRate = (minCents: number | null, maxCents: number | null): number | null => {
  if (minCents !== null && maxCents !== null) return Math.round((minCents + maxCents) / 2);
  return minCents ?? maxCents;
};
