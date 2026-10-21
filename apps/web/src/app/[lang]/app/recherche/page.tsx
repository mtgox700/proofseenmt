import "@/styles/discovery.css";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { freelanceLists, profileFacets, profiles, savedSearches, statKeywords, type ListSummary, type ProfileCard } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { ProfileResultCard } from "@/components/search/ProfileResultCard";
import { ResultsToolbar } from "@/components/search/ResultsToolbar";
import { SavedSearchesPanel } from "@/components/search/SavedSearchesPanel";
import { SearchSidebar } from "@/components/search/SearchSidebar";
import { countedHeaders, countSearch } from "@/data/audience";
import { briefConfigured } from "@/data/brief";
import { throttled } from "@/data/throttle";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { searchFilters, searchHref, searchParamsOf, searchQuery, type SearchQuery } from "@/lib/freelancer-search";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { addToList } from "../listes/actions";
import { suggestFilters } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Chaque recherche calcule aussi ses facettes : vingt par minute suffisent à une personne (relecture C22, recherche M1).
const SEARCH_RULE = { windowMs: 60_000, max: 20 };
const BRIEF_CODES = ["invalid", "throttled", "not_understood", "failed", "unconfigured"] as const;
const ADDED_CODES = ["added", "already", "limit", "absent"] as const;
const SAVED_CODES = ["saved", "alert", "deleted", "invalid", "limit", "alert_limit", "absent", "trop"] as const;

const paramsOf = (raw: Record<string, string | string[] | undefined>): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(raw)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(name, item);
  }
  return params;
};

const codeOf = <T extends string>(codes: readonly T[], raw: string | null): T | null => (codes as readonly (string | null)[]).includes(raw) ? (raw as T) : null;

function BriefBox({ lang, m, query, code }: { readonly lang: Lang; readonly m: MarketDictionary; readonly query: SearchQuery; readonly code: string | null }) {
  const b = m.search.brief;
  const error = codeOf(BRIEF_CODES, code);
  return (
    <details className="brief-box" open={code !== null}>
      <summary>{b.title}</summary>
      <form action={suggestFilters} aria-labelledby="brief-title">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="back" value={searchParamsOf(query).toString()} />
        <h2 id="brief-title" className="sr-only">
          {b.title}
        </h2>
        {code === "ok" ? (
          <p className="form-ok" role="status">
            {b.filled}
          </p>
        ) : error === null ? null : (
          <p className="form-error" role="alert">
            {b.errors[error]}
          </p>
        )}
        <div className="field">
          <label htmlFor="brief-text" className="sr-only">
            {b.title}
          </label>
          <textarea id="brief-text" name="brief" required minLength={5} maxLength={600} aria-describedby="brief-hint" />
          <p id="brief-hint" className="field-hint">
            {b.hint}
          </p>
        </div>
        <button type="submit" className="btn">
          {b.submit}
        </button>
      </form>
    </details>
  );
}

function CardActions({ lang, m, card, lists, back }: { readonly lang: Lang; readonly m: MarketDictionary; readonly card: ProfileCard; readonly lists: readonly ListSummary[]; readonly back: string }) {
  const c = m.search.card;
  const contact = (
    <Link className="btn btn-primary" href={`/${lang}/app/contact/${encodeURIComponent(card.reference)}`}>
      {c.contact}
    </Link>
  );
  if (lists.length === 0) {
    return (
      <>
        {contact}
        <Link className="btn btn-quiet" href={`/${lang}/app/listes`}>
          {c.noList}
        </Link>
      </>
    );
  }
  return (
    <>
      {contact}
      <form action={addToList} className="pc-list">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="profileId" value={card.id} />
        <input type="hidden" name="back" value={back} />
        <label htmlFor={`list-${card.id}`} className="sr-only">
          {c.addTo}
        </label>
        <select id={`list-${card.id}`} name="listId" defaultValue={lists[0]?.id}>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          {c.add}
        </button>
      </form>
    </>
  );
}

