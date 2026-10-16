import type { Prisma } from "./generated/client";

/*
 * Mise en file des notifications poussées (C20), dans la transaction qui écrit les notifications de l'application :
 * une ligne par notification et par appareil abonné de son destinataire. Un compte suspendu n'en reçoit aucune. Rien
 * n'est écrit pour qui n'a abonné aucun appareil.
 */
export const queuePushes = async (tx: Prisma.TransactionClient, notificationIds: readonly string[]): Promise<number> => {
  if (notificationIds.length === 0) return 0;
  return tx.$executeRaw`
    INSERT INTO "PushDelivery" ("id", "subscriptionId", "notificationId")
    SELECT gen_random_uuid(), s."id", n."id"
    FROM "AppNotification" n
    JOIN "User" u ON u."id" = n."userId" AND u."suspendedAt" IS NULL
    JOIN "PushSubscription" s ON s."userId" = n."userId"
    WHERE n."id" = ANY(${[...notificationIds]}::uuid[])
    ON CONFLICT DO NOTHING`;
};
