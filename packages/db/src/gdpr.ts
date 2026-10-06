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
 * de l'identité légale des parties (obligation comptable, art. 17(3)(b)) ; les messages qu'un membre d'entreprise a
 * écrits, sans auteur, parce qu'ils restent la correspondance du freelance. Les fils d'un freelance effacé partent avec
 * son profil. L'export le dit, pour que la réponse faite à la personne soit exacte.
 *
 * L'effacement attend la fin des contrats en cours : un freelance effacé perdrait son compte de versement et des fonds
 * bloqués ne pourraient plus lui être versés ; une entreprise sans plus aucun membre ne pourrait plus valider une
 * prestation. La personne termine ou annule d'abord, puis efface. La vérification et l'effacement se font sous verrou
 * du profil et des entreprises concernés : un contrat créé ou un collègue qui s'efface en même temps attend son tour au
 * lieu de passer entre les deux. Le dernier membre qui part ferme les missions encore ouvertes de son entreprise :
 * personne ne recevrait plus les candidatures.
 */

export const RETAINED_AFTER_ERASURE = [
  "contrats, paiements et factures : conservés pour obligation comptable, détachés du compte, identité légale figée",
  "messages écrits au nom d'une entreprise : conservés sans auteur, comme correspondance du freelance",
  "conversations d'un freelance : supprimées avec son profil",
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

/** « in_progress » : un contrat en cours ou des fonds engagés empêchent l'effacement pour l'instant. */
export type EraseResult = "erased" | "absent" | "in_progress";

const OPEN_CONTRACTS = ["pending_signatures", "active"] as const;
const MONEY_IN_FLIGHT = ["pending", "held", "releasing", "refunding", "disputed"] as const;

export interface Gdpr {
  /** Tout ce que la base tient sur cet utilisateur ; `null` s'il n'existe pas. */
  exportUser(userId: string, now: Date): Promise<UserExport | null>;
  /** Efface le compte et ce qui en dépend, sauf contrat en cours. */
  eraseUser(userId: string): Promise<EraseResult>;
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

    // Côté entreprise, la copie de l'identité légale du freelance n'est pas une donnée de la personne qui demande : un
    // membre arrivé après coup n'a pas à recevoir l'adresse de freelances avec qui il n'a jamais traité.
    const organisationIds = memberships.map((m) => m.organisationId);
    const terms = { id: true, status: true, totalCents: true, currency: true, startsOn: true, endsOn: true } as const;
    const [asFreelance, asCompany] = await Promise.all([
      freelanceProfile === null ? [] : db.contract.findMany({ where: { profileId: freelanceProfile.id }, select: { ...terms, sellerSnapshot: true, buyerSnapshot: true } }),
      db.contract.findMany({ where: { organisationId: { in: organisationIds } }, select: { ...terms, organisationId: true, buyerSnapshot: true } }),
    ]);
    const contracts = { asFreelance, asCompany };

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
    if (!Uuid.safeParse(userId).success) return "absent";
    return db.$transaction(async (tx): Promise<EraseResult> => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, freelanceProfile: { select: { id: true } }, memberships: { select: { organisationId: true } } },
      });
      if (user === null) return "absent";
      const orgIds = user.memberships.map((m) => m.organisationId).sort();
      // Verrous pris dans un ordre fixe : une création de contrat (clé étrangère) ou l'effacement d'un collègue attend.
      if (user.freelanceProfile !== null) await tx.$queryRaw`SELECT "id" FROM "FreelanceProfile" WHERE "id" = ${user.freelanceProfile.id}::uuid FOR UPDATE`;
      for (const id of orgIds) await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = ${id}::uuid FOR UPDATE`;
      // Les entreprises dont la personne est le dernier membre : personne d'autre ne pourrait suivre leurs contrats.
      const others = await tx.membership.groupBy({ by: ["organisationId"], where: { organisationId: { in: orgIds }, userId: { not: userId } } });
      const lastMemberOf = orgIds.filter((id) => !others.some((o) => o.organisationId === id));
      const parties = [...(user.freelanceProfile === null ? [] : [{ profileId: user.freelanceProfile.id }]), ...(lastMemberOf.length === 0 ? [] : [{ organisationId: { in: lastMemberOf } }])];
      if (parties.length > 0) {
        const busy = await tx.contract.count({
          where: { AND: [{ OR: parties }, { OR: [{ status: { in: [...OPEN_CONTRACTS] } }, { payments: { some: { status: { in: [...MONEY_IN_FLIGHT] } } } }] }] },
        });
        if (busy > 0) return "in_progress";
      }
      if (lastMemberOf.length > 0) {
        await tx.jobPost.updateMany({ where: { organisationId: { in: lastMemberOf }, status: "open" }, data: { status: "closed", closedAt: new Date() } });
      }
      await tx.auditRequest.deleteMany({ where: { email: user.email } });
      await tx.user.delete({ where: { id: userId } });
      return "erased";
    });
  },
});
