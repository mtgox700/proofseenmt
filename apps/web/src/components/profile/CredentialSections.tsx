import { LANGUAGE_CODES, LANGUAGE_LEVELS, SECTION_LIMITS, type CertificationRecord, type LanguageRecord } from "@proofseen/db";
import { languageName } from "@proofseen/hub";
import { addCertification, removeLanguage, setLanguage, updateCertification } from "@/app/[lang]/app/profil/section-actions";
import type { Lang } from "@/i18n";
import type { ProfileSectionsDictionary } from "@/i18n/market/profile-sections-fr";
import { EditButtons, EditItem, ItemActions, ItemSkills, SectionShell, type SectionProps } from "./SectionShell";

/** The certification form, empty to add one or filled with an item to edit it in place. */
function CertificationForm({ lang, s, item }: { readonly lang: string; readonly s: ProfileSectionsDictionary; readonly item: CertificationRecord | null }) {
  const x = s.certifications;
  const f = x.fields;
  const p = item === null ? "cert" : "cert-edit";
  return (
    <form action={item === null ? addCertification : updateCertification}>
      <input type="hidden" name="lang" value={lang} />
      {item === null ? null : <input type="hidden" name="id" value={item.id} />}
      <div className="panel-grid">
        <div className="field">
          <label htmlFor={`${p}-name`}>{f.name}</label>
          <input id={`${p}-name`} name="name" type="text" required minLength={2} maxLength={160} defaultValue={item?.name ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-issuer`}>
            {f.issuer} <span className="muted small">({s.optional})</span>
          </label>
          <input id={`${p}-issuer`} name="issuer" type="text" maxLength={160} defaultValue={item?.issuer ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-year`}>{f.year}</label>
          <input id={`${p}-year`} name="year" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={item?.year?.toString() ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${p}-url`}>
          {f.credentialUrl} <span className="muted small">({s.optional})</span>
        </label>
        <input id={`${p}-url`} name="credentialUrl" type="url" inputMode="url" maxLength={500} placeholder="https://" defaultValue={item?.credentialUrl ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`${p}-skills`}>{f.skills}</label>
        <input id={`${p}-skills`} name="skills" type="text" maxLength={1000} aria-describedby={`${p}-skills-hint`} defaultValue={item?.skills.join(", ") ?? ""} />
        <p id={`${p}-skills-hint`} className="field-hint">
          {s.experiences.skillsHint}
        </p>
      </div>
      {item === null ? (
        <button type="submit" className="btn">
          {x.add}
        </button>
      ) : (
        <EditButtons lang={lang} anchor="certifications" s={s} />
      )}
    </form>
  );
}

/** Declared certifications, each linked to the skills it attests, editable in place or removable. */
export function CertificationSection({ lang, s, notice, editing, items }: SectionProps & { readonly items: readonly CertificationRecord[] }) {
  const x = s.certifications;
  return (
    <SectionShell anchor="certifications" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.certifications }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((c) => (
            <li key={c.id} className="section-item">
              {editing === c.id ? (
                <CertificationForm lang={lang} s={s} item={c} />
              ) : (
                <>
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
                  <ItemActions lang={lang} anchor="certifications" section="certifications" id={c.id} s={s} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.certifications ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <CertificationForm lang={lang} s={s} item={null} />
        </details>
      )}
    </SectionShell>
  );
}

/** Language names sorted for the language of the page. */
const languageOptions = (lang: Lang): readonly { readonly code: string; readonly name: string }[] =>
  LANGUAGE_CODES.map((code) => ({ code, name: languageName(code, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang));

/** The level select of a language form, starting on `level`. */
function LevelSelect({ id, s, level, hintId }: { readonly id: string; readonly s: ProfileSectionsDictionary; readonly level: string; readonly hintId: string }) {
  return (
    <select id={id} name="level" required defaultValue={level} aria-describedby={hintId}>
      {LANGUAGE_LEVELS.map((value) => (
        <option key={value} value={value}>
          {s.languages.levels[value]}
        </option>
      ))}
    </select>
  );
}

/** Changes the level of one listed language: the language itself stays, as one line per language. */
function LanguageEditForm({ lang, s, item }: { readonly lang: Lang; readonly s: ProfileSectionsDictionary; readonly item: LanguageRecord }) {
  const x = s.languages;
  return (
    <form action={setLanguage} className="panel-grid">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="code" value={item.code} />
      <div className="field">
        <label htmlFor="lang-edit-level">
          {x.fields.level} · {languageName(item.code, lang)}
        </label>
        <LevelSelect id="lang-edit-level" s={s} level={item.level} hintId="lang-edit-hint" />
        <p id="lang-edit-hint" className="field-hint">
          {x.editHint}
        </p>
      </div>
      <EditButtons lang={lang} anchor="langues" s={s} />
    </form>
  );
}

/** Languages and the declared level: one line per language, its level edited in place. */
export function LanguageSection({ lang, s, notice, editing, items }: SectionProps & { readonly items: readonly LanguageRecord[] }) {
  const x = s.languages;
  return (
    <SectionShell anchor="langues" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.languages }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((l) => (
            <li key={l.code} className="section-item">
              {editing === l.code ? (
                <LanguageEditForm lang={lang} s={s} item={l} />
              ) : (
                <>
                  <div className="section-item-head">
                    <strong>{languageName(l.code, lang)}</strong>
                    <span className="muted small">{x.levels[l.level]}</span>
                  </div>
                  <div className="row-actions">
                    <EditItem lang={lang} anchor="langues" id={l.code} label={s.edit} />
                    <form action={removeLanguage}>
                      <input type="hidden" name="lang" value={lang} />
                      <input type="hidden" name="code" value={l.code} />
                      <button type="submit" className="btn btn-quiet">
                        {s.remove}
                      </button>
                    </form>
                  </div>
                </>
              )}
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
              {x.fields.pick}
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
          <LevelSelect id="lang-level" s={s} level="b2" hintId="lang-hint" />
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
