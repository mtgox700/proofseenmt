import type { MarketDictionary } from "@/i18n/market";

interface DecisionFormProps {
  readonly action: (formData: FormData) => Promise<void>;
  readonly d: MarketDictionary["confirmations"]["decision"];
  /** Hidden fields the action needs (language, request id, token). */
  readonly hidden: Readonly<Record<string, string>>;
  /** Distinguishes several forms on one page. */
  readonly idPrefix: string;
}

/**
 * Confirm or decline a mission, with the box that allows the company name. The box is unticked by default and only
 * counts with "confirm"; two submit buttons, no client JavaScript.
 */
export function ConfirmationDecisionForm({ action, d, hidden, idPrefix }: DecisionFormProps) {
  const box = `${idPrefix}-show-name`;
  return (
    <form action={action} className="panel-grid">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="field field-inline panel-span">
        <input id={box} name="showClientName" type="checkbox" aria-describedby={`${box}-hint`} />
        <label htmlFor={box}>{d.showName}</label>
        <p id={`${box}-hint`} className="field-hint">
          {d.showNameHint}
        </p>
      </div>
      <div className="filters-actions panel-span">
        <button type="submit" name="decision" value="confirm" className="btn btn-primary">
          {d.confirm}
        </button>
        <button type="submit" name="decision" value="refuse" className="btn btn-quiet">
          {d.refuse}
        </button>
      </div>
    </form>
  );
}
