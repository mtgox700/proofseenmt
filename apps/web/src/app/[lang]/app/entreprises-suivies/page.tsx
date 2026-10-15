import { notFound } from "next/navigation";
import { companyFollows } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { MissionsSpaceDictionary } from "@/i18n/market/missions-space-fr";
import { day } from "@/lib/format";
import { pageMarket, type Market } from "@/lib/market";
import { followCompany, unfollowCompany } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ suivre?: string; suivi?: string }>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Reached from a company's public page ("Follow this company"): a deliberate confirmation, never a follow on a GET. */
async function Confirm({ lang, f, market, slug }: { readonly lang: Lang; readonly f: MissionsSpaceDictionary["follows"]; readonly market: Market; readonly slug: string }) {
  const company = SLUG.test(slug) ? await companyFollows(market.db).lookup(market.actor, slug) : null;
  if (company === null) {
    return (
      <p className="form-error" role="alert">
        {f.absent}
      </p>
    );
  }
  if (company.member || company.following) {
    return (
      <p className="muted" role="status">
        {company.member ? f.member : f.already}
      </p>
    );
  }
  return (
    <form action={followCompany} className="panel" aria-labelledby="follow-title">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="slug" value={slug} />
      <h2 id="follow-title">{f.confirmTitle(company.name)}</h2>
      <p className="muted measure">{f.confirmLead}</p>
      <button type="submit" className="btn btn-primary">
        {f.confirm}
      </button>
    </form>
  );
}

const notice = (code: string | undefined, f: MissionsSpaceDictionary["follows"]): { readonly ok: boolean; readonly text: string } | null => {
  if (code === undefined) return null;
  const texts: Readonly<Record<string, { ok: boolean; text: string }>> = {
    followed: { ok: true, text: f.followed },
    already: { ok: true, text: f.already },
    limit: { ok: false, text: f.limit },
    absent: { ok: false, text: f.absent },
    trop: { ok: false, text: f.tooMany },
  };
  return texts[code] ?? null;
};

/** The companies the person follows, and the confirmation to follow one more. */
export default async function FollowedCompaniesPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const f = dict.missionsSpace.follows;
  const market = await pageMarket(lang, ["company", "freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const { suivre, suivi } = await searchParams;
  const list = await companyFollows(market.db).listMine(market.actor);
  const message = notice(suivi, f);

  return (
    <>
      <header className="app-head">
        <h1>{f.title}</h1>
        <p className="muted measure">{f.lead}</p>
      </header>
      {message === null ? null : (
        <p className={message.ok ? "form-ok" : "form-error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      {suivre === undefined || suivi !== undefined ? null : <Confirm lang={lang} f={f} market={market} slug={suivre} />}
      {list.length === 0 ? (
        <EmptyState title={f.empty} headingLevel={2}>
          <p>{f.emptyText}</p>
        </EmptyState>
      ) : (
        <ul className="threads">
          {list.map((company) => (
            <li key={company.organisationId} className="thread-row">
              <span className="thread-who">
                <strong>{company.name}</strong>
              </span>
              <span className="thread-last muted small">
                {company.slug === null ? f.noLongerPublic : f.openMissions(company.openMissions)} · {day(company.followedAt, lang)}
              </span>
              <span className="row-actions">
                {company.slug === null ? null : (
                  <a className="btn" href={`/${lang}/entreprises/${company.slug}`}>
                    {f.page}
                  </a>
                )}
                <form action={unfollowCompany}>
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="organisationId" value={company.organisationId} />
                  <button type="submit" className="btn btn-quiet">
                    {f.unfollow}
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
