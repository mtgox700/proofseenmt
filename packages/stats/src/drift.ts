import type { ClusterCount } from "./bootstrap";

export const DRIFT_THRESHOLD = 0.05;

const rate = (c: ClusterCount): number => (c.n === 0 ? 0 : c.successes / c.n);

/** Flags a retrieval-rate move on control JDs above 5 points: the engines changed, not the profile. */
export const controlDrift = (before: ClusterCount, after: ClusterCount): { delta: number; flagged: boolean } => {
  const delta = Math.round((rate(after) - rate(before)) * 1e6) / 1e6;
  return { delta, flagged: Math.abs(delta) > DRIFT_THRESHOLD };
};
