import { recordAppNotifications } from "./app-notifications";
import type { Prisma } from "./generated/client";
import type { AppNotificationKind } from "./generated/enums";

/*
 * Qui est prévenu de ce qui arrive à une publication (C22) : pour un profil, son titulaire ; pour une entreprise, la
 * personne qui a écrit si elle en est encore membre, à défaut ses propriétaires et administrateurs. Celui qui agit
 * n'est jamais prévenu de son propre geste. Notification de l'application (et poussée vers les appareils abonnés),
 * écrite dans la transaction du geste ; elle ne porte que des références, jamais le texte.
 */

/** Ceux qui répondent d'une publication. */
export const postOwners = async (tx: Prisma.TransactionClient, postId: string): Promise<readonly string[]> => {
  const post = await tx.post.findUnique({
    where: { id: postId },
    select: { authorUserId: true, organisationId: true, profile: { select: { userId: true } } },
  });
  if (post === null) return [];
  if (post.profile !== null) return [post.profile.userId];
  if (post.organisationId === null) return [];
  if (post.authorUserId !== null) {
    const stillMember = await tx.membership.count({ where: { organisationId: post.organisationId, userId: post.authorUserId } });
    if (stillMember > 0) return [post.authorUserId];
  }
  const admins = await tx.membership.findMany({ where: { organisationId: post.organisationId, role: { in: ["owner", "admin"] } }, select: { userId: true } });
  return admins.map((a) => a.userId);
};

/** Prévient ces personnes, sauf l'acteur. */
export const notifyCommunity = async (
  tx: Prisma.TransactionClient,
  recipients: readonly string[],
  actorUserId: string,
  kind: Extract<AppNotificationKind, "post_comment" | "post_reaction" | "post_share" | "new_follower">,
  payload: Readonly<Record<string, string>>,
): Promise<number> => recordAppNotifications(tx, recipients.filter((id) => id !== actorUserId), kind, payload);
