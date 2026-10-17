import { SECTION_LIMITS, type EducationRecord } from "@proofseen/db";
import { addEducation, updateEducation } from "@/app/[lang]/app/profil/section-actions";
import type { ProfileSectionsDictionary } from "@/i18n/market/profile-sections-fr";
import { EditButtons, ItemActions, SectionShell, type SectionProps } from "./SectionShell";

const years = (start: number | null, end: number | null): string => [start, end].filter((y): y is number => y !== null).join(" – ");

/** The education form, empty to add one or filled with an item to edit it in place. */
function EducationForm({ lang, s, item }: { readonly lang: string; readonly s: ProfileSectionsDictionary; readonly item: EducationRecord | null }) {
  const x = s.educations;
  const f = x.fields;
  const p = item === null ? "edu" : "edu-edit";
  return (
    <form action={item === null ? addEducation : updateEducation}>
      <input type="hidden" name="lang" value={lang} />
      {item === null ? null : <input type="hidden" name="id" value={item.id} />}
      <div className="panel-grid">
        <div className="field">
          <label htmlFor={`${p}-school`}>{f.school}</label>
          <input id={`${p}-school`} name="school" type="text" required minLength={2} maxLength={160} defaultValue={item?.school ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-degree`}>
            {f.degree} <span className="muted small">({s.optional})</span>
          </label>
          <input id={`${p}-degree`} name="degree" type="text" maxLength={160} defaultValue={item?.degree ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-start`}>{f.startYear}</label>
          <input id={`${p}-start`} name="startYear" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={item?.startYear?.toString() ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-end`}>{f.endYear}</label>
          <input id={`${p}-end`} name="endYear" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={item?.endYear?.toString() ?? ""} />
        </div>
      </div>
      {item === null ? (
        <button type="submit" className="btn">
          {x.add}
        </button>
      ) : (
        <EditButtons lang={lang} anchor="formation" s={s} />
      )}
    </form>
  );
}

/** Declared education: school, degree and years, each editable in place or removable. */
export function EducationSection({ lang, s, notice, editing, items }: SectionProps & { readonly items: readonly EducationRecord[] }) {
  const x = s.educations;
  return (
    <SectionShell anchor="formation" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.educations }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((e) => (
            <li key={e.id} className="section-item">
              {editing === e.id ? (
                <EducationForm lang={lang} s={s} item={e} />
              ) : (
                <>
                  <div className="section-item-head">
                    <strong>{e.school}</strong>
                    <span className="muted small">{years(e.startYear, e.endYear)}</span>
                  </div>
                  {e.degree === null ? null : <p className="muted small">{e.degree}</p>}
                  <ItemActions lang={lang} anchor="formation" section="educations" id={e.id} s={s} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.educations ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <EducationForm lang={lang} s={s} item={null} />
        </details>
      )}
    </SectionShell>
  );
}
