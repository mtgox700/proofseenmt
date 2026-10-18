import { z } from "zod";
import { textProblem, type TextProblem } from "./community-input";
import type { InvitationStatus } from "./generated/enums";

/*
 * Ce qui, dans les invitations (C23), ne dépend pas de la base : durées, plafonds, lecture de l'adresse et du mot
 * personnel, état montré à l'expéditeur.
 */

/** Une invitation sans réponse échoit au bout de quatorze jours. */
export const INVITATION_TTL_DAYS = 14;
/** Invitations au plus par expéditeur sur 24 heures, tous types confondus. */
export const MAX_INVITATIONS_PER_SENDER_PER_DAY = 20;
/** Invitations au plus par entreprise sur 24 heures, tous membres confondus. */
export const MAX_ORGANISATION_INVITATIONS_PER_DAY = 50;
/**
 * Invitations au plus vers une même boîte sur la durée de vie d'une invitation, tous expéditeurs confondus : inviter ne
 * doit pas devenir un moyen d'envoyer des e-mails au nom de Proofseen à qui l'on veut.
 */
export const MAX_INVITATIONS_PER_MAILBOX = 3;
export const INVITATION_MESSAGE_MAX = 500;
/** La relance unique n'est permise qu'après ce délai : le premier e-mail a eu le temps d'être lu. */
export const REMINDER_DELAY_DAYS = 2;

const optionalMessage = z
  .string()
  .nullish()
  .transform((v) => (v === undefined || v === null ? null : v.trim().replace(/\r\n?/g, "\n")))
  .transform((v) => (v === "" ? null : v));

export const InvitationEmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** Ce que l'expéditeur envoie : une adresse, et un mot personnel facultatif (relu par `invitationMessageProblem`). */
export const InvitationInputSchema = z.object({
  email: InvitationEmailSchema,
  message: optionalMessage,
});

export type InvitationInput = z.input<typeof InvitationInputSchema>;

/** Le problème d'un mot personnel (balises, coordonnées, longueur), ou `null` s'il est recevable. */
export const invitationMessageProblem = (message: string | null): TextProblem | null => (message === null ? null : textProblem(message, INVITATION_MESSAGE_MAX, true));

/** Ce que voit l'expéditeur. Un refus n'en est pas un : il reste « en attente », puis « expirée ». */
export type InvitationState = "pending" | "accepted" | "expired" | "revoked";

export const invitationState = (row: { readonly status: InvitationStatus; readonly expiresAt: Date }, now: Date): InvitationState => {
  if (row.status === "accepted" || row.status === "revoked") return row.status;
  return row.expiresAt.getTime() <= now.getTime() ? "expired" : "pending";
};

/** Une adresse à demi masquée (« a***@client.fr ») : assez pour reconnaître la sienne, pas pour la recopier. */
export const maskEmail = (email: string): string => {
  const at = email.lastIndexOf("@");
  return at < 1 ? "***" : `${email.slice(0, 1)}***${email.slice(at)}`;
};

/** Les adresses vérifiées d'un compte, lues comme l'adresse invitée : sans espaces, en minuscules. */
export const normaliseEmails = (emails: readonly string[]): readonly string[] => [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e !== ""))];
