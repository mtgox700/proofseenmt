import { z } from "zod";
import type { Db } from "./client";
import { COMMENT_BODY_MAX, MAX_COMMENTS_PER_DAY, textProblem, type TextProblem } from "./community-input";
import { notifyCommunity, postOwners } from "./community-notify";
import { authorView, resolveSpeaker, SPEAKER_SELECT, type AuthorView, type SpeakerChoice } from "./community-speaker";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { READABLE_BY } from "./post-reactions";
import { MANAGEABLE_BY } from "./posts";
import { LISTED_COMMENT, LISTED_POST } from "./public-visibility";

/*
 * Commenter une publication (C22), et répondre à un commentaire (un seul niveau, la base le vérifie aussi). On commente
 * au nom de son profil publié ou d'une entreprise, comme on publie ; le filtre des coordonnées s'applique.
 *
 * Cent commentaires au plus par personne sur 24 heures, comptés sous verrou du compte. L'auteur modifie ou supprime son
 * commentaire ; qui répond de la publication peut aussi le supprimer. Un commentaire supprimé qui a des réponses reste
 * à sa place, vidé (« Commentaire supprimé ») ; celui d'un compte effacé aussi (« Compte supprimé »). Un commentaire
 * masqué par un opérateur ne se montre qu'à son auteur, avec le motif.
 */

export type CommentResult =
  | { readonly kind: "created"; readonly id: string }
  | { readonly kind: "absent" }
  | { readonly kind: "speaker" }
  | { readonly kind: "parent" }
  | { readonly kind: "limit" }
  | { readonly kind: "text"; readonly problem: TextProblem };

export type CommentEditResult = "edited" | "absent" | { readonly kind: "text"; readonly problem: TextProblem };

export type CommentState = "live" | "deleted" | "erased" | "moderated";

export interface CommentView {
  readonly id: string;
  readonly parentId: string | null;
  /** `null` pour un commentaire supprimé ou d'un compte effacé. */
  readonly author: AuthorView | null;
  readonly body: string;
  readonly state: CommentState;
  readonly createdAt: Date;
  readonly editedAt: Date | null;
  /** Le motif du masque, montré à l'auteur seulement. */
  readonly moderationReason: string | null;
  readonly editable: boolean;
  readonly removable: boolean;
  readonly replies: readonly CommentView[];
}

export interface PostComments {
  comment(actor: Actor, as: SpeakerChoice, postId: string, body: string, parentId: string | null, now: Date): Promise<CommentResult>;
  edit(actor: Actor, commentId: string, body: string, now: Date): Promise<CommentEditResult>;
  remove(actor: Actor, commentId: string, now: Date): Promise<boolean>;
  /** Les commentaires d'une publication lisible par `viewer` (un visiteur anonyme : `null`, publications publiques seulement). */
  list(viewer: Actor | null, postId: string): Promise<readonly CommentView[] | null>;
}

const Uuid = z.uuid();
const DAY_MS = 86_400_000;
/** Commentaires montrés sous une publication. */
export const MAX_COMMENTS_SHOWN = 300;

/** La personne a écrit ce commentaire et parle encore au nom de qui elle l'a écrit (relecture sécurité C22, M2). */
const AUTHORED_BY = (userId: string): Prisma.PostCommentWhereInput => ({
  authorUserId: userId,
  OR: [{ organisationId: null }, { organisation: { is: { members: { some: { userId } } } } }],
});

const COMMENT_SELECT = { id: true, parentId: true, authorUserId: true, body: true, createdAt: true, editedAt: true, deletedAt: true, moderatedAt: true, moderationReason: true, ...SPEAKER_SELECT } as const;
type CommentRow = Prisma.PostCommentGetPayload<{ select: typeof COMMENT_SELECT }>;

const stateOf = (row: CommentRow, listed: boolean): CommentState | null => {
  if (row.deletedAt !== null) return row.authorUserId === null ? "erased" : "deleted";
  if (row.moderatedAt !== null) return "moderated";
  return listed ? "live" : null;
};

