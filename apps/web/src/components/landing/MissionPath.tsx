import type { HomeCopy } from "@/content/home";
import { MissionStage } from "./MissionStage";
import { FINAL_STEP } from "./mission-scene";

interface MissionPathProps {
  readonly copy: HomeCopy["journey"];
  /** Real payments are not open (no GO PAIEMENT LIVE): the payment step says so, in words. */
  readonly testMode: boolean;
}

const SECTION = "parcours";
const LIST = "parcours-etapes";

/*
 * S5, the flagship section: the whole platform in one gesture, from the post to the proof. The nine steps are server
 * HTML, readable in full without JavaScript; the scene beside them (MissionStage) is the only client part. The rail
 * beside the steps is Aceternity UI's "Tracing Beam" rewritten as a CSS view timeline (home-journey.css): it fills as
 * the reader goes down and turns green only when the section reaches its last step.
 */
export function MissionPath({ copy, testMode }: MissionPathProps) {
  return (
    <section className="mp" id={SECTION} aria-labelledby={`${SECTION}-title`} data-step={FINAL_STEP}>
      <div className="wrap">
        <header className="mp-head reveal">
          <p className="kicker">{copy.kicker}</p>
          <h2 id={`${SECTION}-title`} tabIndex={-1}>
            {copy.title}
          </h2>
          <p className="mp-lead pretty">{copy.lead}</p>
        </header>
        <div className="mp-grid">
          <MissionStage copy={copy.stage} listId={LIST} sectionId={SECTION} />
          <div className="mp-story">
            <span className="mp-trace" aria-hidden="true">
              <span className="mp-trace-fill" />
            </span>
            <ol className="mp-steps" id={LIST}>
              {copy.steps.map((step, i) => (
                <li key={step.title} id={`${LIST}-${i + 1}`}>
                  <span className="mp-n" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  {i === 6 && testMode ? <p className="mp-test">{copy.testMode}</p> : null}
                </li>
              ))}
            </ol>
            <aside className="mp-other-way">
              <h3>{copy.other.title}</h3>
              <p>{copy.other.text}</p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
