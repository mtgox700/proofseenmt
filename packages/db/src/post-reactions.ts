import { z } from "zod";
import type { Db } from "./client";
import { ReactionKindSchema } from "./community-input";
import { notifyCommunity, postOwners } from "./community-notify";
import type { Prisma } from "./generated/client";
import type { PostReactionKind } from "./generated/enums";
import type { Actor } from "./messaging";
import { LISTED_POST } from "./public-visibility";

/*
 * Réagir à une publication (C22) : une réaction par personne et par publication, que l'on change ou que l'on retire.
 * On ne réagit qu'à ce qu'on peut lire. Qui répond de la publication est prévenu d'une première réaction, regroupée
 * par publication (une seule notification non lue à la fois) ; changer de réaction ne prévient personne.
 */

export type ReactResult = "reacted" | "changed" | "unchanged" | "absent";

export interface PostReactions {
  react(actor: Actor, postId: string, kind: PostReactionKind): Promise<ReactResult>;
  unreact(actor: Actor, postId: string): Promise<boolean>;
}

const Uuid = z.uuid();

/**
 * Une publication que l'acteur peut lire, et donc commenter ou aimer : listée (publique ou membres), ou la sienne tant
 * qu'elle n'est ni masquée par l'opérateur ni écrite au nom d'une entreprise suspendue (relecture sécurité C22, B1).
 */
export const READABLE_BY = (userId: string): Prisma.PostWhereInput => ({
  OR: [LISTED_POST, { deletedAt: null, moderatedAt: null, AND: [{ OR: [{ organisationId: null }, { organisation: { is: { suspendedAt: null } } }] }], OR: [{ authorUserId: userId }, { profile: { is: { userId } } }, { organisation: { is: { members: { some: { userId } } } } }] }],
});

export const postReactions = (db: Db): PostReactions => ({
  async react(actor, postId, rawKind) {
    const kind = ReactionKindSchema.safeParse(rawKind);
    if (!Uuid.safeParse(postId).success || !kind.success) return "absent";
    return db.$transaction(async (tx): Promise<ReactResult> => {
      const post = await tx.post.findFirst({ where: { AND: [{ id: postId }, READABLE_BY(actor.userId)] }, select: { id: true } });
      if (post === null) return "absent";
      const existing = await tx.postReaction.findUnique({ where: { postId_userId: { postId, userId: actor.userId } }, select: { kind: true } });
      if (existing !== null) {
        if (existing.kind === kind.data) return "unchanged";
        await tx.postReaction.update({ where: { postId_userId: { postId, userId: actor.userId } }, data: { kind: kind.data } });
        return "changed";
      }
      // Deux clics simultanés : la clé primaire n'en garde qu'un, le second ne prévient personne.
      const { count } = await tx.postReaction.createMany({ data: [{ postId, userId: actor.userId, kind: kind.data }], skipDuplicates: true });
      if (count === 0) return "unchanged";
      await notifyCommunity(tx, await postOwners(tx, postId), actor.userId, "post_reaction", { postId });
      return "reacted";
    });
  },

  async unreact(actor, postId) {
    if (!Uuid.safeParse(postId).success) return false;
    const { count } = await db.postReaction.deleteMany({ where: { postId, userId: actor.userId } });
    return count === 1;
  },
});
