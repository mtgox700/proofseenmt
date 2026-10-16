import type { Db } from "./client";
import { exportPushSubscriptions } from "./push-subscriptions";

/*
 * Export RGPD de la messagerie vivante (C15) : jusqu'où la personne a lu chaque fil, ses notifications de l'application
 * (type, références, dates), et si elle a demandé le résumé quotidien. Tout part avec le compte, par cascade ; les
 * pièces jointes sont listées avec les autres fichiers déposés. Les appareils abonnés aux notifications poussées (C20)
 * sont rendus par leur service et leurs dates, jamais par leur adresse d'envoi ni leurs clés.
 */
export const exportLiveMessaging = async (db: Db, userId: string) => {
  const [reads, appNotifications, digest, pushSubscriptions] = await Promise.all([
    db.conversationRead.findMany({ where: { userId }, orderBy: { readAt: "asc" }, select: { conversationId: true, readAt: true } }),
    db.appNotification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { kind: true, payload: true, createdAt: true, readAt: true } }),
    db.messageDigest.findUnique({ where: { userId }, select: { createdAt: true, lastRunAt: true } }),
    exportPushSubscriptions(db, userId),
  ]);
  return { reads, appNotifications, dailyDigest: digest, pushSubscriptions };
};
