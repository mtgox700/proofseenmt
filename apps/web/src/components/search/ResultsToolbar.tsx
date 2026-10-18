import Form from "next/form";
import Link from "next/link";
import { JOB_TITLES, type ProfileFacets } from "@proofseen/db";
import { languageName } from "@proofseen/hub";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { date, money } from "@/lib/format";
import { searchHref, searchParamsOf, SORT_SLUGS, type SearchQuery, type SortSlug } from "@/lib/freelancer-search";
import { activeChips, clearedQuery, type Chip } from "@/lib/search-chips";
import { AutoSubmit } from "./AutoSubmit";

interface ResultsToolbarProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly query: SearchQuery;
  readonly facets: ProfileFacets | null;
}

const SORTS = Object.keys(SORT_SLUGS) as SortSlug[];
const SORT_FORM_ID = "search-sort";

const chipLabel = (chip: Chip, lang: Lang, m: MarketDictionary): string => {
  const d = m.discovery.chips;
  switch (chip.kind) {
    case "text":
      return d.text(chip.value);
    case "skill":
    case "city":
      return chip.value;
    case "jobTitle":
      return JOB_TITLES.find((t) => t.key === chip.value)?.label[lang] ?? chip.value;
    case "language":
      return d.language(languageName(chip.value, lang), m.search.form.levels[chip.level]);
    case "mode":
      return m.missions.workModes[chip.value];
    case "minRate":
      return d.minRate(money(chip.value, "EUR", lang));
    case "maxRate":
      return d.maxRate(money(chip.value, "EUR", lang));
    case "availableBy":
      return d.availableBy(date(chip.value, lang));
    case "toggle":
      return d.toggles[chip.value];
  }
};

/** The active filters as chips: each one a link to the same search without it. */
function ActiveChips({ lang, m, query }: Omit<ResultsToolbarProps, "facets">) {
  const chips = activeChips(query);
  if (chips.length === 0) return null;
  const d = m.discovery.chips;
  return (
    <ul className="chips" aria-label={d.label}>
      {chips.map((chip, i) => {
        const label = chipLabel(chip, lang, m);
        return (
          <li key={`${chip.kind}-${i}`}>
            <Link className="chip" href={searchHref(lang, chip.query)} aria-label={d.remove(label)} scroll={false}>
              <span>{label}</span>
              <span aria-hidden="true">×</span>
            </Link>
          </li>
        );
      })}
      <li>
        <Link className="chip chip-clear" href={searchHref(lang, clearedQuery(query))} scroll={false}>
          {d.clear}
        </Link>
      </li>
    </ul>
  );
}

/** The order, chosen and stated: a small GET form that keeps every filter (the page goes back to 1). */
function SortBar({ lang, m, query }: Omit<ResultsToolbarProps, "facets">) {
  const r = m.discovery.results;
  const hidden = [...searchParamsOf({ ...query, page: 1 })].filter(([name]) => name !== "tri");
  return (
    <Form id={SORT_FORM_ID} action={`/${lang}/app/recherche`} scroll={false} className="sort-bar">
      {hidden.map(([name, value], i) => (
        <input key={`${name}-${i}`} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="search-sort">{r.sortBy}</label>
      <select id="search-sort" name="tri" defaultValue={query.sort}>
        {SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {m.search.form.sorts[sort]}
          </option>
        ))}
      </select>
      <button type="submit" className="btn">
        {r.applySort}
      </button>
      <AutoSubmit formId={SORT_FORM_ID} />
    </Form>
  );
}

/** The head of the results: how many, the active filters, the chosen order and what it means. */
export function ResultsToolbar({ lang, m, query, facets }: ResultsToolbarProps) {
  const r = m.discovery.results;
  return (
    <div className="results-bar">
      <div className="results-line">
        <h2 id="results-title">{facets === null ? m.search.results.title : r.count(facets.total, facets.capped)}</h2>
        <SortBar lang={lang} m={m} query={query} />
      </div>
      <ActiveChips lang={lang} m={m} query={query} />
      <p className="muted small">
        {r.explain[query.sort]} {r.tie}
      </p>
    </div>
  );
}
