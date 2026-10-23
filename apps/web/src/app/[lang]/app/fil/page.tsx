import "@/styles/community.css";
import "@/styles/app-compte.css";
import { headers } from "next/headers";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { postFeed, type FeedTab } from "@proofseen/db";
import { Composer } from "@/components/community/Composer";
import { PostCard } from "@/components/community/PostCard";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { NextSteps } from "@/components/NextSteps";
import { countedHeaders } from "@/data/audience";
import { countPostSightings, speakerOf } from "@/data/community";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { CommunityDictionary } from "@/i18n/market/community-fr";
import { isCommunityError } from "@/lib/community";
import { pageMarket } from "@/lib/market";
import { nextSteps } from "@/lib/next-steps";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ onglet?: string; avant?: string; erreur?: string; ok?: string; suivi?: string }>;
}

const OK_TEXTS = (c: CommunityDictionary): Readonly<Record<string, string>> => ({ publie: c.published, partage: c.sharedDone, supprime: c.deletedDone, modifie: c.editedDone });

/** The flag left by the last action, as one sentence: success, refusal, or a follow outcome. */
function Notice({ c, erreur, ok, suivi }: { readonly c: CommunityDictionary; readonly erreur: string | undefined; readonly ok: string | undefined; readonly suivi: string | undefined }) {
  const okText = ok === undefined ? undefined : OK_TEXTS(c)[ok];
  const follow = suivi === undefined ? undefined : c.follows.outcomes[suivi];
  if (isCommunityError(erreur)) {
    return (
      <p className="form-error" role="alert">
        {c.errors[erreur]}
      </p>
    );
  }
  const text = okText ?? follow;
  return text === undefined ? null : (
    <p className={suivi === undefined || suivi === "followed" || suivi === "already" ? "form-ok" : "form-error"} role="status">
      {text}
    </p>
  );
}

/** The connected feed: who you follow and yourself, or recent public posts, by date only; the composer on top. */
export default async function FeedPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const c = dict.community;
  const market = await pageMarket(lang, ["company", "freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const query = await searchParams;
  const tab: FeedTab = query.onglet === "decouvrir" ? "discover" : "following";
  const back = tab === "discover" ? "discover" : "following";
  const [page, speaker] = await Promise.all([postFeed(market.db).feed(market.actor, tab, query.avant ?? null), speakerOf(market)]);
  const shown = page.items.map((post) => post.id);
  // Counted once the page is sent: the posts shown, as impressions; never the author's own views.
  const counted = countedHeaders(await headers());
  after(() => countPostSightings(counted, "impression", shown, market.person.id));
  const role = market.person.role === "company" ? "company" : "freelance";
  const tabHref = (t: FeedTab): string => `/${lang}/app/fil${t === "discover" ? "?onglet=decouvrir" : ""}`;

  return (
    <>
      <header className="app-head">
        <h1>{c.title}</h1>
        <p className="muted measure">{tab === "discover" ? c.discoverLead : c.lead}</p>
        <p className="muted small measure">{c.order}</p>
      </header>
      <nav className="feed-tabs" aria-label={c.tabs.label}>
        {(["following", "discover"] as const).map((t) => (
          <a key={t} className="btn" href={tabHref(t)} aria-current={t === tab ? "page" : undefined}>
            {c.tabs[t]}
          </a>
        ))}
        <a className="btn btn-quiet" href={`/${lang}/app/abonnements`}>
          {c.follows.nav}
        </a>
      </nav>
      <Notice c={c} erreur={query.erreur} ok={query.ok} suivi={query.suivi} />
      <Composer lang={lang} c={c} speaker={speaker} role={role} back={back} />
      {page.items.length === 0 ? (
        <EmptyState title={c.tabs[tab]} headingLevel={2}>
          <p>{tab === "discover" ? c.emptyDiscover : c.empty}</p>
          <NextSteps n={dict.nextSteps} steps={nextSteps(lang, tab === "discover" ? "feed_discover" : "feed_following", role)} />
        </EmptyState>
      ) : (
        <ol className="feed">
          {page.items.map((post) => (
            <li key={post.id}>
              <PostCard lang={lang} post={post} c={c} back={back} />
            </li>
          ))}
        </ol>
      )}
      {page.next === null ? null : (
        <p>
          <a className="btn" href={`${tabHref(tab)}${tab === "discover" ? "&" : "?"}avant=${encodeURIComponent(page.next)}`}>
            {c.more}
          </a>
        </p>
      )}
    </>
  );
}
