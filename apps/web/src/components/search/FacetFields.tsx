import Link from "next/link";
import { AVAILABILITY_FRESH_DAYS, JOB_TITLES, LANGUAGE_CODES, LANGUAGE_LEVELS, MAX_LANGUAGE_FILTERS, type ProfileFacets } from "@proofseen/db";
import { languageName } from "@proofseen/hub";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { searchHref, WORK_MODES, type SearchQuery } from "@/lib/freelancer-search";

/*
 * The sections of the company search's filter panel. Each option carries the number of published profiles it would
 * keep (facets): counts of profiles, never a mark on anyone. Plain inputs of one GET form: no script needed.
 */

export interface FacetFieldsProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly query: SearchQuery;
  readonly facets: ProfileFacets | null;
}

const MAX_SUGGESTED_SKILLS = 8;
const MAX_CITY_LINKS = 6;
const LANGUAGE_SLOTS = Array.from({ length: MAX_LANGUAGE_FILTERS }, (_, i) => i);

/** A count next to an option, hidden from nothing: screen readers read it as part of the label. */
function Count({ n }: { readonly n: number | undefined }) {
  return n === undefined ? null : <span className="n">{n}</span>;
}

function Check({ id, name, value = "1", checked, label, count }: { readonly id: string; readonly name: string; readonly value?: string; readonly checked: boolean; readonly label: string; readonly count?: number | undefined }) {
  return (
    <div className="check">
      <input id={id} name={name} value={value} type="checkbox" defaultChecked={checked} />
      <label htmlFor={id}>{label}</label>
      <Count n={count} />
    </div>
  );
}

export function SkillFields({ m, query, facets }: Omit<FacetFieldsProps, "lang">) {
  const d = m.discovery.filters;
  const chosen = new Set(query.skills.map((s) => s.toLowerCase()));
  const suggested = (facets?.skills ?? []).filter((s) => !chosen.has(s.label.toLowerCase())).slice(0, MAX_SUGGESTED_SKILLS);
  const counts = new Map((facets?.skills ?? []).map((s) => [s.label.toLowerCase(), s.count]));
  return (
    <fieldset className="side-group">
      <legend>{d.skills}</legend>
      {query.skills.map((skill, i) => (
        <Check key={skill} id={`skill-on-${i}`} name="competence" value={skill} checked label={skill} count={counts.get(skill.toLowerCase())} />
      ))}
      {suggested.length === 0 ? null : <p className="side-hint">{d.suggestions}</p>}
      {suggested.map((s, i) => (
        <Check key={s.key} id={`skill-suggest-${i}`} name="competence" value={s.label} checked={false} label={s.label} count={s.count} />
      ))}
      <label htmlFor="search-add-skill" className="side-label">
        {d.addSkill}
      </label>
      <input id="search-add-skill" name="competence" type="search" maxLength={60} list="search-skill-options" aria-describedby="search-add-skill-hint" />
      <datalist id="search-skill-options">
        {(facets?.skills ?? []).map((s) => (
          <option key={s.key} value={s.label} />
        ))}
      </datalist>
      <p id="search-add-skill-hint" className="side-hint">
        {d.addSkillHint}
      </p>
    </fieldset>
  );
}