export const postComments = (db: Db): PostComments => ({
  async comment(actor, as, postId, rawBody, parentId, now) {
    if (!Uuid.safeParse(postId).success || (parentId !== null && !Uuid.safeParse(parentId).success)) return { kind: "absent" };
    const body = rawBody.trim();
    const problem = textProblem(body, COMMENT_BODY_MAX);
    if (problem !== null) return { kind: "text", problem };
    return db.$transaction(async (tx): Promise<CommentResult> => {
      const post = await tx.post.findFirst({ where: { AND: [{ id: postId }, READABLE_BY(actor.userId)] }, select: { id: true } });
      if (post === null) return { kind: "absent" };
      let parentAuthor: string | null = null;
      if (parentId !== null) {
        const parent = await tx.postComment.findFirst({ where: { AND: [{ id: parentId, postId, parentId: null }, LISTED_COMMENT] }, select: { authorUserId: true } });
        if (parent === null) return { kind: "parent" };
        parentAuthor = parent.authorUserId;
      }
      const speaker = await resolveSpeaker(tx, actor, as);
      if (speaker === null) return { kind: "speaker" };
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
      const recent = await tx.postComment.count({ where: { authorUserId: actor.userId, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } });
      if (recent >= MAX_COMMENTS_PER_DAY) return { kind: "limit" };
      const created = await tx.postComment.create({
        data: { postId, parentId, authorUserId: actor.userId, profileId: speaker.profileId, organisationId: speaker.organisationId, body, createdAt: now },
        select: { id: true },
      });
      const recipients = [...(await postOwners(tx, postId)), ...(parentAuthor === null ? [] : [parentAuthor])];
      await notifyCommunity(tx, recipients, actor.userId, "post_comment", { postId, commentId: created.id });
      return { kind: "created", id: created.id };
    });
  },

  async edit(actor, commentId, rawBody, now) {
    if (!Uuid.safeParse(commentId).success) return "absent";
    const body = rawBody.trim();
    const problem = textProblem(body, COMMENT_BODY_MAX);
    if (problem !== null) return { kind: "text", problem };
    const { count } = await db.postComment.updateMany({ where: { AND: [{ id: commentId, deletedAt: null, moderatedAt: null }, AUTHORED_BY(actor.userId)] }, data: { body, editedAt: now } });
    return count === 1 ? "edited" : "absent";
  },

  async remove(actor, commentId, now) {
    if (!Uuid.safeParse(commentId).success) return false;
    const { count } = await db.postComment.updateMany({
      where: { id: commentId, deletedAt: null, OR: [AUTHORED_BY(actor.userId), { post: MANAGEABLE_BY(actor.userId) }] },
      data: { deletedAt: now, body: "" },
    });
    return count === 1;
  },

  async list(viewer, postId) {
    if (!Uuid.safeParse(postId).success) return null;
    const visible: Prisma.PostWhereInput = viewer === null ? { AND: [{ id: postId, visibility: "public" }, LISTED_POST] } : { AND: [{ id: postId }, READABLE_BY(viewer.userId)] };
    const post = await db.post.findFirst({ where: visible, select: { id: true } });
    if (post === null) return null;
    const [rows, listedRows, manageable] = await Promise.all([
      db.postComment.findMany({ where: { postId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_COMMENTS_SHOWN, select: COMMENT_SELECT }),
      db.postComment.findMany({ where: { AND: [{ postId }, LISTED_COMMENT] }, select: { id: true } }),
      viewer === null ? 0 : db.post.count({ where: { AND: [{ id: postId }, MANAGEABLE_BY(viewer.userId)] } }),
    ]);
    const listed = new Set(listedRows.map((r) => r.id));
    const viewOf = (row: CommentRow): Omit<CommentView, "replies"> | null => {
      const state = stateOf(row, listed.has(row.id));
      if (state === null) return null;
      const mine = viewer !== null && row.authorUserId === viewer.userId;
      if (state === "moderated" && !mine) return null;
      const shown = state === "live" || state === "moderated";
      return {
        id: row.id,
        parentId: row.parentId,
        author: shown ? authorView(row) : null,
        body: shown ? row.body : "",
        state,
        createdAt: row.createdAt,
        editedAt: row.editedAt,
        moderationReason: state === "moderated" ? row.moderationReason : null,
        editable: mine && row.deletedAt === null,
        removable: row.deletedAt === null && (mine || manageable > 0),
      };
    };
    const views = rows.flatMap((row) => {
      const view = viewOf(row);
      return view === null ? [] : [view];
    });
    const repliesOf = (id: string): readonly CommentView[] => views.filter((v) => v.parentId === id && v.state !== "deleted").map((v) => ({ ...v, replies: [] }));
    // Un commentaire supprimé sans réponse visible ne laisse rien ; celui d'un compte effacé laisse « Compte supprimé ».
    return views
      .filter((v) => v.parentId === null)
      .map((v) => ({ ...v, replies: repliesOf(v.id) }))
      .filter((v) => v.state !== "deleted" || v.replies.length > 0);
  },
});
