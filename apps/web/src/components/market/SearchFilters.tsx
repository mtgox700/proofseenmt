import Link from "next/link";
import { AVAILABILITY_FRESH_DAYS } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { centsToField } from "@/lib/mission-form";
import { SORT_SLUGS, WORK_MODES, type SearchQuery, type SortSlug } from "@/lib/freelancer-search";

interface SearchFiltersProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly query: SearchQuery;
}

const SORTS = Object.keys(SORT_SLUGS) as SortSlug[];

/**
 * The company search form: a plain GET form, so every search has its own address and works without script. Every
 * filter, including those a brief suggested, is visible here and editable; the order is chosen here too.
 */
export function SearchFilters({ lang, m, query }: SearchFiltersProps) {
  const f = m.search.form;
  return (
    <form className="filters" method="get" action={`/${lang}/app/recherche`} role="search" aria-label={f.label}>
      <div className="field">
        <label htmlFor="search-skills">{f.skills}</label>
        <input id="search-skills" name="competences" type="search" maxLength={700} defaultValue={query.skills.join(", ")} aria-describedby="search-skills-hint" />
        <p id="search-skills-hint" className="field-hint">{f.skillsHint}</p>
      </div>
      <div className="field">
        <label htmlFor="search-city">{f.city}</label>
        <input id="search-city" name="ville" type="search" maxLength={120} defaultValue={query.city} autoComplete="address-level2" />
      </div>
      <fieldset className="fieldset">
        <legend>{f.workModes}</legend>
        {WORK_MODES.map((mode) => (
          <div key={mode} className="field field-inline">
            <input id={`search-mode-${mode}`} name="mode" value={mode} type="checkbox" defaultChecked={query.workModes.includes(mode)} />
            <label htmlFor={`search-mode-${mode}`}>{m.missions.workModes[mode]}</label>
          </div>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="search-min-rate">{f.minRate}</label>
        <input id="search-min-rate" name="tjm_min" type="text" inputMode="decimal" maxLength={12} defaultValue={centsToField(query.minRateCents)} aria-describedby="search-rate-hint" />
      </div>
      <div className="field">
        <label htmlFor="search-max-rate">{f.maxRate}</label>
        <input id="search-max-rate" name="tjm_max" type="text" inputMode="decimal" maxLength={12} defaultValue={centsToField(query.maxRateCents)} aria-describedby="search-rate-hint" />
        <p id="search-rate-hint" className="field-hint">{f.rateHint}</p>
      </div>
      <div className="field">
        <label htmlFor="search-available-by">{f.availableBy}</label>
        <input id="search-available-by" name="dispo_avant" type="date" defaultValue={query.availableBy ?? ""} />
        <div className="field field-inline">
          <input id="search-available-only" name="disponible" value="1" type="checkbox" defaultChecked={query.availableOnly} />
          <label htmlFor="search-available-only">{f.availableOnly}</label>
        </div>
        <p className="field-hint">{f.availabilityFresh(AVAILABILITY_FRESH_DAYS)}</p>
      </div>
      <fieldset className="fieldset">
        <legend>{f.facts}</legend>
        {(
          [
            ["adresse", f.proven, query.provenOnly],
            ["siret", f.registry, query.registryActiveOnly],
            ["urssaf", f.vigilance, query.vigilanceValidOnly],
          ] as const
        ).map(([name, label, checked]) => (
          <div key={name} className="field field-inline">
            <input id={`search-${name}`} name={name} value="1" type="checkbox" defaultChecked={checked} />
            <label htmlFor={`search-${name}`}>{label}</label>
          </div>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="search-sort">{f.sort}</label>
        <select id="search-sort" name="tri" defaultValue={query.sort}>
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {f.sorts[sort]}
            </option>
          ))}
        </select>
      </div>
      <div className="filters-actions">
        <button type="submit" className="btn btn-primary">
          {f.submit}
        </button>
        <Link className="btn btn-quiet" href={`/${lang}/app/recherche`}>
          {f.reset}
        </Link>
      </div>
    </form>
  );
}
