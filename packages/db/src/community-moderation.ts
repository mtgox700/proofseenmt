import { z } from "zod";
import { assertOperator, notifyAccount, ReasonSchema, recordAction, type Operator, type OperatorResult } from "./back-office";
import type { Db } from "./client";
import { postOwners } from "./community-notify";
import { authorView, SPEAKER_SELECT } from "./community-speaker";
import type { Prisma } from "./generated/client";
import { plainExcerpt } from "./post-views";

/*
 * Modération de la communauté (C22), sur le modèle de C19 : un opérateur masque ou rétablit une publication ou un
 * commentaire, toujours avec un motif. Une seule instruction conditionnelle par décision (deux opérateurs qui cliquent
 * en même temps ne font qu'une décision et qu'une entrée de journal), écrite avec son entrée au journal et l'e-mail à
 * la personne concernée, dans la même transaction. Masquer ne supprime rien : le contenu sort de tous les chemins
 * publics (`LISTED_POST`, `LISTED_COMMENT`), et son auteur le voit avec le motif.
 */

export type CommunityTarget = "post" | "comment";

export interface CommunityItem {
  readonly target: CommunityTarget;
  readonly id: string;
  /** La publication de ce commentaire, ou la publication elle-même. */
  readonly postId: string;
  readonly authorName: string;
  readonly excerpt: string;
  readonly createdAt: Date;
  readonly moderatedAt: Date | null;
  readonly reason: string | null;
}

export interface CommunityModeration {
  hide(target: CommunityTarget, id: string, reason: string, now: Date): Promise<OperatorResult>;
  restore(target: CommunityTarget, id: string, reason: string, now: Date): Promise<OperatorResult>;
  /** Ce qui est masqué aujourd'hui, le plus récent d'abord. */
  hidden(): Promise<readonly CommunityItem[]>;
  /** Les dernières publications et les derniers commentaires vivants, à relire. */
  recent(limit?: number): Promise<readonly CommunityItem[]>;
}

const Uuid = z.uuid();
const MAX_LISTED = 200;

const ACTIONS = {
  post: { hide: "post_hidden", restore: "post_restored" },
  comment: { hide: "comment_hidden", restore: "comment_restored" },
} as const;

const recipientsOf = async (tx: Prisma.TransactionClient, target: CommunityTarget, id: string): Promise<{ readonly found: boolean; readonly users: readonly string[]; readonly label: string }> => {
  if (target === "post") {
    const post = await tx.post.findUnique({ where: { id }, select: { body: true } });
    return post === null ? { found: false, users: [], label: "" } : { found: true, users: await postOwners(tx, id), label: plainExcerpt(post.body, 80) };
  }
  const comment = await tx.postComment.findUnique({ where: { id }, select: { authorUserId: true, body: true } });
  return comment === null ? { found: false, users: [], label: "" } : { found: true, users: comment.authorUserId === null ? [] : [comment.authorUserId], label: plainExcerpt(comment.body, 80) };
};

const flip = async (tx: Prisma.TransactionClient, target: CommunityTarget, id: string, hide: boolean, reason: string, now: Date): Promise<number> => {
  const data = hide ? { moderatedAt: now, moderationReason: reason } : { moderatedAt: null, moderationReason: null };
  const where = { id, moderatedAt: hide ? null : { not: null } };
  return target === "post" ? (await tx.post.updateMany({ where, data })).count : (await tx.postComment.updateMany({ where, data })).count;
};

const ITEM_SELECT = { id: true, body: true, createdAt: true, moderatedAt: true, moderationReason: true, ...SPEAKER_SELECT } as const;

export const communityModeration = (db: Db, operator: Operator): CommunityModeration => {
  assertOperator(operator);

  const apply = async (target: CommunityTarget, id: string, rawReason: string, hide: boolean, now: Date): Promise<OperatorResult> => {
    const reason = ReasonSchema.parse(rawReason);
    if (!Uuid.safeParse(id).success) return "absent";
    return db.$transaction(async (tx): Promise<OperatorResult> => {
      const found = await recipientsOf(tx, target, id);
      if (!found.found) return "absent";
      if ((await flip(tx, target, id, hide, reason, now)) === 0) return "unchanged";
      const kind = hide ? "hide" : "restore";
      await recordAction(tx, operator, { action: ACTIONS[target][kind], targetType: target, targetId: id, reason, metadata: { label: found.label } }, now);
      await notifyAccount(tx, found.users, ACTIONS[target][kind], reason, found.label);
      return "done";
    });
  };

  const items = async (where: { readonly moderatedAt: { not: null } } | { readonly moderatedAt: null; readonly deletedAt: null }, take: number): Promise<readonly CommunityItem[]> => {
    const order = [{ createdAt: "desc" as const }, { id: "desc" as const }];
    const [posts, comments] = await Promise.all([
      db.post.findMany({ where, orderBy: order, take, select: ITEM_SELECT }),
      db.postComment.findMany({ where, orderBy: order, take, select: { ...ITEM_SELECT, postId: true } }),
    ]);
    const item = (target: CommunityTarget, row: Prisma.PostGetPayload<{ select: typeof ITEM_SELECT }>, postId: string): CommunityItem => ({
      target,
      id: row.id,
      postId,
      authorName: authorView(row)?.name ?? "",
      excerpt: plainExcerpt(row.body, 200),
      createdAt: row.createdAt,
      moderatedAt: row.moderatedAt,
      reason: row.moderationReason,
    });
    return [...posts.map((p) => item("post", p, p.id)), ...comments.map((c) => item("comment", c, c.postId))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take);
  };

  return {
    hide: (target, id, reason, now) => apply(target, id, reason, true, now),
    restore: (target, id, reason, now) => apply(target, id, reason, false, now),
    hidden: () => items({ moderatedAt: { not: null } }, MAX_LISTED),
    recent: (limit = 50) => items({ moderatedAt: null, deletedAt: null }, Math.min(Math.max(Math.trunc(limit), 1), MAX_LISTED)),
  };
};
