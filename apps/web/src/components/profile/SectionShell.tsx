import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/profile.css";
import type { Lang } from "@/i18n";
import type { ProfileSectionsDictionary } from "@/i18n/market/profile-sections-fr";
import { editHref, type SectionAnchor, type SectionNotice } from "@/lib/profile-notice";
import { removeSectionItem } from "@/app/[lang]/app/profil/section-actions";

export interface SectionProps {
  readonly lang: Lang;
  readonly s: ProfileSectionsDictionary;
  readonly notice: SectionNotice | null;
  /** The item whose edit form is open (`?modifier=`): an id, or a language code. */
  readonly editing?: string | null;
}

/** One section of the profile: its title, why it matters, the notice of the last action on it, then its content. */
export function SectionShell({ anchor, title, lead, count, s, notice, children }: { readonly anchor: SectionAnchor; readonly title: string; readonly lead: string; readonly count?: { readonly n: number; readonly max: number }; readonly s: ProfileSectionsDictionary; readonly notice: SectionNotice | null; readonly children: ReactNode }) {
  const shown = notice !== null && notice.anchor === anchor ? notice : null;
  return (
    <section className="panel" id={anchor} aria-labelledby={`${anchor}-title`}>
      <h2 id={`${anchor}-title`}>
        {title}
        {count === undefined ? null : <span className="muted small"> · {s.count(count.n, count.max)}</span>}
      </h2>
      <p className="muted measure">{lead}</p>
      {shown === null ? null : (
        <p className={shown.ok ? "form-ok" : "form-error"} role={shown.ok ? "status" : "alert"}>
          {s.notices[shown.code]}
        </p>
      )}
      {children}
    </section>
  );
}

/** Removes one declared item; the repository checks it belongs to the signed-in freelancer. */
export function RemoveItem({ lang, section, id, label }: { readonly lang: string; readonly section: "experiences" | "educations" | "certifications" | "portfolio"; readonly id: string; readonly label: string }) {
  return (
    <form action={removeSectionItem}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-quiet">
        {label}
      </button>
    </form>
  );
}

/** Opens the edit form of one item, rendered by the server: a plain link, no script. */
export function EditItem({ lang, anchor, id, label }: { readonly lang: string; readonly anchor: SectionAnchor; readonly id: string; readonly label: string }) {
  return (
    <Link className="btn btn-quiet" href={editHref(lang, anchor, id)}>
      {label}
    </Link>
  );
}

/** The actions under a listed item: edit it, remove it. */
export function ItemActions({ lang, anchor, section, id, s }: { readonly lang: string; readonly anchor: SectionAnchor; readonly section: "experiences" | "educations" | "certifications" | "portfolio"; readonly id: string; readonly s: ProfileSectionsDictionary }) {
  return (
    <div className="row-actions">
      <EditItem lang={lang} anchor={anchor} id={id} label={s.edit} />
      <RemoveItem lang={lang} section={section} id={id} label={s.remove} />
    </div>
  );
}

/** The buttons of an edit form: save the changes, or leave the form unchanged. */
export function EditButtons({ lang, anchor, s }: { readonly lang: string; readonly anchor: SectionAnchor; readonly s: ProfileSectionsDictionary }) {
  return (
    <div className="row-actions">
      <button type="submit" className="btn btn-primary">
        {s.saveChanges}
      </button>
      <Link className="btn btn-quiet" href={`/${lang}/app/profil#${anchor}`}>
        {s.cancel}
      </Link>
    </div>
  );
}

/** The skills linked to an item, as tags. */
export function ItemSkills({ skills }: { readonly skills: readonly string[] }) {
  if (skills.length === 0) return null;
  return (
    <ul className="section-tags">
      {skills.map((skill) => (
        <li key={skill} className="tag tag-quiet">
          {skill}
        </li>
      ))}
    </ul>
  );
}
