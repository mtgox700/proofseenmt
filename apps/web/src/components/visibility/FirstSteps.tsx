import Link from "next/link";
import "@/styles/visibility.css";
import type { Lang } from "@/i18n";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import type { FirstStep, FirstStepKey } from "@/lib/visibility-view";

interface Props {
  readonly lang: Lang;
  readonly v: VisibilityDictionary;
  readonly steps: readonly FirstStep[];
}

const target = (key: FirstStepKey, lang: Lang): string =>
  key === "publish" ? `/${lang}/app/profil#publication-title` : key === "prove" ? `/${lang}/app/preuves` : "#measure-request";

/** Before any measured wave: the three steps to a first result, in order, each done or still to do. */
export function FirstSteps({ lang, v, steps }: Props) {
  const s = v.start;
  return (
    <section className="panel" aria-labelledby="first-steps">
      <h2 id="first-steps">{s.title}</h2>
      <p className="muted measure">{s.lead}</p>
      <ol className="vis-todo">
        {steps.map((step) => (
          <li key={step.key} data-done={step.done ? "" : undefined}>
            <span className={step.done ? "tag tag-proof" : "tag tag-signal"}>{step.done ? s.done : s.todo}</span>
            <div className="vis-todo-body">
              <strong>{s.steps[step.key].label}</strong>
              <span className="muted small">{s.steps[step.key].what}</span>
              {step.done ? null : <Link href={target(step.key, lang)}>{s.steps[step.key].action}</Link>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
