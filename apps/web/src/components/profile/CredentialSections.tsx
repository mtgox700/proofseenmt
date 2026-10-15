import { LANGUAGE_CODES, LANGUAGE_LEVELS, SECTION_LIMITS, type CertificationRecord, type LanguageRecord } from "@proofseen/db";
import { languageName } from "@proofseen/hub";
import { addCertification, removeLanguage, setLanguage } from "@/app/[lang]/app/profil/section-actions";
import type { Lang } from "@/i18n";
import { ItemSkills, RemoveItem, SectionShell, type SectionProps } from "./SectionShell";

/** Declared certifications, each linked to the skills it attests. */
export function CertificationSection({ lang, s, notice, items }: SectionProps & { readonly items: readonly CertificationRecord[] }) {
  const x = s.certifications;
  const f = x.fields;
  return (
    <SectionShell anchor="certifications" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.certifications }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((c) => (
            <li key={c.id} className="section-item">
              <div className="section-item-head">
                <strong>{c.name}</strong>
                <span className="muted small">{[c.issuer, c.year === null ? null : String(c.year)].filter((part): part is string => part !== null).join(" · ")}</span>
              </div>
              {c.credentialUrl === null ? null : (
                <p className="small">
                  <a href={c.credentialUrl} rel="nofollow noopener noreferrer" target="_blank">
                    {x.verify}
                  </a>
                </p>
              )}
              <ItemSkills skills={c.skills} />
              <RemoveItem lang={lang} section="certifications" id={c.id} label={s.remove} />
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.certifications ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <form action={addCertification}>
            <input type="hidden" name="lang" value={lang} />
            <div className="panel-grid">
              <div className="field">
                <label htmlFor="cert-name">{f.name}</label>
                <input id="cert-name" name="name" type="text" required minLength={2} maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="cert-issuer">
                  {f.issuer} <span className="muted small">({s.optional})</span>
                </label>
                <input id="cert-issuer" name="issuer" type="text" maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="cert-year">{f.year}</label>
                <input id="cert-year" name="year" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="cert-url">
                {f.credentialUrl} <span className="muted small">({s.optional})</span>
              </label>
              <input id="cert-url" name="credentialUrl" type="url" inputMode="url" maxLength={500} placeholder="https://" />
            </div>
            <div className="field">
              <label htmlFor="cert-skills">{f.skills}</label>
              <input id="cert-skills" name="skills" type="text" maxLength={1000} aria-describedby="cert-skills-hint" />
              <p id="cert-skills-hint" className="field-hint">
                {s.experiences.skillsHint}
              </p>
            </div>
            <button type="submit" className="btn">
              {x.add}
            </button>
          </form>
        </details>
      )}
    </SectionShell>
  );
}

/** Language names sorted for the language of the page. */
const languageOptions = (lang: Lang): readonly { readonly code: string; readonly name: string }[] =>
  LANGUAGE_CODES.map((code) => ({ code, name: languageName(code, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang));

/** Languages and the declared level: one line per language, set again to change the level. */
export function LanguageSection({ lang, s, notice, items }: SectionProps & { readonly items: readonly LanguageRecord[] }) {
  const x = s.languages;
  return (
    <SectionShell anchor="langues" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.languages }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((l) => (
            <li key={l.code} className="section-item">
              <div className="section-item-head">
                <strong>{languageName(l.code, lang)}</strong>
                <span className="muted small">{x.levels[l.level]}</span>
              </div>
              <form action={removeLanguage}>
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="code" value={l.code} />
                <button type="submit" className="btn btn-quiet">
                  {s.remove}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={setLanguage} className="panel-grid">
        <input type="hidden" name="lang" value={lang} />
        <div className="field">
          <label htmlFor="lang-code">{x.fields.code}</label>
          <select id="lang-code" name="code" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {languageOptions(lang).map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lang-level">{x.fields.level}</label>
          <select id="lang-level" name="level" required defaultValue="b2" aria-describedby="lang-hint">
            {LANGUAGE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {x.levels[level]}
              </option>
            ))}
          </select>
          <p id="lang-hint" className="field-hint">
            {x.hint}
          </p>
        </div>
        <button type="submit" className="btn">
          {x.add}
        </button>
      </form>
    </SectionShell>
  );
}