export function PlaceFields({ lang, m, query, facets }: FacetFieldsProps) {
  const d = m.discovery.filters;
  const counts = new Map((facets?.jobTitles ?? []).map((t) => [t.key, t.count]));
  const titles = JOB_TITLES.filter((t) => counts.has(t.key) || t.key === query.jobTitle).sort((a, b) => a.label[lang].localeCompare(b.label[lang], lang));
  const cities = (facets?.cities ?? []).slice(0, MAX_CITY_LINKS);
  return (
    <>
      <div className="side-group">
        <label htmlFor="search-job-title" className="side-label">
          {d.jobTitle}
        </label>
        <select id="search-job-title" name="poste" defaultValue={query.jobTitle}>
          <option value="">{d.anyJobTitle}</option>
          {titles.map((t) => (
            <option key={t.key} value={t.key}>
              {`${t.label[lang]} (${counts.get(t.key) ?? 0})`}
            </option>
          ))}
        </select>
      </div>
      <div className="side-group">
        <label htmlFor="search-city" className="side-label">
          {d.city}
        </label>
        <input id="search-city" name="ville" type="search" maxLength={120} defaultValue={query.city} autoComplete="address-level2" list="search-city-options" />
        <datalist id="search-city-options">
          {(facets?.cities ?? []).map((c) => (
            <option key={c.key} value={c.label} />
          ))}
        </datalist>
        {cities.length === 0 ? null : (
          <ul className="side-links" aria-label={d.cities}>
            {cities.map((c) => (
              <li key={c.key}>
                <Link href={searchHref(lang, { ...query, city: c.label, page: 1 })} aria-current={c.label.toLowerCase() === query.city.toLowerCase() ? "true" : undefined} scroll={false}>
                  {c.label} <span className="n">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <fieldset className="side-group">
        <legend>{d.mode}</legend>
        {WORK_MODES.map((mode) => (
          <Check key={mode} id={`search-mode-${mode}`} name="mode" value={mode} checked={query.workModes.includes(mode)} label={m.missions.workModes[mode]} count={facets?.workModes[mode]} />
        ))}
      </fieldset>
    </>
  );
}

export function AvailabilityFields({ m, query, facets }: Omit<FacetFieldsProps, "lang">) {
  const d = m.discovery.filters;
  const f = m.search.form;
  return (
    <fieldset className="side-group">
      <legend>{d.availability}</legend>
      <Check id="search-available-now" name="maintenant" checked={query.availableNow} label={d.availableNow} count={facets?.facts.availableNow} />
      <Check id="search-available-only" name="disponible" checked={query.availableOnly} label={f.availableOnly} />
      <label htmlFor="search-available-by" className="side-label">
        {f.availableBy}
      </label>
      <input id="search-available-by" name="dispo_avant" type="date" defaultValue={query.availableBy ?? ""} />
      <p className="side-hint">{f.availabilityFresh(AVAILABILITY_FRESH_DAYS)}</p>
    </fieldset>
  );
}

/** Up to three languages, each with the lowest level that satisfies it; options show how many results declare them. */
export function LanguageFields({ lang, m, query, facets }: FacetFieldsProps) {
  const f = m.search.form;
  const counts = new Map((facets?.languages ?? []).map((l) => [l.code, l.count]));
  const options = LANGUAGE_CODES.map((code) => ({ code, name: languageName(code, lang), count: counts.get(code) })).sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, lang));
  return (
    <fieldset className="side-group" aria-describedby="search-languages-hint">
      <legend>{f.languages}</legend>
      <p id="search-languages-hint" className="side-hint">
        {f.languagesHint}
      </p>
      {LANGUAGE_SLOTS.map((i) => {
        const chosen = query.languages[i];
        return (
          <div key={i} className="side-pair">
            <label htmlFor={`search-language-${i}`} className="sr-only">
              {f.language(i + 1)}
            </label>
            <select id={`search-language-${i}`} name="langue" defaultValue={chosen?.code ?? ""}>
              <option value="">{f.noLanguage}</option>
              {options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.count === undefined ? o.name : `${o.name} (${o.count})`}
                </option>
              ))}
            </select>
            <label htmlFor={`search-level-${i}`} className="sr-only">
              {f.minLevel(i + 1)}
            </label>
            <select id={`search-level-${i}`} name="niveau" defaultValue={chosen?.minLevel ?? "b2"}>
              {LANGUAGE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {f.levels[level]}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </fieldset>
  );
}

export function FactFields({ m, query, facets }: Omit<FacetFieldsProps, "lang">) {
  const d = m.discovery.filters;
  const f = m.search.form;
  const n = facets?.facts;
  return (
    <>
      <fieldset className="side-group">
        <legend>{f.facts}</legend>
        <Check id="search-adresse" name="adresse" checked={query.provenOnly} label={f.proven} count={n?.proven} />
        <Check id="search-missions" name="missions" checked={query.verifiedMissionsOnly} label={d.missions} count={n?.verifiedMissions} />
        <Check id="search-siret" name="siret" checked={query.registryActiveOnly} label={f.registry} count={n?.registryActive} />
        <Check id="search-urssaf" name="urssaf" checked={query.vigilanceValidOnly} label={f.vigilance} count={n?.vigilanceValid} />
      </fieldset>
      <fieldset className="side-group">
        <legend>{d.profile}</legend>
        <Check id="search-photo" name="photo" checked={query.photoOnly} label={d.photo} count={n?.photo} />
        <Check id="search-realisations" name="realisations" checked={query.portfolioOnly} label={d.portfolio} count={n?.portfolio} />
        <p className="side-hint">{d.seniority}</p>
      </fieldset>
    </>
  );
}
