import type { ReactNode } from "react";
import "@/styles/profile.css";
import type { Lang } from "@/i18n";
import type { ProfileSectionsDictionary } from "@/i18n/market/profile-sections-fr";
import type { SectionAnchor, SectionNotice } from "@/lib/profile-notice";
import { removeSectionItem } from "@/app/[lang]/app/profil/section-actions";

export interface SectionProps {
  readonly lang: Lang;
  readonly s: ProfileSectionsDictionary;
  readonly notice: SectionNotice | null;
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
