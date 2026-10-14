import Link from "next/link";
import "@/styles/visibility.css";
import type { Lang } from "@/i18n";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import { count, day } from "@/lib/format";
import type { LatestCitations } from "@/lib/visibility-view";
import { engineLabel } from "./engine-label";

interface Props {
  readonly lang: Lang;
  readonly v: VisibilityDictionary;
  readonly latest: LatestCitations | null;
}

/** The home tile: the citations of the latest measurement per engine, or the way to a first measurement. */
export function VisibilityTile({ lang, v, latest }: Props) {
  const h = v.home;
  const page = `/${lang}/app/visibilite`;
  if (latest === null) {
    return (
      <div className="tile">
        <span className="tile-label">{h.title}</span>
        <b className="tile-value vis-tile-text">{h.notMeasured}</b>
        <Link className="tile-foot" href={page}>
          {h.measure}
        </Link>
      </div>
    );
  }
  return (
    <div className="tile">
      <span className="tile-label">{h.title}</span>
      <span className="tile-foot muted">{h.measuredOn(day(latest.measuredAt, lang))}</span>
      <ul className="vis-tile-list">
        {latest.engines.map((engine) => (
          <li key={engine.engine}>
            <b>{engineLabel(engine.engine, v)}</b> {h.cited(count(engine.cited, lang), count(engine.draws, lang))}
          </li>
        ))}
      </ul>
      <Link className="tile-foot" href={page}>
        {h.see}
      </Link>
    </div>
  );
}
