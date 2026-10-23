import "@/styles/community.css";
import "@/styles/app-compte.css";
import { headers } from "next/headers";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { postComments, postFeed } from "@proofseen/db";
import { CommentThread } from "@/components/community/CommentThread";
import { PostCard } from "@/components/community/PostCard";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { countedHeaders } from "@/data/audience";
import { countPostSightings, speakerOf } from "@/data/community";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { isCommunityError } from "@/lib/community";
import { pageMarket } from "@/lib/market";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string; ok?: string }>;
}

/** One post and its comments, for a signed-in person. A post they may not read answers 404, exactly like an unknown one. */
export default async function PostPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const c = dict.community;
  const market = await pageMarket(lang, ["company", "freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const [post, comments, speaker] = await Promise.all([postFeed(market.db).get(market.actor, id), postComments(market.db).list(market.actor, id), speakerOf(market)]);
  if (post === null || comments === null) notFound();
  // A view, counted once the page is sent; the author's own visits never count.
  const counted = countedHeaders(await headers());
  after(() => countPostSightings(counted, "view", [post.id], market.person.id));
  const { erreur, ok } = await searchParams;

  return (
    <>
      <header className="app-head">
        <p>
          <a className="btn btn-quiet" href={`/${lang}/app/fil`}>
            <span aria-hidden="true">←</span> {c.title}
          </a>
        </p>
        <h1>{post.author.name}</h1>
      </header>
      {isCommunityError(erreur) ? (
        <p className="form-error" role="alert">
          {c.errors[erreur]}
        </p>
      ) : ok === "modifie" ? (
        <p className="form-ok" role="status">
          {c.editedDone}
        </p>
      ) : null}
      <PostCard lang={lang} post={post} c={c} back="post" detail />
      <CommentThread lang={lang} c={c} postId={post.id} comments={comments} canWrite={speaker !== null} />
    </>
  );
}
