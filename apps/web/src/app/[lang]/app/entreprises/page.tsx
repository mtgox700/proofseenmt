import "@/styles/discovery.css";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { companyDirectory, type CompanyCard, type CompanyFacets } from "@proofseen/db";
import { COMPANY_DIRECTORY_SORTS, companyDirectoryQueryString, type CompanyDirectoryFilters } from "@proofseen/hub";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { NextSteps } from "@/components/NextSteps";
import { AutoSubmit } from "@/components/search/AutoSubmit";
import { Avatar } from "@/components/search/Avatar";
import { throttled } from "@/data/throttle";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { companyDirectoryQuery, companySearch } from "@/lib/company-directory-filters";
import { day } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { nextSteps } from "@/lib/next-steps";
import { followFromDirectory, unfollowFromDirectory } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const RULE = { windowMs: 60_000, max: 60 };
const FORM_ID = "company-filters";
const NOTICES = ["followed", "already", "unfollowed", "limit", "absent", "trop"] as const;
type Notice = (typeof NOTICES)[number];

const paramsOf = (raw: Record<string, string | string[] | undefined>): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(raw)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(name, item);
  }
  return params;
};

const pageHref = (lang: Lang, f: CompanyDirectoryFilters, page: number): string => `/${lang}/app/entreprises${companyDirectoryQueryString(f, page)}`;

