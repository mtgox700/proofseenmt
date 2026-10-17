import { SECTION_LIMITS, type PortfolioRecord } from "@proofseen/db";
import { addPortfolioItem, updatePortfolioItem } from "@/app/[lang]/app/profil/file-actions";
import type { ProfileSectionsDictionary } from "@/i18n/market/profile-sections-fr";
import { EditButtons, ItemActions, SectionShell, type SectionProps } from "./SectionShell";

/**
 * The portfolio form, empty to add an item or filled to edit one in place. Editing keeps the current image unless a new
 * one is uploaded (it replaces it) or "remove the image" is ticked.
 */
function PortfolioForm({ lang, s, item }: { readonly lang: string; readonly s: ProfileSectionsDictionary; readonly item: PortfolioRecord | null }) {
  const x = s.portfolio;
  const f = x.fields;
  const p = item === null ? "pf" : "pf-edit";
  return (
    <form action={item === null ? addPortfolioItem : updatePortfolioItem}>
      <input type="hidden" name="lang" value={lang} />
      {item === null ? null : <input type="hidden" name="id" value={item.id} />}
      <div className="panel-grid">
        <div className="field">
          <label htmlFor={`${p}-title`}>{f.title}</label>
          <input id={`${p}-title`} name="title" type="text" required minLength={2} maxLength={120} defaultValue={item?.title ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`${p}-url`}>{f.url}</label>
          <input id={`${p}-url`} name="url" type="url" inputMode="url" required maxLength={500} placeholder="https://" defaultValue={item?.url ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${p}-description`}>
          {f.description} <span className="muted small">({s.optional})</span>
        </label>
        <textarea id={`${p}-description`} name="description" rows={3} maxLength={1000} defaultValue={item?.description ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`${p}-image`}>
          {item === null ? f.image : f.replaceImage} {item === null ? <span className="muted small">({s.optional})</span> : null}
        </label>
        <input id={`${p}-image`} name="image" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      {item === null || item.imageFileId === null ? null : (
        <div className="field field-inline">
          <input id={`${p}-remove-image`} name="removeImage" value="1" type="checkbox" />
          <label htmlFor={`${p}-remove-image`}>{f.removeImage}</label>
        </div>
      )}
      {item === null ? (
        <button type="submit" className="btn">
          {x.add}
        </button>
      ) : (
        <EditButtons lang={lang} anchor="realisations" s={s} />
      )}
    </form>
  );
}

/** Portfolio items: a title, an https address, an optional uploaded image; each editable in place or removable. */
export function PortfolioSection({ lang, s, notice, editing, items }: SectionProps & { readonly items: readonly PortfolioRecord[] }) {
  const x = s.portfolio;
  return (
    <SectionShell anchor="realisations" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.portfolio }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((p) => (
            <li key={p.id} className="section-item">
              {p.imageFileId === null ? null : <img className="portfolio-shot" src={`/fichiers/${p.imageFileId}`} alt={x.imageAlt(p.title)} loading="lazy" />}
              {editing === p.id ? (
                <PortfolioForm lang={lang} s={s} item={p} />
              ) : (
                <>
                  <div className="section-item-head">
                    <strong>{p.title}</strong>
                    <a className="small" href={p.url} rel="nofollow noopener noreferrer" target="_blank">
                      {new URL(p.url).host}
                    </a>
                  </div>
                  {p.description === null ? null : <p>{p.description}</p>}
                  <ItemActions lang={lang} anchor="realisations" section="portfolio" id={p.id} s={s} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.portfolio ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <PortfolioForm lang={lang} s={s} item={null} />
        </details>
      )}
    </SectionShell>
  );
}
