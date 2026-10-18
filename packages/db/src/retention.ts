import { purgeAudience } from "./audience-stats";
import { purgeCommunity } from "./post-stats";
import { tombstoneCutoff, TOMBSTONE_RETENTION_YEARS } from "./erasure-tombstones";
import type { Db } from "./client";
import { MEASUREMENT_SPEND_RETENTION_DAYS } from "./measurement-ledger";
import { MAX_ATTEMPTS } from "./notifications";
import { PUSH_STALE_MS } from "./push-queue";
import { STATS_RETENTION_MONTHS } from "./stat-days";

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
  /** Retours de la bêta : lus, traités ou écartés en un an. */
  feedbackDays: 365,
  /** Compteurs du limiteur de débit : une fenêtre passée ne sert plus. */
  rateLimitBucketsDays: 1,
  /**
   * Demandes de mesure terminées : un an suffit à expliquer un historique et à contrôler la dépense. La vague produite,
   * elle, reste avec le profil : c'est le résultat, pas la trace de la demande.
   */
  finishedMeasurementsDays: 365,
  /**
   * Demandes de confirmation de mission : décidées, ou échues sans réponse, elles partent 90 jours après. Elles portent
   * l'adresse d'un tiers (le contact du client) ; la mission confirmée, elle, reste sur le profil.
   */
  missionConfirmationsDays: 90,
  /**
   * Registre de dépense des mesures : ses fenêtres les plus longues (plafond mensuel, limite par profil) couvrent 30
   * jours. Au-delà, ses empreintes d'adresses ne servent plus à rien et ne sont pas gardées.
   */
  measurementSpendDays: MEASUREMENT_SPEND_RETENTION_DAYS,
  /** Notifications de l'application (C15) : lues, 90 jours ; jamais lues, un an, comme un e-mail jamais parti. */
  readAppNotificationsDays: 90,
  unreadAppNotificationsDays: 365,
  /**
   * Compteurs d'audience des profils et d'activité des équipes : treize mois, pour comparer un mois à celui de l'année
   * passée. Les empreintes de visiteurs, elles, ne passent pas la journée.
   */
  audienceStatsMonths: STATS_RETENTION_MONTHS,
  /**
   * Journal des opérateurs (C19) : cinq ans, la preuve de ce qui a été décidé sur un compte ou un contenu, le temps d'un
   * recours. Le déclencheur de la table refuse toute suppression plus tôt : la purge ne peut pas aller plus vite que lui.
   */
  operatorActionsYears: 5,
  /**
   * Abonnements aux notifications poussées (C20) : un appareil qui n'a rien reçu depuis 90 jours (ni depuis son
   * abonnement) est perdu, changé ou désinstallé ; l'abonnement part.
   */
  idlePushSubscriptionsDays: 90,
  /** Traces d'un compte suspendu puis effacé (revue vague 3, L11) : trois ans, au titre de l'intérêt légitime. */
  erasureTombstonesYears: TOMBSTONE_RETENTION_YEARS,
} as const;

export interface PurgeReport {
  readonly notifications: number;
  readonly stripeEvents: number;
  readonly auditRequests: number;
  readonly unansweredConversations: number;
  readonly declinedMessages: number;
  readonly rateLimitBuckets: number;
  readonly feedback: number;
  readonly measurementRequests: number;
  readonly missionConfirmations: number;
  readonly measurementSpend: number;
  readonly appNotifications: number;
  readonly audienceStats: number;
  readonly audienceSightings: number;
  readonly operatorActions: number;
  readonly pushSubscriptions: number;
  readonly pushDeliveries: number;
  readonly erasureTombstones: number;
  /** Publications supprimées depuis plus de 30 jours, parties pour de bon (C22). */
  readonly deletedPosts: number;
  /** Empreintes et compteurs d'audience des publications (C22). */
  readonly postAudience: number;
}

