import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { freelanceLists, profiles, statKeywords, type ListSummary, type ProfileCard } from "@proofseen/db";
import { FreelancerCard } from "@/components/market/FreelancerCard";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { SearchFilters } from "@/components/market/SearchFilters";
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

const SEARCH_RULE = { windowMs: 60_000, max: 60 };
const BRIEF_CODES = ["invalid", "throttled", "not_understood", "failed", "unconfigured"] as const;
const ADDED_CODES = ["added", "already", "limit", "absent"] as const;

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
    <form action={suggestFilters} className="panel" aria-labelledby="brief-title">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="back" value={searchParamsOf(query).toString()} />
      <h2 id="brief-title">{b.title}</h2>
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
  );
}

function AddToList({ lang, m, card, lists, back }: { readonly lang: Lang; readonly m: MarketDictionary; readonly card: ProfileCard; readonly lists: readonly ListSummary[]; readonly back: string }) {
  const c = m.search.card;
  const contact = (
    <Link className="btn btn-primary" href={`/${lang}/app/contact/${encodeURIComponent(card.reference)}`}>
      {c.contact}
    </Link>
  );
  if (lists.length === 0) {
    return (
      <div className="row-actions">
        {contact}
        <Link className="btn btn-quiet" href={`/${lang}/app/listes`}>
          {c.noList}
        </Link>
      </div>
    );
  }
  return (
    <form action={addToList} className="row-actions">
      {contact}
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
  );
}

function Pagination({ lang, m, query, hasMore }: { readonly lang: Lang; readonly m: MarketDictionary; readonly query: SearchQuery; readonly hasMore: boolean }) {
  const r = m.search.results;
  if (query.page === 1 && !hasMore) return null;
  return (
    <nav className="row-actions" aria-label={r.pagination}>
      {query.page > 1 ? (
        <Link className="btn" href={searchHref(lang, { ...query, page: query.page - 1 })} rel="prev">
          {r.previous}
        </Link>
      ) : null}
      <span className="muted small">{r.page(query.page)}</span>
      {hasMore ? (
        <Link className="btn" href={searchHref(lang, { ...query, page: query.page + 1 })} rel="next">
          {r.next}
        </Link>
      ) : null}
    </nav>
  );
}

/** The company freelancer search: visible filters, a chosen and stated order, results as cards of public facts. */
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
  const limited = await throttled("company-search", market.actor.userId, SEARCH_RULE, new Date());
  const results = limited ? null : await Promise.all([profiles(market.db).search(searchFilters(query)), freelanceLists(market.db).lists(market.actor, organisation.id)]);
  const page = results?.[0] ?? null;
  const lists = results?.[1] ?? [];
  const back = searchParamsOf(query).toString();
  if (page !== null) {
    // Counted once the page is sent: the profiles shown, the filters that led to them, never who searched.
    const filters = searchFilters(query);
    const counted = {
      headers: countedHeaders(await headers()),
      actor: market.actor,
      clerkId: market.person.id,
      organisationId: organisation.id,
      references: page.items.map((card) => card.reference),
      keywords: statKeywords({ skills: filters.skills ?? [], city: filters.city ?? null }),
      firstPage: query.page === 1,
    };
    after(() => countSearch(counted));
  }

  return (
    <>
      {header}
      {briefConfigured() ? <BriefBox lang={lang} m={m} query={query} code={raw.get("brief")} /> : null}
      <SearchFilters lang={lang} m={m} query={query} />
      <section className="ws-block" aria-labelledby="results-title">
        <div className="results-head">
          <h2 id="results-title">{s.results.title}</h2>
          <p className="muted small">{s.results.order(s.form.sorts[query.sort])}</p>
        </div>
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
          <p className="muted">{s.results.none}</p>
        ) : (
          <ul className="profiles">
            {page.items.map((card) => (
              <li key={card.id}>
                <FreelancerCard lang={lang} m={m} facts={card} headingId={`card-${card.id}`}>
                  <AddToList lang={lang} m={m} card={card} lists={lists} back={back} />
                </FreelancerCard>
              </li>
            ))}
          </ul>
        )}
        {page === null ? null : <Pagination lang={lang} m={m} query={query} hasMore={page.hasMore} />}
      </section>
    </>
  );
}
