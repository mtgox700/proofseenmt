import type { CommentView } from "@proofseen/db";
import { commentOnPost, deleteComment, editComment } from "@/app/[lang]/app/fil/actions";
import type { Lang } from "@/i18n";
import type { CommunityDictionary } from "@/i18n/market/community-fr";
import { day } from "@/lib/format";
import { AuthorLine } from "./AuthorLine";

interface ThreadProps {
  readonly lang: Lang;
  readonly c: CommunityDictionary;
  readonly postId: string;
  readonly comments: readonly CommentView[];
  /** The person may write (a published profile, or a company they act for). */
  readonly canWrite: boolean;
}

function Hidden({ lang, postId }: { readonly lang: Lang; readonly postId: string }) {
  return (
    <>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="postId" value={postId} />
    </>
  );
}

function CommentForm({ lang, c, postId, parentId }: { readonly lang: Lang; readonly c: CommunityDictionary; readonly postId: string; readonly parentId: string | null }) {
  const id = parentId === null ? "comment-new" : `reply-${parentId}`;
  return (
    <form action={commentOnPost} className="stack">
      <Hidden lang={lang} postId={postId} />
      {parentId === null ? null : <input type="hidden" name="parentId" value={parentId} />}
      <div className="field">
        <label htmlFor={id}>{parentId === null ? c.comments.write : c.comments.reply}</label>
        <textarea id={id} name="body" rows={parentId === null ? 3 : 2} maxLength={1500} required aria-describedby={`${id}-hint`} />
        <p id={`${id}-hint`} className="field-hint">
          {c.comments.hint}
        </p>
      </div>
      <button type="submit" className="btn">
        {parentId === null ? c.comments.submit : c.comments.replySubmit}
      </button>
    </form>
  );
}

function Comment({ lang, c, postId, comment, canWrite }: Omit<ThreadProps, "comments"> & { readonly comment: CommentView }) {
  const placeholder = comment.state === "erased" ? c.comments.erased : comment.state === "deleted" ? c.comments.deleted : null;
  return (
    <li className="comment" id={`c-${comment.id}`}>
      {placeholder !== null || comment.author === null ? (
        <p className="muted">{placeholder ?? c.comments.erased}</p>
      ) : (
        <>
          <p className="muted small">
            <AuthorLine lang={lang} author={comment.author} /> · <time dateTime={comment.createdAt.toISOString()}>{day(comment.createdAt, lang)}</time>
          </p>
          {comment.moderationReason === null ? null : <p className="form-error">{c.comments.moderated(comment.moderationReason)}</p>}
          <p className="comment-body">{comment.body}</p>
        </>
      )}
      {comment.editable ? (
        <details className="post-tools">
          <summary>{c.comments.edit}</summary>
          <form action={editComment} className="stack">
            <Hidden lang={lang} postId={postId} />
            <input type="hidden" name="commentId" value={comment.id} />
            <textarea name="body" rows={3} maxLength={1500} defaultValue={comment.body} aria-label={c.comments.edit} />
            <button type="submit" className="btn">
              {c.comments.save}
            </button>
          </form>
        </details>
      ) : null}
      {comment.removable ? (
        <form action={deleteComment} className="inline-form">
          <Hidden lang={lang} postId={postId} />
          <input type="hidden" name="commentId" value={comment.id} />
          <button type="submit" className="btn btn-quiet small">
            {c.comments.remove}
          </button>
        </form>
      ) : null}
      {comment.replies.length === 0 ? null : (
        <ul className="comment-replies">
          {comment.replies.map((reply) => (
            <Comment key={reply.id} lang={lang} c={c} postId={postId} comment={reply} canWrite={false} />
          ))}
        </ul>
      )}
      {canWrite && comment.parentId === null && comment.state === "live" ? (
        <details className="post-tools">
          <summary>{c.comments.reply}</summary>
          <CommentForm lang={lang} c={c} postId={postId} parentId={comment.id} />
        </details>
      ) : null}
    </li>
  );
}

/** The comments of a post, one level of replies, then the form to add one. Text only: nothing in a comment is rendered as HTML. */
export function CommentThread({ lang, c, postId, comments, canWrite }: ThreadProps) {
  return (
    <section className="panel" id="commentaires" aria-labelledby="comments-title">
      <h2 id="comments-title">{c.comments.title}</h2>
      {comments.length === 0 ? (
        <p className="muted">{c.comments.empty}</p>
      ) : (
        <ul className="comments">
          {comments.map((comment) => (
            <Comment key={comment.id} lang={lang} c={c} postId={postId} comment={comment} canWrite={canWrite} />
          ))}
        </ul>
      )}
      {canWrite ? <CommentForm lang={lang} c={c} postId={postId} parentId={null} /> : null}
    </section>
  );
}
