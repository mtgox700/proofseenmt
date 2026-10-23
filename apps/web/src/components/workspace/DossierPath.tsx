import type { NextAction } from "@proofseen/workspace";
import type { Dictionary } from "@/i18n";
import { stepsFor } from "@/lib/dossier";

/**
 * A client's file as an ordered path: done, current (with who must act), coming. Shared by the token space and the app.
 * Every step is drawn in its true state from the first paint: nothing waits to be revealed (Kensa m4).
 */
export function DossierPath({ t, action }: { readonly t: Dictionary["space"]; readonly action: NextAction }) {
  return (
    <ol className="audit-path">
      {stepsFor(action).map((step) => (
        <li key={step.key} data-state={step.state} aria-current={step.state === "active" ? "step" : undefined}>
          <span className="audit-mark" aria-hidden="true" />
          <div className="audit-body">
            <p className="audit-title">
              <strong>{t.steps[step.key].title}</strong>
              <span className={step.state === "active" ? (step.actor === "client" ? "tag tag-signal" : "tag tag-done") : "tag tag-quiet"}>
                {step.state === "done" ? t.done : step.state === "blocked" ? t.blocked : step.state === "todo" ? t.todo : step.actor === "client" ? t.yours : t.ours}
              </span>
            </p>
            <p className="muted">{t.steps[step.key].text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
