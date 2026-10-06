import type { Interval as Estimate } from "@proofseen/stats";

interface IntervalProps {
  readonly value: Estimate | null;
  /** Visible text equivalent; the drawing itself is decorative for assistive technologies. */
  readonly label: string;
}

/**
 * The brand motif as a chart mark: the range between two stops, the observed rate as a dot, on a fixed 0-100 % axis.
 * A fixed axis is deliberate: a range of [0 ; 1.9 %] must look small, because it is.
 */
export function Interval({ value, label }: IntervalProps) {
  if (value === null) return <span className="ci ci-empty">{label}</span>;
  const style = { "--lo": value.low, "--hi": value.high, "--p": value.p } as React.CSSProperties;
  return (
    <span className="ci" style={style}>
      <span className="ci-track" aria-hidden="true">
        <span className="ci-range" />
        <span className="ci-dot" />
      </span>
      <span className="ci-label num">{label}</span>
    </span>
  );
}
