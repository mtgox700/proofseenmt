import Link from "next/link";
import type { FreelanceDashboard } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { InsightsDictionary } from "@/i18n/market/insights-fr";
import { applicationsInProgress, arrivalSteps, freelanceStage } from "@/lib/freelance-stage";

interface StageBlockProps {
  readonly lang: Lang;
  readonly d: InsightsDictionary;
  readonly board: FreelanceDashboard;
}

/** The top of the freelancer's home, by stage: the steps to publish, the applications waiting, or the contracts under way. */
export function StageBlock({ lang, d, board }: StageBlockProps) {
  const s = d.stage;
  const stage = freelanceStage(board);
  const base = `/${lang}/app`;
  return (
    <section className="panel stage-block" aria-labelledby="stage-title" data-stage={stage}>
      <h2 id="stage-title">{s.titles[stage]}</h2>
      {stage === "arrival" ? (
        <>
          <p className="muted measure">{s.arrivalLead}</p>
          <ol className="stage-steps">
            {arrivalSteps(board).map((step) => (
              <li key={step.key} data-done={step.done ? "" : undefined}>
                <span className={step.done ? "tag tag-proof" : "tag tag-signal"}>{step.done ? s.done : s.todo}</span>{" "}
                {step.done ? s.steps[step.key] : <Link href={`${base}/${step.path}`}>{s.steps[step.key]}</Link>}
              </li>
            ))}
          </ol>
        </>
      ) : stage === "applying" ? (
        <>
          <p className="measure">{s.applyingLead(applicationsInProgress(board))}</p>
          <div className="empty-actions">
            <Link className="btn btn-primary" href={`${base}/missions`}>
              {s.applyingAction}
            </Link>
            <Link className="btn" href={`/${lang}/missions`}>
              {s.browse}
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="measure">{s.missionLead(board.contracts.active ?? 0, board.contracts.pending_signatures ?? 0)}</p>
          <div className="empty-actions">
            <Link className="btn btn-primary" href={`${base}/contrats`}>
              {s.missionAction}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
