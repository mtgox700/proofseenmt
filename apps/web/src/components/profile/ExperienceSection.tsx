import { SECTION_LIMITS, type ExperienceRecord } from "@proofseen/db";
import { addExperience, updateExperience } from "@/app/[lang]/app/profil/section-actions";
import type { ProfileSectionsDictionary } from "@/i18n/market/profile-sections-fr";
import { month } from "@/lib/format";
import { monthField } from "@/lib/profile-sections-form";
import { EditButtons, ItemActions, ItemSkills, SectionShell, type SectionProps } from "./SectionShell";

/**
 * The experience form, empty to add one or filled with an item to edit it in place. Field ids carry a prefix so the
 * add form and an open edit form never share one.
 */
function ExperienceForm({ lang, s, item }: { readonly lang: string; readonly s: ProfileSectionsDictionary; readonly item: ExperienceRecord | null }) {
  const x = s.experiences;
  const f = x.fields;
  const p = item === null ? "xp" : "xp-edit";
  return (
    <form action={item === null ? addExperience : updateExperience}>
      <input type="hidden" name="lang" value={lang} />
      {item === null ? null : <input type="hidden" name="id" value={item.id} />}
      <div className="panel-grid">
        <div className="field">
          <label htmlFor={`${p}-title`}>{f.title}</label>
          <input id={`${p}-title`} name="title" type="text" required minLength={2} maxLength={120} defaultValue={item?.title ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-company`}>
            {f.company} <span className="muted small">({s.optional})</span>
          </label>
          <input id={`${p}-company`} name="company" type="text" maxLength={120} defaultValue={item?.company ?? ""} />
        </div>
      </div>
      <div className="field field-inline">
        <input id={`${p}-hidden`} name="companyHidden" value="1" type="checkbox" defaultChecked={item?.companyHidden ?? false} />
        <label htmlFor={`${p}-hidden`}>{f.companyHidden}</label>
      </div>
      <div className="panel-grid">
        <div className="field">
          <label htmlFor={`${p}-start`}>{f.startMonth}</label>
          <input id={`${p}-start`} name="startMonth" type="month" required placeholder="2023-03" aria-describedby={`${p}-month-hint`} defaultValue={monthField(item?.startMonth ?? null)} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-end`}>{f.endMonth}</label>
          <input id={`${p}-end`} name="endMonth" type="month" placeholder="2024-12" aria-describedby={`${p}-month-hint`} defaultValue={monthField(item?.endMonth ?? null)} />
          <p id={`${p}-month-hint`} className="field-hint">
            {x.monthHint}
          </p>
        </div>
      </div>
      <div className="field field-inline">
        <input id={`${p}-current`} name="current" value="1" type="checkbox" defaultChecked={item !== null && item.endMonth === null} />
        <label htmlFor={`${p}-current`}>{f.current}</label>
      </div>
      <div className="field">
        <label htmlFor={`${p}-description`}>
          {f.description} <span className="muted small">({s.optional})</span>
        </label>
        <textarea id={`${p}-description`} name="description" rows={4} maxLength={2000} defaultValue={item?.description ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`${p}-skills`}>{f.skills}</label>
        <input id={`${p}-skills`} name="skills" type="text" maxLength={1000} aria-describedby={`${p}-skills-hint`} defaultValue={item?.skills.join(", ") ?? ""} />
        <p id={`${p}-skills-hint`} className="field-hint">
          {x.skillsHint}
        </p>
      </div>
      {item === null ? (
        <button type="submit" className="btn">
          {x.add}
        </button>
      ) : (
        <EditButtons lang={lang} anchor="experiences" s={s} />
      )}
    </form>
  );
}

/** Declared experience: listed newest first, each editable in place or removable, and a form to add one. */
export function ExperienceSection({ lang, s, notice, editing, items }: SectionProps & { readonly items: readonly ExperienceRecord[] }) {
  const x = s.experiences;
  return (
    <SectionShell anchor="experiences" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.experiences }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((e) => (
            <li key={e.id} className="section-item">
              {editing === e.id ? (
                <ExperienceForm lang={lang} s={s} item={e} />
              ) : (
                <>
                  <div className="section-item-head">
                    <strong>{e.title}</strong>
                    <span className="muted small">
                      {month(e.startMonth, lang)} – {e.endMonth === null ? x.ongoing : month(e.endMonth, lang)}
                    </span>
                  </div>
                  {e.company === null ? null : <p className="muted small">{e.companyHidden ? `${e.company} (${x.hiddenCompany})` : e.company}</p>}
                  {e.description === null ? null : <p>{e.description}</p>}
                  <ItemSkills skills={e.skills} />
                  <ItemActions lang={lang} anchor="experiences" section="experiences" id={e.id} s={s} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.experiences ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <ExperienceForm lang={lang} s={s} item={null} />
        </details>
      )}
    </SectionShell>
  );
}