function Filters({ lang, m, filters, facets }: { readonly lang: Lang; readonly m: MarketDictionary; readonly filters: CompanyDirectoryFilters; readonly facets: CompanyFacets }) {
  const c = m.discovery.companies;
  const kinds = m.company.kinds;
  return (
    <details className="drawer search-drawer">
      <summary>{c.filters}</summary>
      <Form id={FORM_ID} action={`/${lang}/app/entreprises`} scroll={false} className="side-form" role="search" aria-label={c.filters}>
        <div className="side-group">
          <label htmlFor="company-city" className="side-label">
            {c.city}
          </label>
          <select id="company-city" name="ville" defaultValue={filters.city}>
            <option value="">{c.anyCity}</option>
            {filters.city !== "" && !facets.cities.some((x) => x.label === filters.city) ? <option value={filters.city}>{filters.city}</option> : null}
            {facets.cities.map((x) => (
              <option key={x.key} value={x.label}>{`${x.label} (${x.count})`}</option>
            ))}
          </select>
        </div>
        <div className="side-group">
          <label htmlFor="company-kind" className="side-label">
            {c.kind}
          </label>
          <select id="company-kind" name="type" defaultValue={filters.kind}>
            <option value="">{c.anyKind}</option>
            {facets.kinds.map((k) => (
              <option key={k.kind} value={k.kind}>{`${kinds[k.kind]} (${k.count})`}</option>
            ))}
          </select>
        </div>
        <fieldset className="side-group">
          <legend>{m.discovery.filters.title}</legend>
          <div className="check">
            <input id="company-hiring" name="recrute" value="1" type="checkbox" defaultChecked={filters.hiringOnly} />
            <label htmlFor="company-hiring">{c.hiring}</label>
            <span className="n">{facets.hiring}</span>
          </div>
          <div className="check">
            <input id="company-registry" name="siret" value="1" type="checkbox" defaultChecked={filters.registryActiveOnly} />
            <label htmlFor="company-registry">{c.registry}</label>
            <span className="n">{facets.registryActive}</span>
          </div>
        </fieldset>
        <div className="side-group">
          <label htmlFor="company-sort" className="side-label">
            {c.sort}
          </label>
          <select id="company-sort" name="tri" defaultValue={filters.sort}>
            {COMPANY_DIRECTORY_SORTS.map((s) => (
              <option key={s} value={s}>
                {c.sorts[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="side-actions">
          <button type="submit" className="btn btn-primary">
            {c.apply}
          </button>
          <Link className="btn btn-quiet" href={`/${lang}/app/entreprises`}>
            {c.clear}
          </Link>
        </div>
      </Form>
      <AutoSubmit formId={FORM_ID} />
    </details>
  );
}

function FollowButton({ lang, company, following, member, back, m }: { readonly lang: Lang; readonly company: CompanyCard; readonly following: boolean; readonly member: boolean; readonly back: string; readonly m: MarketDictionary }) {
  const c = m.discovery.companies;
  if (member) return <span className="tag tag-quiet">{c.member}</span>;
  return (
    <form action={following ? unfollowFromDirectory : followFromDirectory}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="back" value={back} />
      {following ? <input type="hidden" name="organisationId" value={company.organisationId} /> : <input type="hidden" name="slug" value={company.slug} />}
      <button type="submit" className={following ? "btn" : "btn btn-primary"} aria-pressed={following}>
        {following ? c.unfollow : c.follow}
      </button>
    </form>
  );
}

function Card({ lang, m, company, children }: { readonly lang: Lang; readonly m: MarketDictionary; readonly company: CompanyCard; readonly children: React.ReactNode }) {
  const c = m.discovery.companies;
  const headingId = `company-${company.slug}`;
  const facts = [
    ...(company.registryActiveCheckedAt === null ? [] : [c.registryFact(day(company.registryActiveCheckedAt, lang))]),
    c.since(day(company.memberSince, lang)),
    ...(company.response === null ? [] : [c.response(company.response.medianDays, company.response.decided)]),
  ];
  return (
    <article className="pcard" aria-labelledby={headingId}>
      <div className="pc-head">
        <Avatar seed={company.slug} name={company.name} square />
        <div className="pc-id">
          <h3 className="pc-name" id={headingId}>
            {/* The company page is raw HTML from a route handler: a plain link. */}
            <a href={`/${lang}/entreprises/${company.slug}`}>{company.name}</a>
          </h3>
          <p className="pc-ref">
            {m.company.kinds[company.kind]}
            {company.city === null ? null : ` · ${company.city}`}
          </p>
        </div>
      </div>
      <p className="avail">
        <span className={`badge ${company.openMissions > 0 ? "now" : "off"}`}>
          <i aria-hidden="true" />
          {c.missions(company.openMissions)}
        </span>
      </p>
      <ul className="pc-badges">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <div className="pc-actions">
        <a className="btn btn-quiet" href={`/${lang}/entreprises/${company.slug}`}>
          {c.page}
        </a>
        {children}
      </div>
    </article>
  );
}

/** Companies with a public page, for a freelancer to discover and follow; the same facts as the public directory. */
export default async function CompaniesPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const c = m.discovery.companies;
  const market = await pageMarket(lang, ["freelance", "company"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const raw = paramsOf(await searchParams);
  const filters = companyDirectoryQuery(raw);
  const notice = NOTICES.find((n) => n === raw.get("suivi")) ?? null;
  const limited = await throttled("company-directory", market.actor.userId, RULE, new Date());
  const header = (
    <header className="app-head">
      <h1>{c.title}</h1>
      <p className="muted measure">{c.lead}</p>
    </header>
  );
  if (limited) {
    return (
      <>
        {header}
        <p className="form-error" role="alert">
          {c.notices.tooMany}
        </p>
      </>
    );
  }
  const directory = companyDirectory(market.db);
  const page = await directory.page(companySearch(filters));
  const ids = page.items.map((item) => item.organisationId);
  const [following, member] = await Promise.all([directory.followed(market.actor, ids), directory.memberOf(market.actor, ids)]);
  const back = companyDirectoryQueryString(filters, filters.page).replace(/^\?/, "");
  const ok = (n: Notice): boolean => n === "followed" || n === "already" || n === "unfollowed";
  const noticeText = (n: Notice): string => (n === "trop" ? c.notices.tooMany : c.notices[n]);
  const unfiltered = filters.city === "" && filters.kind === "" && !filters.hiringOnly && !filters.registryActiveOnly;

  return (
    <>
      {header}
      {notice === null ? null : (
        <p className={ok(notice) ? "form-ok" : "form-error"} role={ok(notice) ? "status" : "alert"}>
          {noticeText(notice)}
        </p>
      )}
      <div className="search-layout">
        <aside className="search-side" aria-label={c.filters}>
          <Filters lang={lang} m={m} filters={filters} facets={page.facets} />
        </aside>
        <section className="search-main" aria-labelledby="companies-title">
          <div className="results-bar">
            <div className="results-line">
              <h2 id="companies-title">{c.count(page.facets.total)}</h2>
            </div>
            <p className="muted small">{c.order(c.sorts[filters.sort])}</p>
          </div>
          {page.items.length === 0 ? (
            <>
              <p className="muted">{unfiltered ? c.none : c.empty}</p>
              <NextSteps n={m.nextSteps} steps={nextSteps(lang, unfiltered ? "companies_none" : "companies_filtered", market.person.role === "company" ? "company" : "freelance")} />
            </>
          ) : (
            <ul className="result-grid">
              {page.items.map((company) => (
                <li key={company.organisationId}>
                  <Card lang={lang} m={m} company={company}>
                    <FollowButton lang={lang} m={m} company={company} following={following.has(company.organisationId)} member={member.has(company.organisationId)} back={back} />
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {filters.page === 1 && !page.hasMore ? null : (
            <nav className="pager-row" aria-label={c.pagination}>
              {filters.page > 1 ? (
                <Link className="btn" href={pageHref(lang, filters, filters.page - 1)} rel="prev">
                  {c.previous}
                </Link>
              ) : (
                <span />
              )}
              {page.hasMore ? (
                <Link className="btn" href={pageHref(lang, filters, filters.page + 1)} rel="next">
                  {c.next}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
