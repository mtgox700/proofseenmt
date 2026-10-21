import { barChart, type ChartPoint } from "@/lib/chart";

interface BarChartProps {
  /** Unique on the page: ties the figure's caption and description to the drawing. */
  readonly id: string;
  readonly title: string;
  /** One sentence a screen reader reads instead of the drawing (total, peak). The table next to it has every value. */
  readonly summary: string;
  readonly points: readonly ChartPoint[];
  /** What a value reads as, in the bar's tooltip and on the scale. */
  readonly format: (value: number) => string;
  /** Labels under the first and last bar. */
  readonly firstLabel: string;
  readonly lastLabel: string;
  /** A short figure next to the title, such as the total. */
  readonly figure?: string;
  /** Neutral inks only: a count of views or clicks is not a verified fact, it never takes the proof green. */
  readonly tone?: "ink" | "muted" | "faint";
}

const WIDTH = 640;
const HEIGHT = 160;

/** A server-drawn SVG bar chart: no script, no library; each bar carries its own tooltip. */
export function BarChart({ id, title, summary, points, format, firstLabel, lastLabel, figure, tone = "ink" }: BarChartProps) {
  const g = barChart(points, { width: WIDTH, height: HEIGHT, gap: points.length > 40 ? 0.25 : 0.3 });
  return (
    <figure className="chart">
      <figcaption id={`${id}-title`} className="chart-title">
        <span>{title}</span>
        {figure === undefined ? null : <b className="num">{figure}</b>}
      </figcaption>
      <svg viewBox={`0 0 ${g.width} ${g.height}`} className={`chart-svg chart-${tone}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <desc id={`${id}-desc`}>{summary}</desc>
        {g.ticks.map((tick) => (
          <g key={tick.value} className="chart-tick">
            <line x1={g.plotLeft} x2={g.width} y1={tick.y} y2={tick.y} />
            <text x={g.plotLeft - 6} y={tick.y} dy="0.32em" textAnchor="end">
              {format(tick.value)}
            </text>
          </g>
        ))}
        {g.bars.map((bar) => (
          <rect key={bar.label} className="chart-bar" x={bar.x} y={bar.y} width={bar.width} height={Math.max(bar.height, bar.value > 0 ? 1 : 0)} rx={1}>
            <title>{`${bar.label} — ${format(bar.value)}`}</title>
          </rect>
        ))}
        <text className="chart-axis" x={g.plotLeft} y={g.height - 4}>
          {firstLabel}
        </text>
        <text className="chart-axis" x={g.width} y={g.height - 4} textAnchor="end">
          {lastLabel}
        </text>
      </svg>
    </figure>
  );
}
