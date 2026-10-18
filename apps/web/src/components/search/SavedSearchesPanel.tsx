import Link from "next/link";
import type { SavedSearchSummary } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { searchHref, searchParamsOf, searchQuery, type SearchQuery } from "@/lib/freelancer-search";
import { deleteSavedSearch, saveSearch, setSavedSearchAlert } from "@/app/[lang]/app/recherche/saved-actions";

interface SavedSearchesPanelProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly query: SearchQuery;
  readonly items: readonly SavedSearchSummary[];
  /** The outcome code of the last saved-search action, already checked against the known codes. */
  readonly notice: keyof MarketDictionary["discovery"]["saved"]["notices"] | null;
}

const OK_NOTICES = new Set(["saved", "alert", "deleted"]);

function Hidden({ lang, back }: { readonly lang: Lang; readonly back: string }) {
  return (
    <>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="back" value={back} />
    </>
  );
}

/** Save the current search, and the company's saved searches with their alert (for their creator) and deletion. */
export function SavedSearchesPanel({ lang, m, query, items, notice }: SavedSearchesPanelProps) {
  const s = m.discovery.saved;
  const back = searchParamsOf(query).toString();
  return (
    <section className="side-card" aria-labelledby="saved-title">
      <h2 id="saved-title">{s.title}</h2>
      <p className="side-hint">{s.lead}</p>
      {notice === null ? null : (
        <p className={OK_NOTICES.has(notice) ? "form-ok" : "form-error"} role={OK_NOTICES.has(notice) ? "status" : "alert"}>
          {s.notices[notice]}
        </p>
      )}
      <details className="save-search">
        <summary>{s.saveTitle}</summary>
        <form action={saveSearch} className="side-form">
          <Hidden lang={lang} back={back} />
          <label htmlFor="saved-name" className="side-label">
            {s.name}
          </label>
          <input id="saved-name" name="name" type="text" required minLength={1} maxLength={80} aria-describedby="saved-name-hint" />
          <p id="saved-name-hint" className="side-hint">
            {s.nameHint}
          </p>
          <div className="check">
            <input id="saved-alert" name="alert" value="1" type="checkbox" />
            <label htmlFor="saved-alert">{s.alert}</label>
          </div>
          <button type="submit" className="btn btn-primary">
            {s.submit}
          </button>
        </form>
      </details>
      {items.length === 0 ? (
        <p className="side-hint">{s.empty}</p>
      ) : (
        <ul className="saved-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={searchHref(lang, searchQuery(new URLSearchParams(item.query)))} className="saved-name">
                {item.name}
              </Link>
              <span className="side-hint">
                {item.createdByName === null ? s.byGone : s.by(item.createdByName)} · {day(item.createdAt, lang)}
                {item.alert ? ` · ${s.alertOn}` : ""}
              </span>
              <span className="saved-actions">
                {item.mine ? (
                  <form action={setSavedSearchAlert}>
                    <Hidden lang={lang} back={back} />
                    <input type="hidden" name="savedSearchId" value={item.id} />
                    <input type="hidden" name="alert" value={item.alert ? "0" : "1"} />
                    <button type="submit" className="btn btn-quiet">
                      {item.alert ? s.disableAlert : s.enableAlert}
                    </button>
                  </form>
                ) : null}
                {item.removable ? (
                  <form action={deleteSavedSearch}>
                    <Hidden lang={lang} back={back} />
                    <input type="hidden" name="savedSearchId" value={item.id} />
                    <button type="submit" className="btn btn-quiet">
                      {s.remove}
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
