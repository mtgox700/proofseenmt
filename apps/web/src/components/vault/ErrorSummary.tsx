import type { Lang } from "@/i18n/types";
import type { FieldSpec, GroupSpec, Problem } from "@/lib/vault/choices";
import { vaultText } from "@/lib/vault/dictionary";

/*
 * « Il manque 2 choix pour préparer le contrat » (storyboard L1.6, §4 E2): at the head of the form that comes back,
 * role="alert", focusable, each missing choice named by its fieldset and the template's label, never by a variable
 * name, each a link to its first control. A fact of the contract that is missing is not a choice: it is said as such.
 * A refusal of the engine that is about no field replaces the list with its one sentence.
 */

export type Refusal = "expired" | "invalid" | "other" | "monthly";

export interface ErrorSummaryProps {
  readonly lang: Lang;
  readonly groups: readonly GroupSpec[];
  readonly problems: readonly Problem[];
  /** Labels of the facts of the contract the engine found missing. */
  readonly facts: readonly string[];
  readonly refusal: Refusal | null;
  /** An error that is not about the form (« trop de demandes »), in words. */
  readonly message: string | null;
}

const lowerFirst = (text: string): string => text.charAt(0).toLocaleLowerCase("fr") + text.slice(1);

export function ErrorSummary({ lang, groups, problems, facts, refusal, message }: ErrorSummaryProps) {
  const t = vaultText(lang);
  const p = t.prepare;
  if (problems.length === 0 && facts.length === 0 && refusal === null && message === null) return null;
  const fieldOf = (name: string): { readonly group: GroupSpec; readonly field: FieldSpec } | null => {
    for (const group of groups) {
      const field = [...group.fields, ...group.toggles.flatMap((toggle) => toggle.fields)].find((f) => f.name === name);
      if (field !== undefined) return { group, field };
    }
    return null;
  };
  const refusalText = refusal === null ? null : refusal === "monthly" ? t.states.monthly : p.refusal[refusal];
  const items = problems.flatMap((problem) => {
    const found = fieldOf(problem.name);
    if (found === null) return [];
    // A label that already says its legend is said alone: « Régime de propriété intellectuelle », not the legend twice.
    const { legend } = found.group;
    const { label } = found.field;
    const repeats = label.toLocaleLowerCase(lang).includes(legend.toLocaleLowerCase(lang));
    return [{ href: `#${found.field.id}`, text: repeats ? label : p.summaryItem(legend, lowerFirst(label)) }];
  });
  return (
    <div id="erreurs" className="vault-alert vault-summary" role="alert" tabIndex={-1}>
      {message === null ? null : <p>{message}</p>}
      {refusalText === null ? null : <p>{refusalText}</p>}
      {items.length + facts.length === 0 ? null : (
        <>
          <p>{p.summary(items.length + facts.length)}</p>
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.text}</a>
              </li>
            ))}
            {facts.map((fact) => (
              <li key={fact}>{p.missingFact(fact)}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
