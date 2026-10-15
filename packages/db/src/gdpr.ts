import { z } from "zod";
import type { Db } from "./client";
import { storedFiles } from "./stored-files";
import { exportMissionsSpace } from "./gdpr-missions";
import { exportLiveMessaging } from "./gdpr-messaging";

/*
 * Droits d'accès (RGPD art. 15 et 20) et d'effacement (art. 17) d'un utilisateur.
 *
 * L'export rassemble tout ce que la base tient sur la personne, dans un format lisible par une machine. L'effacement
 * supprime le compte, ce qui emporte par cascade le profil, les compétences, les adresses, les missions vérifiées et
 * les demandes de confirmation, les candidatures, les fils côté freelance et les appartenances ; les demandes d'audit faites avec la même adresse
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
  "listes de freelances créées au nom d'une entreprise : conservées pour elle, sans créateur ; les pouces de la personne sont supprimés",
  "présence d'un freelance dans les listes des entreprises : supprimée avec son profil",
  "invitations envoyées, modèles de mission et lectures de candidatures faits au nom d'une entreprise : conservés pour elle, sans auteur",
  "pièces jointes envoyées : effacées avec le compte, le message qui les portait reste sans elles",
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
  readonly feedback: unknown;
  /** Listes de freelances créées, freelances ajoutés (avec la note de l'entreprise) et pouces donnés par la personne. */
  readonly freelanceLists: unknown;
  /** Demandes de confirmation de mission décidées au nom d'une entreprise, ou adressées à l'adresse du compte. */
  readonly missionConfirmations: unknown;
  /** Fichiers déposés (photo, CV, images du portfolio) : type, taille, empreinte et date ; le contenu se télécharge depuis l'application. */
  readonly files: unknown;
  /** Missions enregistrées, entreprises suivies, invitations, modèles de mission, candidatures ouvertes (C16). */
  readonly missionsSpace: unknown;
  /** Repères de lecture des fils, notifications de l'application, résumé quotidien par e-mail (C15). */
  readonly liveMessaging: unknown;
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

/*
 * Ce que la personne a fait dans les listes de freelances de ses entreprises. Les listes restent à l'entreprise après
 * son départ (créateur et auteur d'ajout remis à nul) ; ses pouces partent avec son compte.
 */
const exportLists = async (db: Db, userId: string) => {
  const [created, itemsAdded, reactions] = await Promise.all([
    db.freelanceList.findMany({ where: { createdByUserId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, organisationId: true, name: true, createdAt: true } }),
    db.freelanceListItem.findMany({ where: { addedByUserId: userId }, orderBy: { createdAt: "asc" }, select: { listId: true, note: true, createdAt: true, profile: { select: { reference: true } } } }),
    db.freelanceListReaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { itemId: true, reaction: true, createdAt: true } }),
  ]);
  return { created, itemsAdded, reactions };
};
const CONFIRMATION_EXPORT = {
  role: true,
  clientName: true,
  clientSiret: true,
  clientKind: true,
  contactEmail: true,
  startedOn: true,
  endedOn: true,
  summary: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  decidedAt: true,
  showClientName: true,
  emailSentAt: true,
} as const;

