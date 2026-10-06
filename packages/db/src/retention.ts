import type { Db } from "./client";
import { MAX_ATTEMPTS } from "./notifications";

/*
 * Durées de conservation appliquées par la tâche planifiée, pas seulement écrites dans un registre.
 *
 * Chaque durée a une raison : au-delà, la donnée ne sert plus à ce pour quoi elle a été collectée. Ce qui relève d'une
 * obligation légale plus longue (contrats, paiements, factures : dix ans) n'est pas purgé ici ; aucune de ces lignes
 * n'atteindra cette durée avant 2036.
 */

const DAY_MS = 86_400_000;

export const RETENTION = {
  /** Une notification ne porte que des références ; son rôle s'arrête à l'envoi (ou à l'abandon après 5 essais). */
  notificationsDays: 90,
  /** Une notification jamais envoyée (aucun transport configuré) attend, mais pas au-delà d'un an. */
  unsentNotificationsDays: 365,
  /** Stripe renvoie un événement pendant 3 jours au plus : 90 jours couvrent largement les doublons tardifs. */
  stripeEventsDays: 90,
  /** Demande d'audit sans suite : prospect, trois ans après le dernier contact (recommandation de la CNIL). */
  auditRequestsDays: 3 * 365,
  /**
   * Prise de contact restée sans réponse un an : supprimée. Un refus, lui, reste (sans ses messages, un an après la
   * décision) : effacer la ligne permettrait à l'entreprise de recontacter aussitôt la personne qui a dit non.
   */
  unansweredConversationsDays: 365,
  /** Compteurs du limiteur de débit : une fenêtre passée ne sert plus. */
  rateLimitBucketsDays: 1,
} as const;

export interface PurgeReport {
  readonly notifications: number;
  readonly stripeEvents: number;
  readonly auditRequests: number;
  readonly unansweredConversations: number;
  readonly declinedMessages: number;
  readonly rateLimitBuckets: number;
}

export interface Retention {
  /** Supprime ce qui a dépassé sa durée de conservation à la date `now`, et dit combien de lignes sont parties. */
  purge(now: Date): Promise<PurgeReport>;
}

const before = (now: Date, days: number): Date => new Date(now.getTime() - days * DAY_MS);

export const retention = (db: Db): Retention => ({
  async purge(now) {
    const conversationCutoff = before(now, RETENTION.unansweredConversationsDays);
    const [notifications, stripeEvents, auditRequests, unansweredConversations, declinedMessages, rateLimitBuckets] = await Promise.all([
      db.notification.deleteMany({
        where: {
          OR: [
            { createdAt: { lt: before(now, RETENTION.notificationsDays) }, OR: [{ sentAt: { not: null } }, { attempts: { gte: MAX_ATTEMPTS } }] },
            { createdAt: { lt: before(now, RETENTION.unsentNotificationsDays) } },
          ],
        },
      }),
      db.stripeEvent.deleteMany({ where: { receivedAt: { lt: before(now, RETENTION.stripeEventsDays) } } }),
      db.auditRequest.deleteMany({ where: { createdAt: { lt: before(now, RETENTION.auditRequestsDays) } } }),
      db.conversation.deleteMany({ where: { status: "pending", lastMessageAt: { lt: conversationCutoff } } }),
      db.message.deleteMany({ where: { conversation: { status: "declined", decidedAt: { lt: conversationCutoff } } } }),
      db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: before(now, RETENTION.rateLimitBucketsDays) } } }),
    ]);
    return {
      notifications: notifications.count,
      stripeEvents: stripeEvents.count,
      auditRequests: auditRequests.count,
      unansweredConversations: unansweredConversations.count,
      declinedMessages: declinedMessages.count,
      rateLimitBuckets: rateLimitBuckets.count,
    };
  },
});
