import type { Db } from "./client";
import { mailboxKey } from "./mission-confirmation-input";

/*
 * La part des invitations (C23) dans l'export RGPD : celles que la personne a envoyées, celles adressées à l'adresse de
 * son compte ou auxquelles elle a répondu, et les viviers d'entreprise qu'elle a rejoints. L'empreinte du jeton n'est
 * pas rendue : elle ne dit rien de la personne.
 */

const INVITATION_EXPORT = { kind: true, email: true, message: true, status: true, createdAt: true, expiresAt: true, decidedAt: true, remindedAt: true, emailSentAt: true } as const;

export const exportInvitations = async (db: Db, userId: string, email: string) => {
  const [sent, received, pools] = await Promise.all([
    db.invitation.findMany({ where: { senderUserId: userId }, orderBy: { createdAt: "asc" }, select: { ...INVITATION_EXPORT, organisation: { select: { name: true } } } }),
    db.invitation.findMany({
      // La même boîte que l'adresse du compte ; ses autres adresses vérifiées ne sont connues que de Clerk.
      where: { OR: [{ email }, { mailbox: mailboxKey(email) }, { acceptedByUserId: userId }] },
      orderBy: { createdAt: "asc" },
      select: { ...INVITATION_EXPORT, organisation: { select: { name: true } }, clientOrganisation: { select: { name: true } } },
    }),
    db.talentPoolEntry.findMany({ where: { userId }, orderBy: { joinedAt: "asc" }, select: { joinedAt: true, organisation: { select: { name: true } } } }),
  ]);
  return { sent, received, pools };
};
