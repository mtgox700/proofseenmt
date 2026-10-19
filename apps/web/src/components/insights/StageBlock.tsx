import Link from "next/link";
import type { FreelanceDashboard } from "@proofseen/db";
import { setProfileVisibility } from "@/app/[lang]/app/profil/actions";
import type { Lang } from "@/i18n";
import type { InsightsDictionary } from "@/i18n/market/insights-fr";
import type { ProfileDictionary } from "@/i18n/market/profile-fr";
import { applicationsInProgress, arrivalSteps, freelanceStage, nextArrivalStep, profileModerated, readyToPublish } from "@/lib/freelance-stage";
import { HOME_RETURN_FIELD, HOME_RETURN_VALUE } from "@/lib/home-notice";

interface StageBlockProps {
  readonly lang: Lang;
  readonly d: InsightsDictionary;
  /** The publication labels of the profile page: the one-click publish says exactly what that page says. */
  readonly p: ProfileDictionary;
  readonly board: FreelanceDashboard;
}

/**
 * Publish in one click, named or under the reference, through the profile page's own action. Shown only once
 * everything the database requires is filled in; the choice is the person's, nothing is published for them.
 */
function PublishNow({ lang, d, p }: Omit<StageBlockProps, "board">) {
  const button = (visibility: "pseudonymous" | "named", label: string, primary: boolean) => (
    <form action={setProfileVisibility}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name={HOME_RETURN_FIELD} value={HOME_RETURN_VALUE} />
      <button type="submit" className={primary ? "btn btn-primary" : "btn"}>
        {label}
      </button>
    </form>
  );
  return (
    <div className="stage-publish">
      <p className="measure">{d.stage.publishLead}</p>
      <p className="muted small measure">{p.pseudonymousShows}</p>
      <div className="empty-actions">
        {button("pseudonymous", p.publish, true)}
        {button("named", p.publishNamed, false)}
      </div>
    </div>
  );
}

/** The guided publication: every step in order, done or to do, each to do with its link, the next one put forward. */
function ArrivalSteps({ lang, d, p, board }: StageBlockProps) {
  const s = d.stage;
  const base = `/${lang}/app`;
  const steps = arrivalSteps(board);
  const next = nextArrivalStep(steps);
  return (
    <>
      <p className="muted measure">{s.arrivalLead}</p>
      <ol className="stage-steps">
        {steps.map((step) => (
          <li key={step.key} data-done={step.done ? "" : undefined} aria-current={step.key === next?.key ? "step" : undefined}>
            <span className={step.done ? "tag tag-proof" : "tag tag-signal"}>{step.done ? s.done : step.key === next?.key ? s.next : s.todo}</span>{" "}
            {step.done ? s.steps[step.key] : <Link href={`${base}/${step.path}`}>{s.steps[step.key]}</Link>}
          </li>
        ))}
      </ol>
      {profileModerated(board) ? (
        <p className="form-error measure">
          {s.moderated} <Link href={`${base}/profil`}>{s.moderatedLink}</Link>
        </p>
      ) : readyToPublish(board) ? (
        <PublishNow lang={lang} d={d} p={p} />
      ) : null}
    </>
  );
}

/** The top of the freelancer's home, by stage: the steps to publish, the applications waiting, or the contracts under way. */
export function StageBlock({ lang, d, p, board }: StageBlockProps) {
  const s = d.stage;
  const stage = freelanceStage(board);
  const base = `/${lang}/app`;
  return (
    <section className="panel stage-block" aria-labelledby="stage-title" data-stage={stage}>
      <h2 id="stage-title">{s.titles[stage]}</h2>
      {stage === "arrival" ? (
        <ArrivalSteps lang={lang} d={d} p={p} board={board} />
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
