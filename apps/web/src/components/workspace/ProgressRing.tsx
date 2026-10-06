interface ProgressRingProps {
  readonly done: number;
  readonly total: number;
  readonly label: string;
  /** "proof" when done is good news, "signal" when what remains is the point (things to fix). */
  readonly tone: "proof" | "signal";
}

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A count drawn as a ring: done out of total, the figure written in the middle. The arc fills once when seen
 * (CSS, under an InView parent); without motion it is simply drawn full.
 */
export function ProgressRing({ done, total, label, tone }: ProgressRingProps) {
  const share = total === 0 ? 0 : done / total;
  const style = { "--dash": CIRCUMFERENCE, "--offset": CIRCUMFERENCE * (1 - share) } as React.CSSProperties;
  return (
    <figure className={`ring ring-${tone}`} style={style}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle className="ring-track" cx="36" cy="36" r={RADIUS} />
        <circle className="ring-arc" cx="36" cy="36" r={RADIUS} />
      </svg>
      <figcaption>
        <b className="num">
          {done}/{total}
        </b>
        <span className="muted small">{label}</span>
      </figcaption>
    </figure>
  );
}
