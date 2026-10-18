import Form from "next/form";
import Link from "next/link";
import { MAX_PROFILE_SCAN } from "@proofseen/db";
import { centsToField } from "@/lib/mission-form";
import { activeFilterCount } from "@/lib/freelancer-search";
import { AutoSubmit } from "./AutoSubmit";
import { AvailabilityFields, FactFields, LanguageFields, PlaceFields, SkillFields, type FacetFieldsProps } from "./FacetFields";

export const FILTERS_FORM_ID = "search-filters";

/**
 * The filter panel of the company search: one GET form, so every search has its own address and works without
 * script (with script, `next/form` keeps the page in place and ticking a box applies it). A `<details>` panel: folded
 * above the results on a phone, always open on a wide screen (CSS, no script).
 */
export function SearchSidebar({ lang, m, query, facets }: FacetFieldsProps) {
  const d = m.discovery.filters;
  const f = m.search.form;
  const active = activeFilterCount(query);
  return (
    <details className="drawer search-drawer">
      <summary>
        <span>
          {d.title} <span className="muted">· {d.active(active)}</span>
        </span>
      </summary>
      <Form id={FILTERS_FORM_ID} action={`/${lang}/app/recherche`} scroll={false} className="side-form" role="search" aria-label={f.label}>
        {query.sort === "recent" ? null : <input type="hidden" name="tri" value={query.sort} />}
        <div className="side-group">
          <label htmlFor="search-text" className="side-label">
            {d.keywords}
          </label>
          <input id="search-text" name="q" type="search" maxLength={200} defaultValue={query.text} aria-describedby="search-text-hint" />
          <p id="search-text-hint" className="side-hint">
            {d.keywordsHint}
          </p>
        </div>
        <SkillFields m={m} query={query} facets={facets} />
        <PlaceFields lang={lang} m={m} query={query} facets={facets} />
        <fieldset className="side-group" aria-describedby="search-rate-hint">
          <legend>{d.rate}</legend>
          <div className="side-pair">
            <label htmlFor="search-min-rate" className="sr-only">
              {f.minRate}
            </label>
            <input id="search-min-rate" name="tjm_min" type="text" inputMode="decimal" maxLength={12} placeholder={d.min} defaultValue={centsToField(query.minRateCents)} />
            <label htmlFor="search-max-rate" className="sr-only">
              {f.maxRate}
            </label>
            <input id="search-max-rate" name="tjm_max" type="text" inputMode="decimal" maxLength={12} placeholder={d.max} defaultValue={centsToField(query.maxRateCents)} />
          </div>
          <p id="search-rate-hint" className="side-hint">
            {f.rateHint}
          </p>
        </fieldset>
        <AvailabilityFields m={m} query={query} facets={facets} />
        <LanguageFields lang={lang} m={m} query={query} facets={facets} />
        <FactFields m={m} query={query} facets={facets} />
        {facets?.capped === true ? <p className="side-hint">{d.capped(MAX_PROFILE_SCAN)}</p> : null}
        <div className="side-actions">
          <button type="submit" className="btn btn-primary">
            {d.apply}
          </button>
          {active === 0 ? null : (
            <Link className="btn btn-quiet" href={`/${lang}/app/recherche`}>
              {f.reset}
            </Link>
          )}
        </div>
      </Form>
      <AutoSubmit formId={FILTERS_FORM_ID} />
    </details>
  );
}
