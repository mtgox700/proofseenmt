import { REACTION_KINDS, type PostView } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { CommunityDictionary } from "@/i18n/market/community-fr";
import { reactToPost } from "@/app/[lang]/app/fil/actions";

interface ReactionBarProps {
  readonly lang: Lang;
  readonly post: PostView;
  readonly c: CommunityDictionary;
  /** Where the form returns: `following`, `discover` or `post`. */
  readonly back: string;
}

/** One form, one button per reaction: the chosen one is pressed, and pressing another changes it. Works without JavaScript. */
export function ReactionBar({ lang, post, c, back }: ReactionBarProps) {
  return (
    <form action={reactToPost} className="post-reactions" aria-label={c.reactions.label}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="postId" value={post.id} />
      <input type="hidden" name="back" value={back} />
      {REACTION_KINDS.map((kind) => (
        <button key={kind} type="submit" name="kind" value={kind} className={post.myReaction === kind ? "btn btn-primary" : "btn btn-quiet"} aria-pressed={post.myReaction === kind}>
          {c.reactions.kinds[kind]} <span className="muted small">{post.counts.reactions[kind]}</span>
        </button>
      ))}
      {post.myReaction === null ? null : (
        <button type="submit" name="kind" value="none" className="btn btn-quiet">
          {c.reactions.remove}
        </button>
      )}
    </form>
  );
}
