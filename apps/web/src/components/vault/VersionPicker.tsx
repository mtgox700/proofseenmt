import type { Lang } from "@/i18n/types";
import { vaultText } from "@/lib/vault/dictionary";

/*
 * « Comparer la version [2] à la version [3] » (storyboard L1.6, §4 E1): a GET form to the comparison, so it works
 * without a script and every comparison is an address. The older version first; the page reorders a reversed pair.
 */

export interface VersionPickerProps {
  readonly lang: Lang;
  readonly id: string;
  readonly documentId: string;
  /** The numbers of the versions, any order. */
  readonly numbers: readonly number[];
  readonly from: number;
  readonly to: number;
}

export function VersionPicker({ lang, id, documentId, numbers, from, to }: VersionPickerProps) {
  const t = vaultText(lang).picker;
  if (numbers.length < 2) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const options = sorted.map((n) => (
    <option key={n} value={n}>
      {n}
    </option>
  ));
  return (
    <form className="vault-picker" method="get" action={`/${lang}/app/documents/${documentId}/comparer`} aria-label={t.label}>
      <label htmlFor={`${id}-de`}>
        {t.from}
        <select id={`${id}-de`} name="de" defaultValue={String(from)}>
          {options}
        </select>
      </label>
      <label htmlFor={`${id}-a`}>
        {t.to}
        <select id={`${id}-a`} name="a" defaultValue={String(to)}>
          {options}
        </select>
      </label>
      <button type="submit" className="btn">
        {t.submit}
      </button>
    </form>
  );
}
