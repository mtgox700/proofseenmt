import { createRng } from "./rng";

export interface ClusterCount {
  readonly successes: number;
  readonly n: number;
}

export interface BootstrapOptions {
  readonly iterations: number;
  readonly seed: number;
}

export interface Estimate {
  readonly estimate: number;
  readonly low: number;
  readonly high: number;
}

export const DEFAULT_BOOTSTRAP: BootstrapOptions = { iterations: 2000, seed: 20260928 };

export const pooled = (clusters: readonly ClusterCount[]): number => {
  const n = clusters.reduce((acc, c) => acc + c.n, 0);
  return n === 0 ? 0 : clusters.reduce((acc, c) => acc + c.successes, 0) / n;
};

export const percentile = (sorted: readonly number[], q: number): number => {
  if (sorted.length === 0) throw new RangeError("empty sample");
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[index]!;
};

export const resample = <T>(items: readonly T[], rng: () => number): T[] =>
  items.map(() => items[Math.floor(rng() * items.length)]!);

const assertNonEmpty = (clusters: readonly unknown[], label: string): void => {
  if (clusters.length === 0) throw new RangeError(`${label}: at least one cluster is required`);
};

const toEstimate = (estimate: number, samples: readonly number[]): Estimate => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { estimate, low: percentile(sorted, 0.025), high: percentile(sorted, 0.975) };
};

/** Cluster bootstrap: resamples whole job descriptions, because draws on the same JD are correlated. */
export const clusterBootstrap = (
  clusters: readonly ClusterCount[],
  options: BootstrapOptions = DEFAULT_BOOTSTRAP,
): Estimate => {
  assertNonEmpty(clusters, "clusterBootstrap");
  const rng = createRng(options.seed);
  const samples = Array.from({ length: options.iterations }, () => pooled(resample(clusters, rng)));
  return toEstimate(pooled(clusters), samples);
};

export interface DidInput {
  readonly before: readonly ClusterCount[];
  readonly after: readonly ClusterCount[];
  readonly controlBefore: readonly ClusterCount[];
  readonly controlAfter: readonly ClusterCount[];
}

const didDelta = (i: DidInput): number =>
  pooled(i.after) - pooled(i.before) - (pooled(i.controlAfter) - pooled(i.controlBefore));

/** Difference-in-differences: (after - before) on target JDs minus the same change on control JDs. */
export const differenceInDifferences = (
  input: DidInput,
  options: BootstrapOptions = DEFAULT_BOOTSTRAP,
): Estimate => {
  Object.entries(input).forEach(([label, clusters]) => assertNonEmpty(clusters as readonly unknown[], label));
  const rng = createRng(options.seed);
  const samples = Array.from({ length: options.iterations }, () =>
    didDelta({
      before: resample(input.before, rng),
      after: resample(input.after, rng),
      controlBefore: resample(input.controlBefore, rng),
      controlAfter: resample(input.controlAfter, rng),
    }),
  );
  return toEstimate(didDelta(input), samples);
};
