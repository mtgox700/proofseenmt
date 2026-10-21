import "@/styles/community.css";
import { notFound } from "next/navigation";
import { peopleFollows } from "@proofseen/db";
import { EmptyNote } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { CommunityDictionary } from "@/i18n/market/community-fr";
import { day } from "@/lib/format";
import { pageMarket, type Market } from "@/lib/market";
import { followProfile, unfollowProfile } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ suivre?: string; suivi?: string }>;
}

const REFERENCE = /^FR-[A-Z0-9]{5,8}$/;

/** Reached from a public profile ("Follow"): a deliberate confirmation, never a follow on a GET. */
async function Confirm({ lang, c, market, reference }: { readonly lang: Lang; readonly c: CommunityDictionary; readonly market: Market; readonly reference: string }) {
  const profile = REFERENCE.test(reference) ? await peopleFollows(market.db).lookup(market.actor, reference) : null;
  if (profile === null) {
    return (
      <p className="form-error" role="alert">
        {c.follows.outcomes.absent}
      </p>
    );
  }
  if (profile.own || profile.following) {
    return (
      <p className="muted" role="status">
        {profile.own ? c.follows.outcomes.self : c.follows.outcomes.already}
      </p>
    );
  }
  return (
    <form action={followProfile} className="panel" aria-labelledby="follow-title">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="reference" value={reference} />
      <h2 id="follow-title">{c.follows.confirmTitle(profile.name)}</h2>
      <p className="muted measure">{c.follows.confirmLead}</p>
      <button type="submit" className="btn btn-primary">
        {c.follows.confirm}
      </button>
    </form>
  );
}

/** The profiles and companies the person follows, their own followers, and the confirmation to follow a profile. */
export default async function FollowsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const c = dict.community;
  const market = await pageMarket(lang, ["company", "freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const { suivre, suivi } = await searchParams;
  const [following, followers] = await Promise.all([peopleFollows(market.db).following(market.actor), peopleFollows(market.db).followers(market.actor)]);
  const outcome = suivi === undefined ? undefined : c.follows.outcomes[suivi];
  const reference = suivre?.trim().toUpperCase();

  return (
    <>
      <header className="app-head">
        <h1>{c.follows.title}</h1>
        <p className="muted measure">{c.follows.lead}</p>
      </header>
      {outcome === undefined ? null : (
        <p className={suivi === "followed" || suivi === "already" ? "form-ok" : "form-error"} role="status">
          {outcome}
        </p>
      )}
      {reference === undefined || suivi !== undefined ? null : <Confirm lang={lang} c={c} market={market} reference={reference} />}
      <section className="panel" aria-labelledby="following-title">
        <h2 id="following-title">{c.follows.followingTitle}</h2>
        <h3>{c.follows.profiles}</h3>
        {following.profiles.length === 0 ? (
          <EmptyNote>{c.follows.none}</EmptyNote>
        ) : (
          <ul className="follow-list">
            {following.profiles.map((p) => (
              <li key={p.profileId}>
                <span>
                  {p.slug === null ? <strong>{p.name}</strong> : <a href={`/${lang}/profils/${p.slug}`}><strong>{p.name}</strong></a>}
                  <span className="muted small">
                    {" · "}
                    {p.slug === null ? c.follows.noLongerPublic : day(p.followedAt, lang)}
                  </span>
                </span>
                <form action={unfollowProfile}>
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="profileId" value={p.profileId} />
                  <button type="submit" className="btn btn-quiet">
                    {c.follows.unfollow}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <h3>{c.follows.companies}</h3>
        {following.companies.length === 0 ? (
          <EmptyNote>{c.follows.none}</EmptyNote>
        ) : (
          <ul className="follow-list">
            {following.companies.map((company) => (
              <li key={company.organisationId}>
                {company.slug === null ? <strong>{company.name}</strong> : <a href={`/${lang}/entreprises/${company.slug}`}><strong>{company.name}</strong></a>}
                <span className="muted small">{day(company.followedAt, lang)}</span>
              </li>
            ))}
          </ul>
        )}
        <p>
          <a href={`/${lang}/app/entreprises-suivies`}>{c.follows.companiesLink}</a>
        </p>
      </section>
      <section className="panel" aria-labelledby="followers-title">
        <h2 id="followers-title">{c.follows.followersTitle}</h2>
        {followers === null ? (
          <p className="muted">{c.follows.noProfile}</p>
        ) : followers.total === 0 ? (
          <p className="muted">{c.follows.noFollowers}</p>
        ) : (
          <>
            <p>{c.follows.followersTotal(followers.total)}</p>
            <p className="muted small measure">{c.follows.followersLead}</p>
            <ul className="follow-list">
              {followers.shown.map((f) => (
                <li key={f.reference}>
                  <a href={`/${lang}/profils/${f.slug}`}>
                    <strong>{f.name}</strong>
                  </a>
                  <span className="muted small">{day(f.followedAt, lang)}</span>
                </li>
              ))}
            </ul>
            {followers.total > followers.shown.length ? <p className="muted small">{c.follows.others(followers.total - followers.shown.length)}</p> : null}
          </>
        )}
      </section>
    </>
  );
}