function Pagination({ lang, m, query, hasMore }: { readonly lang: Lang; readonly m: MarketDictionary; readonly query: SearchQuery; readonly hasMore: boolean }) {
  const r = m.search.results;
  if (query.page === 1 && !hasMore) return null;
  return (
    <nav className="pager-row" aria-label={r.pagination}>
      {query.page > 1 ? (
        <Link className="btn" href={searchHref(lang, { ...query, page: query.page - 1 })} rel="prev">
          {r.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="muted small">{r.page(query.page)}</span>
      {hasMore ? (
        <Link className="btn" href={searchHref(lang, { ...query, page: query.page + 1 })} rel="next">
          {r.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * The company freelancer search: filters with the count of each option, active filters as removable chips, a chosen
 * and stated order, results as cards of public facts, and saved searches with an optional daily alert.
 */
export default async function SearchPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const s = m.search;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const header = (
    <header className="app-head">
      <h1>{s.title}</h1>
      <p className="muted measure">{s.lead}</p>
    </header>
  );
  const organisation = await currentOrganisation(market);
  if (organisation === null) {
    return (
      <>
        {header}
        <p className="measure">
          <Link href={`/${lang}/app`}>{s.noOrganisation}</Link>
        </p>
      </>
    );
  }

  const raw = paramsOf(await searchParams);
  const query = searchQuery(raw);
  const added = codeOf(ADDED_CODES, raw.get("ajout"));
  const savedCode = codeOf(SAVED_CODES, raw.get("enregistree"));
  const now = new Date();
  const limited = await throttled("company-search", market.actor.userId, SEARCH_RULE, now);
  const filters = searchFilters(query);
  const [page, facets, lists, saved] = limited
    ? [null, null, [], (await savedSearches(market.db).list(market.actor, organisation.id)) ?? []]
    : await Promise.all([
        profiles(market.db).search(filters, now),
        profileFacets(market.db, filters, now),
        freelanceLists(market.db).lists(market.actor, organisation.id).then((items) => items ?? []),
        savedSearches(market.db).list(market.actor, organisation.id).then((items) => items ?? []),
      ]);
  const back = searchParamsOf(query).toString();
  if (page !== null) {
    // Counted once the page is sent: the profiles shown, the filters that led to them, never who searched.
    const counted = {
      headers: countedHeaders(await headers()),
      actor: market.actor,
      clerkId: market.person.id,
      organisationId: organisation.id,
      references: page.items.map((card) => card.reference),
      keywords: statKeywords({ skills: filters.skills ?? [], city: filters.city ?? null, languages: (filters.languages ?? []).map((l) => l.code) }),
      firstPage: query.page === 1,
    };
    after(() => countSearch(counted));
  }

  return (
    <>
      {header}
      {briefConfigured() ? <BriefBox lang={lang} m={m} query={query} code={raw.get("brief")} /> : null}
      <div className="search-layout">
        <aside className="search-side" aria-label={m.discovery.filters.title}>
          <SearchSidebar lang={lang} m={m} query={query} facets={facets} />
          <SavedSearchesPanel lang={lang} m={m} query={query} items={saved} notice={savedCode === "trop" ? "tooMany" : savedCode} />
        </aside>
        <section className="search-main" aria-labelledby="results-title">
          <ResultsToolbar lang={lang} m={m} query={query} facets={facets} />
          {added === null ? null : (
            <p className={added === "added" ? "form-ok" : "form-error"} role={added === "added" ? "status" : "alert"}>
              {s.added[added]}
            </p>
          )}
          {page === null ? (
            <p className="form-error" role="alert">
              {s.results.tooMany}
            </p>
          ) : page.items.length === 0 ? (
            <EmptyState title={s.results.none} headingLevel={3} />
          ) : (
            <ul className="result-grid">
              {page.items.map((card) => (
                <li key={card.id}>
                  <ProfileResultCard lang={lang} m={m} card={card}>
                    <CardActions lang={lang} m={m} card={card} lists={lists} back={back} />
                  </ProfileResultCard>
                </li>
              ))}
            </ul>
          )}
          {page === null ? null : <Pagination lang={lang} m={m} query={query} hasMore={page.hasMore} />}
        </section>
      </div>
    </>
  );
}
