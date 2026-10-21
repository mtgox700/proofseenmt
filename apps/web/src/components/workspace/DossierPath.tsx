import type { NextAction } from "@proofseen/workspace";
import { InView } from "@/components/motion/InView";
import type { Dictionary } from "@/i18n";
import { stepsFor } from "@/lib/dossier";

/** A client's file as an ordered path: done, current (with who must act), coming. Shared by the token space and the app. */
export function DossierPath({ t, action }: { readonly t: Dictionary["space"]; readonly action: NextAction }) {
  return (
    <InView as="ol" className="dossier" threshold={0.2}>
      {stepsFor(action).map((step, i) => (
        <li key={step.key} data-state={step.state} style={{ "--i": i } as React.CSSProperties} aria-current={step.state === "active" ? "step" : undefined}>
          <span className="dossier-mark" aria-hidden="true" />
          <div className="dossier-body">
            <p className="dossier-title">
              <strong>{t.steps[step.key].title}</strong>
              <span className={step.state === "active" ? (step.actor === "client" ? "tag tag-signal" : "tag tag-done") : "tag tag-quiet"}>
                {step.state === "done" ? t.done : step.state === "blocked" ? t.blocked : step.state === "todo" ? t.todo : step.actor === "client" ? t.yours : t.ours}
              </span>
            </p>
            <p className="muted">{t.steps[step.key].text}</p>
          </div>
        </li>
      ))}
    </InView>
  );
}
