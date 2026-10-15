import { SECTION_LIMITS, type PortfolioRecord } from "@proofseen/db";
import { addPortfolioItem } from "@/app/[lang]/app/profil/file-actions";
import { RemoveItem, SectionShell, type SectionProps } from "./SectionShell";

/** Portfolio items: a title, an https address, an optional uploaded image. */
export function PortfolioSection({ lang, s, notice, items }: SectionProps & { readonly items: readonly PortfolioRecord[] }) {
  const x = s.portfolio;
  const f = x.fields;
  return (
    <SectionShell anchor="realisations" title={x.title} lead={x.lead} count={{ n: items.length, max: SECTION_LIMITS.portfolio }} s={s} notice={notice}>
      {items.length === 0 ? (
        <p className="muted">{x.empty}</p>
      ) : (
        <ul className="section-items">
          {items.map((p) => (
            <li key={p.id} className="section-item">
              {p.imageFileId === null ? null : <img className="portfolio-shot" src={`/fichiers/${p.imageFileId}`} alt={x.imageAlt(p.title)} loading="lazy" />}
              <div className="section-item-head">
                <strong>{p.title}</strong>
                <a className="small" href={p.url} rel="nofollow noopener noreferrer" target="_blank">
                  {new URL(p.url).host}
                </a>
              </div>
              {p.description === null ? null : <p>{p.description}</p>}
              <RemoveItem lang={lang} section="portfolio" id={p.id} label={s.remove} />
            </li>
          ))}
        </ul>
      )}
      {items.length >= SECTION_LIMITS.portfolio ? null : (
        <details className="add-item" open={items.length === 0}>
          <summary>{x.addTitle}</summary>
          <form action={addPortfolioItem}>
            <input type="hidden" name="lang" value={lang} />
            <div className="panel-grid">
              <div className="field">
                <label htmlFor="pf-title">{f.title}</label>
                <input id="pf-title" name="title" type="text" required minLength={2} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="pf-url">{f.url}</label>
                <input id="pf-url" name="url" type="url" inputMode="url" required maxLength={500} placeholder="https://" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pf-description">
                {f.description} <span className="muted small">({s.optional})</span>
              </label>
              <textarea id="pf-description" name="description" rows={3} maxLength={1000} />
            </div>
            <div className="field">
              <label htmlFor="pf-image">
                {f.image} <span className="muted small">({s.optional})</span>
              </label>
              <input id="pf-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
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
