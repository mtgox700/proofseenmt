import type { PostView, SharedOriginal } from "@proofseen/db";
import { renderPostBody } from "@proofseen/hub";
import { deletePost, editPost, sharePost } from "@/app/[lang]/app/fil/actions";
import { followProfile } from "@/app/[lang]/app/abonnements/actions";
import type { Lang } from "@/i18n";
import type { CommunityDictionary } from "@/i18n/market/community-fr";
import { colon, day } from "@/lib/format";
import { AuthorLine } from "./AuthorLine";
import { ReactionBar } from "./ReactionBar";

interface PostCardProps {
  readonly lang: Lang;
  readonly post: PostView;
  readonly c: CommunityDictionary;
  /** Where the forms return: `following`, `discover` or `post`. */
  readonly back: string;
  /** On the post's own page: no "open" link, the comments follow. */
  readonly detail?: boolean;
}

/** The body of a post: simple Markdown rendered by the same safe renderer as the public page (no raw HTML). */
function Body({ body }: { readonly body: string }) {
  if (body === "") return null;
  return <div className="post-body" dangerouslySetInnerHTML={{ __html: renderPostBody(body) }} />;
}

function Attachments({ lang, c, item }: { readonly lang: Lang; readonly c: CommunityDictionary; readonly item: Pick<SharedOriginal, "linkUrl" | "imageFileId" | "author"> }) {
  return (
    <>
      {item.linkUrl === null ? null : (
        <p className="small">
          {c.post.link}
          {colon(lang)}
          <a href={item.linkUrl} rel="nofollow ugc noopener noreferrer">
            {item.linkUrl}
          </a>
        </p>
      )}
      {item.imageFileId === null ? null : <img className="post-image" src={`/fichiers/${item.imageFileId}`} alt={c.post.image(item.author.name)} loading="lazy" decoding="async" />}
    </>
  );
}

function Shared({ lang, c, shared }: { readonly lang: Lang; readonly c: CommunityDictionary; readonly shared: PostView["shared"] }) {
  if (shared === null) return null;
  if (shared === "unavailable") return <p className="post-shared muted">{c.post.unavailable}</p>;
  return (
    <div className="post-shared">
      <p className="muted small">
        <AuthorLine lang={lang} author={shared.author} /> · <a href={`/${lang}/app/fil/${shared.id}`}>{day(shared.createdAt, lang)}</a>
      </p>
      <Body body={shared.body} />
      <Attachments lang={lang} c={c} item={shared} />
    </div>
  );
}

function FollowButton({ lang, post, c, back }: PostCardProps) {
  if (post.ownAuthor) return null;
  if (post.followingAuthor) return <span className="tag tag-quiet small">{c.post.following}</span>;
  if (post.author.kind === "organisation") {
    return post.author.companySlug === null ? null : (
      <a className="btn btn-quiet small" href={`/${lang}/app/entreprises-suivies?suivre=${post.author.companySlug}`}>
        {c.post.follow}
      </a>
    );
  }
  if (post.author.reference === null || post.author.profileSlug === null) return null;
  return (
    <form action={followProfile} className="inline-form">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="reference" value={post.author.reference} />
      <input type="hidden" name="back" value={back === "discover" ? "discover" : "feed"} />
      <button type="submit" className="btn btn-quiet small">
        {c.post.follow}
      </button>
    </form>
  );
}

function OwnerTools({ lang, post, c, back }: PostCardProps) {
  if (!post.manageable) return null;
  return (
    <details className="post-tools">
      <summary>{c.post.edit}</summary>
      <form action={editPost} className="stack">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="postId" value={post.id} />
        <input type="hidden" name="back" value={back} />
        <label className="field">
          <span>{c.composer.body}</span>
          <textarea name="body" rows={5} maxLength={3000} defaultValue={post.body} />
        </label>
        {post.shared === null ? (
          <label className="field">
            <span>{c.composer.link}</span>
            <input name="linkUrl" type="url" maxLength={500} defaultValue={post.linkUrl ?? ""} />
          </label>
        ) : null}
        <button type="submit" className="btn">
          {c.post.save}
        </button>
      </form>
      <form action={deletePost}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="postId" value={post.id} />
        <button type="submit" className="btn btn-quiet">
          {c.post.removeConfirm}
        </button>
      </form>
    </details>
  );
}

function ShareForm({ lang, post, c, back }: PostCardProps) {
  if (post.visibility !== "public") return null;
  return (
    <details className="post-tools">
      <summary>{c.post.share}</summary>
      <form action={sharePost} className="stack">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="postId" value={post.id} />
        <input type="hidden" name="back" value={back} />
        <label className="field">
          <span>{c.post.shareComment}</span>
          <textarea name="comment" rows={3} maxLength={1000} />
        </label>
        <button type="submit" className="btn">
          {c.post.shareSubmit}
        </button>
      </form>
    </details>
  );
}

/** One post of the feed or of its own page. Every action is a form posting to a server action: no JavaScript needed. */
export function PostCard(props: PostCardProps) {
  const { lang, post, c, back, detail = false } = props;
  const total = Object.values(post.counts.reactions).reduce((sum, n) => sum + n, 0);
  return (
    <article className="post-card" id={`p-${post.id}`} aria-labelledby={`p-${post.id}-who`}>
      <header className="post-head">
        <p id={`p-${post.id}-who`}>
          <AuthorLine lang={lang} author={post.author} />
          {post.shared === null ? null : <span className="muted"> {c.post.sharedBy}</span>}
          <span className="muted small">
            {" · "}
            <a href={`/${lang}/app/fil/${post.id}`}>
              <time dateTime={post.createdAt.toISOString()}>{day(post.createdAt, lang)}</time>
            </a>
            {post.editedAt === null ? null : ` · ${c.post.edited}`}
          </span>
          {post.visibility === "members" ? <span className="tag tag-quiet small">{c.post.members}</span> : null}
        </p>
        <FollowButton {...props} />
      </header>
      {post.moderationReason === null ? null : (
        <p className="form-error" role="status">
          {c.post.moderated(post.moderationReason)}
        </p>
      )}
      <Body body={post.body} />
      <Attachments lang={lang} c={c} item={post} />
      <Shared lang={lang} c={c} shared={post.shared} />
      <p className="muted small">
        {c.reactions.total(total)} · {c.post.counts(post.counts.comments, post.counts.shares)}
      </p>
      {post.audience === null ? null : <p className="muted small">{c.post.audience(post.audience.impressions, post.audience.views)}</p>}
      <ReactionBar lang={lang} post={post} c={c} back={back} />
      <div className="post-actions">
        {detail ? null : (
          <a className="btn btn-quiet" href={`/${lang}/app/fil/${post.id}#commentaires`}>
            {c.comments.title}
          </a>
        )}
        {post.visibility === "public" && post.moderationReason === null ? (
          <a className="btn btn-quiet" href={`/${lang}/publications/${post.id}`}>
            {c.post.publicPage}
          </a>
        ) : null}
      </div>
      <ShareForm {...props} />
      <OwnerTools {...props} />
    </article>
  );
}
