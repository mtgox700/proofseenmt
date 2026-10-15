import type { Db } from "./client";

/*
 * Export RGPD de l'espace missions (C16) : missions enregistrées, entreprises suivies, invitations reçues et envoyées,
 * modèles de mission créés, candidatures ouvertes par la personne au nom de son entreprise. L'effacement suit les
 * clés étrangères : les marque-pages et les entreprises suivies partent avec le compte ; les invitations reçues partent
 * avec le profil ; celles envoyées, les modèles et les lectures restent à l'entreprise, sans auteur.
 */
export const exportMissionsSpace = async (db: Db, userId: string) => {
  const [savedMissions, followedCompanies, invitationsReceived, invitationsSent, templatesCreated, applicationsRead] = await Promise.all([
    db.savedMission.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { jobPostId: true, createdAt: true } }),
    db.companyFollow.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { organisationId: true, createdAt: true } }),
    db.missionInvitation.findMany({ where: { profile: { userId } }, orderBy: { createdAt: "asc" }, select: { jobPostId: true, createdAt: true, dismissedAt: true } }),
    db.missionInvitation.findMany({ where: { invitedByUserId: userId }, orderBy: { createdAt: "asc" }, select: { jobPostId: true, createdAt: true, profile: { select: { reference: true } } } }),
    db.missionTemplate.findMany({ where: { createdByUserId: userId }, orderBy: { createdAt: "asc" }, select: { organisationId: true, name: true, data: true, createdAt: true } }),
    db.application.findMany({ where: { readByUserId: userId }, orderBy: { readAt: "asc" }, select: { id: true, jobPostId: true, readAt: true } }),
  ]);
  return { savedMissions, followedCompanies, invitationsReceived, invitationsSent, templatesCreated, applicationsRead };
};
