import type { Lang } from "@/i18n/types";
import type { FieldSpec, ProblemKind } from "@/lib/vault/choices";
import { vaultText } from "@/lib/vault/dictionary";

/*
 * One control of the form « Préparer », from the declaration of its variable in the template (storyboard L1.6, §4 E2):
 * radios for a list or yes and no (none preselected unless a value is already chosen), a number with its bounds, a
 * text area with its length. A group of radios is a div with role="radiogroup", never a list (axe `listitem`,
 * L1-159 B3). Labels, bounds and choices are the template's; a problem is said under the field, tied to
 * it by aria-describedby, with aria-invalid on the control. No `required`: the server's summary says every missing
 * choice at once, in the template's words, rather than the browser stopping at the first one.
 */

export interface ChoiceFieldProps {
  readonly lang: Lang;
  readonly field: FieldSpec;
  readonly value: string | undefined;
  readonly problem: ProblemKind | undefined;
  /** The fieldset's legend already says the label (« Lieu d'exécution »): kept for screen readers only. */
  readonly labelHidden?: boolean;
}

export function problemText(lang: Lang, field: FieldSpec, kind: ProblemKind): string {
  const f = vaultText(lang).prepare.field;
  if (kind === "choose") return f.choose;
  if (kind === "number") return f.number(field.min ?? 0, field.max ?? 9999);
  return kind === "contact" ? f.contact : f.text;
}

export function ChoiceField({ lang, field, value, problem, labelHidden = false }: ChoiceFieldProps) {
  const t = vaultText(lang).prepare;
  const hintId = field.hint === null ? null : `${field.id}-hint`;
  const errorId = problem === undefined ? null : `${field.id}-error`;
  const describedBy = [hintId, errorId].filter((id) => id !== null).join(" ") || undefined;
  const invalid = problem === undefined ? undefined : true;
  const hint = field.hint === null ? null : (
    <p id={hintId ?? undefined} className="vault-hint">
      {field.hint}
    </p>
  );
  const error = problem === undefined ? null : (
    <p id={errorId ?? undefined} className="vault-error">
      {problemText(lang, field, problem)}
    </p>
  );
  if (field.control === "radio" || field.control === "boolean") {
    const options = field.control === "boolean" ? [{ value: "true", label: t.yes }, { value: "false", label: t.no }] : field.options;
    const labelId = `${field.id}-label`;
    return (
      <div className="vault-field">
        <p id={labelId} className={labelHidden ? "sr-only" : undefined}>
          {field.label}
        </p>
        {hint}
        {error}
        <div className="vault-choices" role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} aria-invalid={invalid}>
          {options.map((option, index) => {
            const id = index === 0 ? field.id : `${field.id}-${option.value}`;
            return (
              <label key={option.value} className="vault-choice" htmlFor={id}>
                <input id={id} type="radio" name={field.name} value={option.value} defaultChecked={value === option.value} />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="vault-field">
      <label htmlFor={field.id}>{field.label}</label>
      {hint}
      {error}
      {field.control === "number" ? (
        <input id={field.id} name={field.name} type="number" inputMode="numeric" min={field.min ?? undefined} max={field.max ?? undefined} step={1} defaultValue={value} aria-describedby={describedBy} aria-invalid={invalid} />
      ) : field.control === "textarea" ? (
        <textarea id={field.id} name={field.name} rows={4} maxLength={field.maxLength ?? undefined} defaultValue={value} aria-describedby={describedBy} aria-invalid={invalid} />
      ) : (
        <input id={field.id} name={field.name} type="text" maxLength={field.maxLength ?? undefined} defaultValue={value} aria-describedby={describedBy} aria-invalid={invalid} />
      )}
    </div>
  );
}
