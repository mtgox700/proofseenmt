import type { MatchCriterion, MatchReason } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { MatchingDictionary } from "@/i18n/market/matching-fr";
import { reasonText, type RateSense } from "@/lib/matching";

interface MatchReasonsProps {
  readonly lang: Lang;
  readonly m: MatchingDictionary;
  readonly matched: readonly MatchReason[];
  readonly missing: readonly MatchCriterion[];
  readonly rate: RateSense;
}

/** Why a suggestion is here (each criterion met, with its fact) and what it lacks. Never a percentage. */
export function MatchReasons({ lang, m, matched, missing, rate }: MatchReasonsProps) {
  return (
    <span className="thread-last small">
      <span className="tags">
        {matched.map((reason) => (
          <span key={reason.kind} className="tag tag-quiet">
            {reasonText(reason, m, lang, rate)}
          </span>
        ))}
      </span>
      {missing.length === 0 ? null : (
        <span className="muted">
          {" "}
          {m.missing} {missing.map((criterion) => m.criteria[criterion]).join(", ")}
        </span>
      )}
    </span>
  );
}
