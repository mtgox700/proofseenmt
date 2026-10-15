import { SECTION_LIMITS, type EducationRecord, type ExperienceRecord } from "@proofseen/db";
import { addEducation, addExperience } from "@/app/[lang]/app/profil/section-actions";
import { month } from "@/lib/format";
import { ItemSkills, RemoveItem, SectionShell, type SectionProps } from "./SectionShell";

/** Declared experience: listed newest first, each removable, and a form to add one. */
export function ExperienceSection({ lang, s, notice, items }: SectionProps & { readonly items: readonly ExperienceRecord[] }) {
  const x = s.experiences;
  const f = x.fields;
  return (
    <SectionShell anchor="experiences" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.experiences }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((e) => (
            <li key={e.id} className="section-item">
              <div className="section-item-head">
                <strong>{e.title}</strong>
                <span className="muted small">
                  {month(e.startMonth, lang)} – {e.endMonth === null ? x.ongoing : month(e.endMonth, lang)}
                </span>
              </div>
              {e.company === null ? null : <p className="muted small">{e.companyHidden ? `${e.company} (${x.hiddenCompany})` : e.company}</p>}
              {e.description === null ? null : <p>{e.description}</p>}
              <ItemSkills skills={e.skills} />
              <RemoveItem lang={lang} section="experiences" id={e.id} label={s.remove} />
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.experiences ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <form action={addExperience}>
            <input type="hidden" name="lang" value={lang} />
            <div className="panel-grid">
              <div className="field">
                <label htmlFor="xp-title">{f.title}</label>
                <input id="xp-title" name="title" type="text" required minLength={2} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="xp-company">
                  {f.company} <span className="muted small">({s.optional})</span>
                </label>
                <input id="xp-company" name="company" type="text" maxLength={120} />
              </div>
            </div>
            <div className="field field-inline">
              <input id="xp-hidden" name="companyHidden" value="1" type="checkbox" />
              <label htmlFor="xp-hidden">{f.companyHidden}</label>
            </div>
            <div className="panel-grid">
              <div className="field">
                <label htmlFor="xp-start">{f.startMonth}</label>
                <input id="xp-start" name="startMonth" type="month" required placeholder="2023-03" aria-describedby="xp-month-hint" />
              </div>
              <div className="field">
                <label htmlFor="xp-end">{f.endMonth}</label>
                <input id="xp-end" name="endMonth" type="month" placeholder="2024-12" aria-describedby="xp-month-hint" />
                <p id="xp-month-hint" className="field-hint">
                  {x.monthHint}
                </p>
              </div>
            </div>
            <div className="field field-inline">
              <input id="xp-current" name="current" value="1" type="checkbox" />
              <label htmlFor="xp-current">{f.current}</label>
            </div>
            <div className="field">
              <label htmlFor="xp-description">
                {f.description} <span className="muted small">({s.optional})</span>
              </label>
              <textarea id="xp-description" name="description" rows={4} maxLength={2000} />
            </div>
            <div className="field">
              <label htmlFor="xp-skills">{f.skills}</label>
              <input id="xp-skills" name="skills" type="text" maxLength={1000} aria-describedby="xp-skills-hint" />
              <p id="xp-skills-hint" className="field-hint">
                {x.skillsHint}
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

const years = (start: number | null, end: number | null): string => [start, end].filter((y): y is number => y !== null).join(" – ");

/** Declared education: school, degree and years. */
export function EducationSection({ lang, s, notice, items }: SectionProps & { readonly items: readonly EducationRecord[] }) {
  const x = s.educations;
  const f = x.fields;
  return (
    <SectionShell anchor="formation" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.educations }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((e) => (
            <li key={e.id} className="section-item">
              <div className="section-item-head">
                <strong>{e.school}</strong>
                <span className="muted small">{years(e.startYear, e.endYear)}</span>
              </div>
              {e.degree === null ? null : <p className="muted small">{e.degree}</p>}
              <RemoveItem lang={lang} section="educations" id={e.id} label={s.remove} />
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.educations ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <form action={addEducation}>
            <input type="hidden" name="lang" value={lang} />
            <div className="panel-grid">
              <div className="field">
                <label htmlFor="edu-school">{f.school}</label>
                <input id="edu-school" name="school" type="text" required minLength={2} maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="edu-degree">
                  {f.degree} <span className="muted small">({s.optional})</span>
                </label>
                <input id="edu-degree" name="degree" type="text" maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="edu-start">{f.startYear}</label>
                <input id="edu-start" name="startYear" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} />
              </div>
              <div className="field">
                <label htmlFor="edu-end">{f.endYear}</label>
                <input id="edu-end" name="endYear" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} />
              </div>
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
