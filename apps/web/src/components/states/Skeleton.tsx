import { STATES } from "../../i18n/states";
import { LangPick } from "./LangPick";

interface PageSkeletonProps {
  /** How many entries the register shows while the page loads. */
  readonly rows?: number;
}

/*
 * What a page shows while the server reads its data: an empty register, ruled like the real one, at fixed sizes so
 * nothing moves when the page arrives. The rows breathe slowly (opacity only); with reduced motion they hold still.
 * Screen readers hear one polite "loading" line, in the reader's language.
 */
export function PageSkeleton({ rows = 5 }: PageSkeletonProps) {
  return (
    <div className="sk" aria-busy="true">
      <p className="sr-only" role="status">
        <LangPick fr={STATES.fr.loading} en={STATES.en.loading} />
      </p>
      <div className="sk-head" aria-hidden="true">
        <span className="sk-bar sk-title" />
        <span className="sk-bar sk-line" />
      </div>
      <ul className="sk-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="sk-row">
            <span className="sk-bar sk-ref" />
            <span className="sk-bar sk-text" />
            <span className="sk-bar sk-date" />
          </li>
        ))}
      </ul>
    </div>
  );
}
