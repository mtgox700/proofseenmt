import Link from "next/link";
import "@/styles/visibility.css";
import type { Lang } from "@/i18n";
import type { ChecklistDictionary } from "@/i18n/market/checklist-fr";
import { MIN_SKILLS, MIN_SUMMARY_CHARS, type Checklist, type ChecklistGroup, type ChecklistItem, type ChecklistKey } from "@/lib/profile-checklist";

const GROUPS: readonly ChecklistGroup[] = ["page", "proof"];

const labelOf = (key: ChecklistKey, c: ChecklistDictionary): string => {
  if (key === "summary") return c.items.summary.label(MIN_SUMMARY_CHARS);
  if (key === "skills") return c.items.skills.label(MIN_SKILLS);
  return c.items[key].label;
};

function Item({ c, item }: { readonly c: ChecklistDictionary; readonly item: ChecklistItem }) {
  return (
    <li data-done={item.done ? "" : undefined}>
      <span className={item.done ? "tag tag-proof" : "tag tag-signal"}>{item.done ? c.done : c.todo}</span>
      <div className="vis-todo-body">
        <strong>{labelOf(item.key, c)}</strong>
        {item.note === null ? null : <span>{c.notes[item.note]}</span>}
        <span className="muted small">{c.items[item.key].why}</span>
        {item.done ? null : <Link href={item.href}>{c.fix}</Link>}
      </div>
    </li>
  );
}

/** The facts an AI needs to read on the public profile, each done or missing, why it matters and where to fix it. */
export function ProfileChecklist({ c, checklist, headingId }: { readonly c: ChecklistDictionary; readonly checklist: Checklist; readonly headingId: string }) {
  return (
    <section className="panel" aria-labelledby={headingId} id="liste-de-controle">
      <h2 id={headingId}>{c.title}</h2>
      <p className="muted measure">{c.lead}</p>
      <p>
        <strong>{checklist.missing === 0 ? c.allDone : c.missing(checklist.missing)}</strong>
      </p>
      {GROUPS.map((group) => (
        <div key={group} className="vis-todo-body">
          <h3 className="vis-group">{c.groups[group]}</h3>
          <ul className="vis-todo">
            {checklist.items
              .filter((item) => item.group === group)
              .map((item) => (
                <Item key={item.key} c={c} item={item} />
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** One line for the home page: how many facts are missing, and the way to the full list. */
export function ChecklistSummary({ lang, c, checklist }: { readonly lang: Lang; readonly c: ChecklistDictionary; readonly checklist: Checklist }) {
  return (
    <div className="tile">
      <span className="tile-label">{c.title}</span>
      <b className="tile-value vis-tile-text">{checklist.missing === 0 ? c.allDone : c.missing(checklist.missing)}</b>
      {checklist.missing === 0 ? null : (
        <Link className="tile-foot" href={`/${lang}/app/profil#liste-de-controle`}>
          {c.seeAll}
        </Link>
      )}
    </div>
  );
}
