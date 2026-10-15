/*
 * A value computed at most once per period in this instance. Concurrent callers share the computation in flight; a
 * failed computation is not kept, so the next caller tries again instead of reading an error for the whole period.
 */

interface Entry<T> {
  readonly at: number;
  readonly value: Promise<T>;
}

export const memoize = <T>(compute: () => Promise<T>, ttlMs: number, clock: () => number = Date.now): (() => Promise<T>) => {
  let entry: Entry<T> | null = null;
  return () => {
    const now = clock();
    if (entry !== null && now - entry.at < ttlMs) return entry.value;
    const value = compute();
    const current: Entry<T> = { at: now, value };
    entry = current;
    value.catch(() => {
      if (entry === current) entry = null;
    });
    return value;
  };
};
