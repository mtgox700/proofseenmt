export interface Interval {
  readonly p: number;
  readonly low: number;
  readonly high: number;
}

const Z_95 = 1.959963984540054;

const assertCounts = (successes: number, n: number): void => {
  if (!Number.isInteger(successes) || !Number.isInteger(n) || successes < 0 || n < 0 || successes > n) {
    throw new RangeError(`invalid counts: ${successes}/${n}`);
  }
};

/** Wilson score interval (95 %), robust near 0 % where most freelancers start. Returns null when n = 0. */
export const wilson = (successes: number, n: number, z: number = Z_95): Interval | null => {
  assertCounts(successes, n);
  if (n === 0) return null;
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return {
    p,
    low: successes === 0 ? 0 : Math.max(0, centre - half),
    high: successes === n ? 1 : Math.min(1, centre + half),
  };
};
