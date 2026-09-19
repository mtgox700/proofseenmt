/**
 * Pure data and maths of the hero simulator (a FICTITIOUS measurement, labelled as such on the page). Shared by the
 * server render (final state) and the client animation, so both always show the same numbers. No DOM: unit-tested.
 */

/** Rank of "you" in the top 5 of each fictitious answer (null = outside). 30 answers, 11 in the top 5; the last one is a hit
 *  so the static (no-JS / reduced-motion) render shows "you" in the list. */
export const RUNS: readonly (number | null)[] = [
  4, null, null, 2, null, 5, null, null, 3, null, null, 1, null, 4, null,
  null, null, 2, null, 5, null, null, 3, null, null, null, 4, null, null, 2,
];

/** Fictitious competing profiles (initials, skill, city): never real people. */
export const POOL: readonly string[] = [
  "C. R. · Fullstack TS · Lyon",
  "M. D. · Node / React · Paris",
  "S. B. · TypeScript · Remote",
  "A. L. · Fullstack JS · Nantes",
  "J. K. · React / Next · Paris",
  "N. F. · Node.js · Lille",
  "É. P. · Fullstack · Bordeaux",
  "Y. H. · TS / GraphQL · Remote",
];

export const TOP = 5;

export interface Interval {
  readonly p: number;
  readonly lo: number;
  readonly hi: number;
}

/** Wilson score interval (95 % by default): honest bounds even with few answers, never outside [0, 1]. */
export const wilson = (hits: number, n: number, z = 1.96): Interval => {
  if (!Number.isInteger(hits) || !Number.isInteger(n) || n <= 0 || hits < 0 || hits > n) return { p: 0, lo: 0, hi: 1 };
  const p = hits / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
};

/** Hits among the first `count` answers. */
export const hitsUpTo = (count: number): number => RUNS.slice(0, count).filter((r) => r !== null).length;

/**
 * The 5 names of answer `run`: "you" (null) at its rank, the others rotate through the pool so every answer differs.
 * Returns pool indexes, with -1 standing for "you".
 */
export const shortlist = (run: number): readonly number[] => {
  const rank = RUNS[((run % RUNS.length) + RUNS.length) % RUNS.length] ?? null;
  const others = Array.from({ length: TOP }, (_, i) => (run * 3 + i * 5) % POOL.length);
  const unique = [...new Set(others)];
  for (let k = 0; unique.length < TOP; k += 1) if (!unique.includes(k)) unique.push(k);
  if (rank === null) return unique.slice(0, TOP);
  const rest = unique.slice(0, TOP - 1);
  return [...rest.slice(0, rank - 1), -1, ...rest.slice(rank - 1)];
};

/** 0.3667 → "37". */
export const pct = (x: number): string => String(Math.round(x * 100));
