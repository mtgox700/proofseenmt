import type { Db } from "./client";
import type { Prisma } from "./generated/client";

/*
 * La communauté (C22) dans les droits RGPD.
 *
 * Export : les publications que la personne a écrites (au nom de son profil ou d'une entreprise), ses commentaires, ses
 * réactions, les profils qu'elle suit, le nombre de ses abonnés (jamais leur identité : ce sont les données d'autres
 * personnes) et l'audience de ses publications (des totaux par jour, rien sur les visiteurs).
 *
 * Effacement : les publications de son profil partent avec lui (cascade), comme ses réactions et ses abonnements. Ses
 * commentaires restent à leur place dans les conversations des autres, vidés de leur texte et sans auteur (« Compte
 * supprimé »). Les publications qu'elle a écrites au nom d'une entreprise restent à l'entreprise, sans auteur, comme
 * ses missions.
 */

export const exportCommunity = async (db: Db, userId: string) => {
  const postSelect = {
    id: true,
    profileId: true,
    organisationId: true,
    body: true,
    linkUrl: true,
    imageFileId: true,
    visibility: true,
    sharedPostId: true,
    createdAt: true,
    editedAt: true,
    deletedAt: true,
    moderatedAt: true,
    moderationReason: true,
    statDays: { select: { day: true, impressions: true, views: true }, orderBy: { day: "asc" as const } },
  } as const;
  const [posts, comments, reactions, followedProfiles, profile] = await Promise.all([
    db.post.findMany({ where: { OR: [{ authorUserId: userId }, { profile: { is: { userId } } }] }, orderBy: { createdAt: "asc" }, select: postSelect }),
    db.postComment.findMany({
      where: { authorUserId: userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, postId: true, parentId: true, profileId: true, organisationId: true, body: true, createdAt: true, editedAt: true, deletedAt: true, moderatedAt: true, moderationReason: true },
    }),
    db.postReaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { postId: true, kind: true, createdAt: true } }),
    db.profileFollow.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, profile: { select: { reference: true } } } }),
    db.freelanceProfile.findUnique({ where: { userId }, select: { _count: { select: { followers: true } } } }),
  ]);
  return {
    posts,
    comments,
    reactions,
    followedProfiles: followedProfiles.map((f) => ({ reference: f.profile.reference, followedAt: f.createdAt })),
    followerCount: profile?._count.followers ?? 0,
  };
};

/** Dans la transaction de l'effacement, avant la suppression du compte : ses commentaires restent, vidés et sans auteur. */
export const eraseCommunityComments = async (tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> => {
  await tx.postComment.updateMany({ where: { authorUserId: userId }, data: { body: "", deletedAt: now, authorUserId: null, profileId: null, organisationId: null } });
};
