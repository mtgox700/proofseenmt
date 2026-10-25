import "@/styles/ui.css";
import Link from "next/link";
import type { Lang } from "@/i18n/types";
import { colon } from "@/lib/format";
import { hrefWith, PAGE_PARAM, param, type SearchParams } from "../url";

/*
 * FilterBar (LEGENDS_P2_CONCEPT §B.7): a GET form, so filtering works without JavaScript and every filtered view is an
 * address. The active filters are written as chips, each a link that removes it; saved views are plain addresses.
 * A select only accepts its own options: a value typed into the address that is not one is not shown as a filter.
 */

const WORDS = {
  fr: { region: "Filtres", apply: "Filtrer", clear: "Tout effacer", remove: "retirer ce filtre", active: "Filtres actifs", views: "Vues enregistrées", any: "Tous" },
  en: { region: "Filters", apply: "Filter", clear: "Clear all", remove: "remove this filter", active: "Active filters", views: "Saved views", any: "All" },
} as const satisfies Record<Lang, Record<string, string>>;

export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

/**
 * A field of the bar. An example of what to type goes in `hint`, written under the field and tied to it by
 * aria-describedby: never as a placeholder, which reads like a value already typed (L1-091 K16).
 */
export type FilterField =
  | { readonly kind: "search"; readonly name: string; readonly label: string; readonly hint?: string }
  | {
      readonly kind: "select";
      readonly name: string;
      readonly label: string;
      readonly options: readonly FilterOption[];
      readonly hint?: string;
      /** The empty choice, agreed with the label: « Toutes » for « File ». Default « Tous », "All". */
      readonly anyLabel?: string;
    };

export interface SavedView {
  readonly label: string;
  readonly href: string;
  readonly current?: boolean;
}

export interface FilterChip {
  readonly name: string;
  readonly text: string;
  readonly removeHref: string;
}

/** The value a field holds in the address; for a select, only one of its options. */
export function fieldValue(field: FilterField, params: SearchParams): string | null {
  const value = param(params, field.name);
  if (value === null || field.kind === "search") return value;
  return field.options.some((option) => option.value === value) ? value : null;
}

/** French typography: a narrow no-break space inside the guillemets (written by code point, never typed). */
const NARROW = String.fromCharCode(0x202f);

/** One chip per active filter, in the order of the fields, each with the address of the view without it. */
export function activeChips(fields: readonly FilterField[], params: SearchParams, path: string, lang: Lang): readonly FilterChip[] {
  return fields.flatMap((field) => {
    const value = fieldValue(field, params);
    if (value === null) return [];
    const shown =
      field.kind === "select" ? (field.options.find((option) => option.value === value)?.label ?? value) : lang === "fr" ? `«${NARROW}${value}${NARROW}»` : `"${value}"`;
    return [{ name: field.name, text: `${field.label}${colon(lang)}${shown}`, removeHref: hrefWith(path, params, { [field.name]: null, [PAGE_PARAM]: null }) }];
  });
}

/** The same view without any of these filters (the sort and other parameters stay). */
export function clearHref(fields: readonly FilterField[], params: SearchParams, path: string): string {
  const changes: Record<string, null> = { [PAGE_PARAM]: null };
  for (const field of fields) changes[field.name] = null;
  return hrefWith(path, params, changes);
}

export interface FilterBarProps {
  readonly lang: Lang;
  /** Unique on the page: ties labels to fields. */
  readonly id: string;
  /** The page's path: the form submits to it. */
  readonly path: string;
  readonly params: SearchParams;
  readonly fields: readonly FilterField[];
  /** Parameters the form carries over unchanged, such as the sort (`tri`). */
  readonly keep?: readonly string[];
  readonly views?: readonly SavedView[];
}

export function FilterBar({ lang, id, path, params, fields, keep = [], views = [] }: FilterBarProps) {
  const words = WORDS[lang];
  const chips = activeChips(fields, params, path, lang);
  const names = new Set(fields.map((field) => field.name));
  const carried = keep.filter((name) => !names.has(name)).flatMap((name) => {
    const value = param(params, name);
    return value === null ? [] : [{ name, value }];
  });
  return (
    <div className="ui-filter">
      {views.length === 0 ? null : (
        <nav className="ui-views" aria-label={words.views}>
          <ul>
            {views.map((view) => (
              <li key={view.href}>
                <Link href={view.href} aria-current={view.current === true ? "page" : undefined}>
                  {view.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <form className="ui-filter-form" method="get" action={path} role="search" aria-label={words.region}>
        {fields.map((field) => {
          const fieldId = `${id}-${field.name}`;
          const hintId = field.hint === undefined ? undefined : `${fieldId}-hint`;
          const value = fieldValue(field, params) ?? "";
          return (
            <div className="ui-field" key={field.name}>
              <label htmlFor={fieldId}>{field.label}</label>
              {field.kind === "search" ? (
                <input id={fieldId} type="search" name={field.name} defaultValue={value} autoComplete="off" aria-describedby={hintId} />
              ) : (
                <select id={fieldId} name={field.name} defaultValue={value} aria-describedby={hintId}>
                  <option value="">{field.anyLabel ?? words.any}</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              {field.hint === undefined ? null : (
                <p id={hintId} className="ui-hint">
                  {field.hint}
                </p>
              )}
            </div>
          );
        })}
        {carried.map((hidden) => (
          <input key={hidden.name} type="hidden" name={hidden.name} value={hidden.value} />
        ))}
        <button type="submit" className="btn">
          {words.apply}
        </button>
      </form>
      {chips.length === 0 ? null : (
        <div className="ui-chips">
          <ul aria-label={words.active}>
            {chips.map((chip) => (
              <li key={chip.name}>
                <Link className="ui-chip" href={chip.removeHref}>
                  {chip.text}
                  <span className="sr-only">{`, ${words.remove}`}</span>
                </Link>
              </li>
            ))}
          </ul>
          {chips.length < 2 ? null : (
            <Link className="ui-chips-clear" href={clearHref(fields, params, path)}>
              {words.clear}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
