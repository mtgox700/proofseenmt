import type { CorrectionPlan } from "@proofseen/deliverable";
import type { Dictionary } from "@/i18n";

interface PlanListProps {
  readonly t: Dictionary;
  readonly plan: CorrectionPlan;
}

/** The correction plan, in the order to do it. The action text is the report's, in the report's language. */
export function PlanList({ t, plan }: PlanListProps) {
  if (plan.actions.length === 0) return <p className="ws-note">{t.report.planEmpty}</p>;
  return (
    <>
      <p className="ws-note">{t.report.planLead(plan.actions.length)}</p>
      <ol className="plan">
        {plan.actions.map((action) => (
          <li key={action.id}>
            <div className="plan-head">
              <span className="plan-rank num" aria-hidden="true">{action.rank}</span>
              <h3 lang="fr">
                <span className="sr-only">{action.rank}. </span>
                {action.title}
              </h3>
              <span className="tag tag-quiet num">
                {t.report.labels.stage} {action.stage}
              </span>
            </div>
            <dl className="plan-facts">
              <div>
                <dt>{t.report.labels.why}</dt>
                <dd lang="fr">{action.why}</dd>
              </div>
              <div>
                <dt>{t.report.labels.where}</dt>
                <dd lang="fr">{action.where}</dd>
              </div>
              <div>
                <dt>{t.report.labels.effort}</dt>
                <dd>{t.report.effort[action.effort] ?? action.effort}</dd>
              </div>
              <div>
                <dt>{t.report.labels.evidence}</dt>
                <dd className="num" lang="fr">{action.evidence}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
      {plan.dropped > 0 ? <p className="ws-note">{t.report.dropped(plan.dropped)}</p> : null}
    </>
  );
}