export interface Retention {
  /** Supprime ce qui a dépassé sa durée de conservation à la date `now`, et dit combien de lignes sont parties. */
  purge(now: Date): Promise<PurgeReport>;
}

const before = (now: Date, days: number): Date => new Date(now.getTime() - days * DAY_MS);

export const retention = (db: Db): Retention => ({
  async purge(now) {
    const conversationCutoff = before(now, RETENTION.unansweredConversationsDays);
    const confirmationCutoff = before(now, RETENTION.missionConfirmationsDays);
    const [notifications, stripeEvents, auditRequests, unansweredConversations, declinedMessages, rateLimitBuckets, feedbackRows, measurementRows, confirmationRows, spendRows] = await Promise.all([
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
      db.feedback.deleteMany({ where: { createdAt: { lt: before(now, RETENTION.feedbackDays) } } }),
      db.measurementRequest.deleteMany({
        where: { status: { in: ["done", "failed", "refused"] }, finishedAt: { lt: before(now, RETENTION.finishedMeasurementsDays) } },
      }),
      db.missionConfirmationRequest.deleteMany({
        where: { OR: [{ decidedAt: { lt: confirmationCutoff } }, { status: "pending", expiresAt: { lt: confirmationCutoff } }] },
      }),
      db.measurementSpend.deleteMany({ where: { startedAt: { lt: before(now, RETENTION.measurementSpendDays) } } }),
    ]);
    // Après le reste, sans le ralentir : une ligne par notification, la plus grosse table à purger.
    const appNotificationRows = await db.appNotification.deleteMany({
      where: {
        OR: [
          { readAt: { lt: before(now, RETENTION.readAppNotificationsDays) } },
          { readAt: null, createdAt: { lt: before(now, RETENTION.unreadAppNotificationsDays) } },
        ],
      },
    });
    const pushCutoff = before(now, RETENTION.idlePushSubscriptionsDays);
    const pushSubscriptionRows = await db.pushSubscription.deleteMany({
      where: { OR: [{ lastSuccessAt: { lt: pushCutoff } }, { lastSuccessAt: null, createdAt: { lt: pushCutoff } }] },
    });
    // Une notification poussée qui attend depuis plus d'un jour n'a plus d'intérêt (la file la retire aussi d'elle-même).
    const pushDeliveryRows = await db.pushDelivery.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - PUSH_STALE_MS) } } });
    const audience = await purgeAudience(db, now);
    const community = await purgeCommunity(db, now);
    // La plus prudente des deux bornes : jamais en deçà de cinq ans à l'horloge de la base, que refuserait le déclencheur.
    const operatorCutoff = new Date(now);
    operatorCutoff.setUTCFullYear(operatorCutoff.getUTCFullYear() - RETENTION.operatorActionsYears);
    const tombstoneRows = await db.erasureTombstone.deleteMany({ where: { createdAt: { lt: tombstoneCutoff(now) } } });
    const operatorActions = await db.$executeRaw`
      DELETE FROM "OperatorAction" WHERE "createdAt" < LEAST(${operatorCutoff}::timestamptz, now() - make_interval(years => ${RETENTION.operatorActionsYears}::int))`;
    return {
      notifications: notifications.count,
      stripeEvents: stripeEvents.count,
      auditRequests: auditRequests.count,
      unansweredConversations: unansweredConversations.count,
      declinedMessages: declinedMessages.count,
      rateLimitBuckets: rateLimitBuckets.count,
      feedback: feedbackRows.count,
      measurementRequests: measurementRows.count,
      missionConfirmations: confirmationRows.count,
      measurementSpend: spendRows.count,
      appNotifications: appNotificationRows.count,
      audienceStats: audience.stats,
      audienceSightings: audience.sightings,
      operatorActions,
      pushSubscriptions: pushSubscriptionRows.count,
      pushDeliveries: pushDeliveryRows.count,
      erasureTombstones: tombstoneRows.count,
      deletedPosts: community.posts,
      postAudience: community.stats,
    };
  },
});
