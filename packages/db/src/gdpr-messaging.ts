import type { Db } from "./client";

/*
 * Export RGPD de la messagerie vivante (C15) : jusqu'où la personne a lu chaque fil, ses notifications de l'application
 * (type, références, dates), et si elle a demandé le résumé quotidien. Tout part avec le compte, par cascade ; les
 * pièces jointes sont listées avec les autres fichiers déposés.
 */
export const exportLiveMessaging = async (db: Db, userId: string) => {
  const [reads, appNotifications, digest] = await Promise.all([
    db.conversationRead.findMany({ where: { userId }, orderBy: { readAt: "asc" }, select: { conversationId: true, readAt: true } }),
    db.appNotification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { kind: true, payload: true, createdAt: true, readAt: true } }),
    db.messageDigest.findUnique({ where: { userId }, select: { createdAt: true, lastRunAt: true } }),
  ]);
  return { reads, appNotifications, dailyDigest: digest };
};
