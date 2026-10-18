import Link from "next/link";
import type { NextStepsDictionary } from "@/i18n/market/next-steps-fr";
import type { NextStep } from "@/lib/next-steps";

interface NextStepsProps {
  readonly n: NextStepsDictionary;
  readonly steps: readonly NextStep[];
}

/** The links an empty screen offers (C23), in order: plain links, the first one put forward. */
export function NextSteps({ n, steps }: NextStepsProps) {
  if (steps.length === 0) return null;
  return (
    <nav aria-label={n.title}>
      <p className="muted small">{n.title}</p>
      <ul className="empty-actions next-steps">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Link className={i === 0 ? "btn btn-primary" : "btn"} href={step.href}>
              {n.steps[step.key]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
