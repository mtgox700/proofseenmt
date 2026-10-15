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

/*
 * Règle des entreprises distinctes, pour tout groupe tiré des missions : au moins MIN_DISTINCT_PUBLISHERS entreprises
 * dans le groupe, et chacune y pèse au plus MAX_VALUES_PER_PUBLISHER valeurs, ses plus récentes. Une entreprise qui
 * publie douze missions ne fixe pas seule la « médiane du marché » et ne rend pas seule une compétence « demandée ».
 */
export const MIN_DISTINCT_PUBLISHERS = 3;
export const MAX_VALUES_PER_PUBLISHER = 3;

export interface Published {
  /** L'entreprise qui a publié la mission. */
  readonly publisher: string;
  readonly at: Date;
}

export interface PublishedObservation extends Observation, Published {}

/** Les éléments retenus d'un groupe (au plus trois par entreprise, les plus récents), ou `null` sous trois entreprises. */
export const cappedByPublisher = <T extends Published>(items: readonly T[]): readonly T[] | null => {
  const byPublisher = new Map<string, T[]>();
  for (const item of items) {
    const own = byPublisher.get(item.publisher);
    if (own === undefined) byPublisher.set(item.publisher, [item]);
    else own.push(item);
  }
  if (byPublisher.size < MIN_DISTINCT_PUBLISHERS) return null;
  return [...byPublisher.values()].flatMap((own) => [...own].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, MAX_VALUES_PER_PUBLISHER));
};

/** Les statistiques d'un groupe de missions, ou `null` sous la règle des entreprises distinctes ou sous le seuil d'effectif. */
export const publisherRateStat = (key: string, label: string, observations: readonly (Published & { readonly value: number })[], minSample = MIN_BAROMETER_SAMPLE): RateStat | null => {
  const kept = cappedByPublisher(observations);
  return kept === null ? null : rateStat(key, label, kept.map((o) => o.value), minSample);
};

/** Comme `groupStats`, pour des missions : chaque groupe passe d'abord la règle des entreprises distinctes. */
export const publisherGroupStats = (observations: readonly PublishedObservation[], minSample = MIN_BAROMETER_SAMPLE): readonly RateStat[] => {
  const groups = new Map<string, PublishedObservation[]>();
  for (const observation of observations) {
    const group = groups.get(observation.key);
    if (group === undefined) groups.set(observation.key, [observation]);
    else group.push(observation);
  }
  return [...groups.entries()]
    .flatMap(([key, group]) => publisherRateStat(key, group[0]?.label ?? key, group, minSample) ?? [])
    .sort((a, b) => a.label.localeCompare(b.label, "fr") || a.key.localeCompare(b.key));
};

/** Le TJM d'une mission : le milieu de sa fourchette, ou la seule borne donnée ; `null` sans aucune. */
export const missionRate = (minCents: number | null, maxCents: number | null): number | null => {
  if (minCents !== null && maxCents !== null) return Math.round((minCents + maxCents) / 2);
  return minCents ?? maxCents;
};
