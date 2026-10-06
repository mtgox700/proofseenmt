import { z } from "zod";
import type { Db } from "./client";

/*
 * Droits d'accès (RGPD art. 15 et 20) et d'effacement (art. 17) d'un utilisateur.
 *
 * L'export rassemble tout ce que la base tient sur la personne, dans un format lisible par une machine. L'effacement
 * supprime le compte, ce qui emporte par cascade le profil, les compétences, les adresses, les missions vérifiées, les
 * candidatures, les fils côté freelance et les appartenances ; les demandes d'audit faites avec la même adresse
 * partent dans la même transaction.
 *
 * Ce qui reste, et pourquoi : les contrats, paiements et factures, détachés de la personne mais gardant la copie figée
 * de l'identité légale des parties (obligation comptable, art. 17(3)(b)) ; les messages écrits à une entreprise, sans
 * auteur, parce qu'ils sont aussi la correspondance de l'autre partie. L'export le dit, pour que la réponse faite à la
 * personne soit exacte.
 */

export const RETAINED_AFTER_ERASURE = [
  "contrats, paiements et factures : conservés pour obligation comptable, détachés du compte, identité légale figée",
  "messages envoyés à une entreprise : conservés sans auteur, comme correspondance de l'autre partie",
] as const;

export interface UserExport {
  readonly exportedAt: string;
  readonly user: unknown;
  readonly memberships: unknown;
  readonly freelanceProfile: unknown;
  readonly contracts: unknown;
  readonly messagesSent: unknown;
  readonly reviewsWritten: unknown;
  readonly jobPostsAuthored: unknown;
  readonly auditRequests: unknown;
  readonly missionAlerts: unknown;
  readonly notificationPreferences: unknown;
  readonly notifications: unknown;
  readonly retainedAfterErasure: readonly string[];
}

export interface Gdpr {
  /** Tout ce que la base tient sur cet utilisateur ; `null` s'il n'existe pas. */
  exportUser(userId: string, now: Date): Promise<UserExport | null>;
  /** Efface le compte et ce qui en dépend ; rend `false` s'il n'existait pas. */
  eraseUser(userId: string): Promise<boolean>;
}

const Uuid = z.uuid();

export const gdpr = (db: Db): Gdpr => ({
  async exportUser(userId, now) {
    if (!Uuid.safeParse(userId).success) return null;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, clerkId: true, email: true, displayName: true, createdAt: true, updatedAt: true },
    });
    if (user === null) return null;

    const [memberships, freelanceProfile, messagesSent, reviewsWritten, jobPostsAuthored, auditRequests, missionAlerts, notificationPreferences, notificationRows] = await Promise.all([
      db.membership.findMany({ where: { userId }, select: { organisationId: true, role: true, createdAt: true, organisation: { select: { name: true } } } }),
      db.freelanceProfile.findUnique({
        where: { userId },
        include: {
          billing: true,
          skills: { select: { skill: { select: { key: true, label: true } } } },
          ownedUrls: true,
          missions: true,
          applications: { select: { id: true, jobPostId: true, coverNote: true, status: true, createdAt: true } },
          reviews: { select: { rating: true, body: true, createdAt: true } },
        },
      }),
      db.message.findMany({ where: { senderUserId: userId }, select: { id: true, conversationId: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
      db.review.findMany({ where: { authorUserId: userId }, select: { id: true, contractId: true, rating: true, body: true, createdAt: true } }),
      db.jobPost.findMany({ where: { authorUserId: userId }, select: { id: true, title: true, status: true, createdAt: true } }),
      db.auditRequest.findMany({ where: { email: user.email }, select: { reference: true, displayName: true, email: true, urls: true, lang: true, consentAt: true, createdAt: true } }),
      db.missionAlert.findMany({ where: { userId }, select: { filters: true, createdAt: true, lastCheckedAt: true } }),
      db.notificationPreference.findMany({ where: { userId }, select: { kind: true, email: true } }),
      db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { kind: true, createdAt: true, sentAt: true } }),
    ]);

    const organisationIds = memberships.map((m) => m.organisationId);
    const contracts = await db.contract.findMany({
      where: { OR: [...(freelanceProfile === null ? [] : [{ profileId: freelanceProfile.id }]), { organisationId: { in: organisationIds } }] },
      select: { id: true, status: true, totalCents: true, currency: true, startsOn: true, endsOn: true, sellerSnapshot: true, buyerSnapshot: true },
    });

    return {
      exportedAt: now.toISOString(),
      user,
      memberships,
      freelanceProfile,
      contracts,
      messagesSent,
      reviewsWritten,
      jobPostsAuthored,
      auditRequests,
      missionAlerts,
      notificationPreferences,
      notifications: notificationRows,
      retainedAfterErasure: RETAINED_AFTER_ERASURE,
    };
  },

  async eraseUser(userId) {
    if (!Uuid.safeParse(userId).success) return false;
    return db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user === null) return false;
      await tx.auditRequest.deleteMany({ where: { email: user.email } });
      await tx.user.delete({ where: { id: userId } });
      return true;
    });
  },
});