export const gdpr = (db: Db): Gdpr => ({
  async exportUser(userId, now) {
    if (!Uuid.safeParse(userId).success) return null;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, clerkId: true, email: true, displayName: true, lang: true, createdAt: true, updatedAt: true },
    });
    if (user === null) return null;

    const [memberships, freelanceProfile, messagesSent, reviewsWritten, jobPostsAuthored, auditRequests, missionAlerts, notificationPreferences, notificationRows, feedbackRows, confirmationsDecided, confirmationsAddressed] = await Promise.all([
      db.membership.findMany({ where: { userId }, select: { organisationId: true, role: true, createdAt: true, organisation: { select: { name: true } } } }),
      db.freelanceProfile.findUnique({
        where: { userId },
        include: {
          billing: true,
          vigilance: { select: { issuedOn: true, securityCode: true, verifiedAt: true, createdAt: true } },
          skills: { select: { skill: { select: { key: true, label: true } } } },
          ownedUrls: true,
          missions: true,
          applications: { select: { id: true, jobPostId: true, coverNote: true, answers: true, status: true, createdAt: true, readAt: true } },
          reviews: { select: { rating: true, body: true, createdAt: true } },
          // Mesures de visibilité : les chiffres de l'entonnoir et l'historique des demandes. Aucune réponse brute de
          // moteur n'est en base, il n'y a donc rien d'autre à rendre.
          waves: {
            select: {
              waveId: true,
              measuredAt: true,
              draws: true,
              costCents: true,
              currency: true,
              results: { select: { engine: true, draws: true, retrieved: true, named: true, top5: true, cited: true } },
            },
          },
          measurements: { select: { status: true, engines: true, createdAt: true, finishedAt: true, errorCode: true, costCents: true } },
          // Demandes de confirmation de missions : tout sauf l'empreinte du jeton, qui ne dit rien de la personne.
          missionConfirmations: { select: CONFIRMATION_EXPORT },
          // Profil enrichi (C14) : sections déclarées et brouillon d'import d'un CV.
          experiences: true,
          educations: true,
          certifications: true,
          languages: true,
          portfolio: true,
          importDraft: true,
          // Audience du profil (C17) : des totaux par jour, sans rien sur les visiteurs ; les empreintes du jour ne sont
          // pas des données de la personne et ne sont pas rendues.
          statDays: { select: { day: true, views: true, searchAppearances: true, directoryAppearances: true, listAdds: true }, orderBy: { day: "asc" } },
          statKeywords: { select: { day: true, kind: true, keyword: true, appearances: true }, orderBy: [{ day: "asc" }, { keyword: "asc" }] },
        },
      }),
      db.message.findMany({ where: { senderUserId: userId }, select: { id: true, conversationId: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
      db.review.findMany({ where: { authorUserId: userId }, select: { id: true, contractId: true, rating: true, body: true, createdAt: true } }),
      db.jobPost.findMany({ where: { authorUserId: userId }, select: { id: true, title: true, status: true, createdAt: true } }),
      db.auditRequest.findMany({ where: { email: user.email }, select: { reference: true, displayName: true, email: true, urls: true, lang: true, consentAt: true, createdAt: true } }),
      db.missionAlert.findMany({ where: { userId }, select: { filters: true, createdAt: true, lastCheckedAt: true } }),
      db.notificationPreference.findMany({ where: { userId }, select: { kind: true, email: true } }),
      db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { kind: true, createdAt: true, sentAt: true } }),
      db.feedback.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { kind: true, side: true, page: true, body: true, createdAt: true } }),
      db.missionConfirmationRequest.findMany({ where: { decidedByUserId: userId }, orderBy: { decidedAt: "asc" }, select: { role: true, clientName: true, status: true, decidedAt: true, showClientName: true } }),
      db.missionConfirmationRequest.findMany({ where: { contactEmail: user.email }, orderBy: { createdAt: "asc" }, select: { role: true, clientName: true, contactEmail: true, status: true, createdAt: true, decidedAt: true } }),
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
    const freelanceLists = await exportLists(db, userId);
    const files = await storedFiles(db).listForExport(userId);
    const missionsSpace = await exportMissionsSpace(db, userId);
    const liveMessaging = await exportLiveMessaging(db, userId);

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
      feedback: feedbackRows,
      freelanceLists,
      missionConfirmations: { decided: confirmationsDecided, addressedToMe: confirmationsAddressed },
      files,
      missionsSpace,
      liveMessaging,
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
      // Les demandes de confirmation adressées à cette adresse partent aussi ; une mission déjà confirmée reste un fait
      // du profil du freelance, sans plus de lien vers la demande.
      await tx.missionConfirmationRequest.deleteMany({ where: { contactEmail: user.email } });
      // Les vagues mesurées décrivent la personne : elles partent avec elle au lieu de rester détachées. Les demandes de
      // mesure partent par cascade avec le profil.
      if (user.freelanceProfile !== null) await tx.wave.deleteMany({ where: { profileId: user.freelanceProfile.id } });
      await tx.user.delete({ where: { id: userId } });
      return "erased";
    });
  },
});
