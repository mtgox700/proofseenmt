import { z } from "zod";
import type { Db } from "./client";
import type { TextProblem } from "./community-input";
import { containsContact } from "./contact-detection";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { InvitationKind } from "./generated/enums";
import {
  INVITATION_TTL_DAYS,
  InvitationInputSchema,
  invitationMessageProblem,
  invitationState,
  MAX_INVITATIONS_PER_MAILBOX,
  MAX_ORGANISATION_INVITATIONS_PER_DAY,
  MAX_INVITATIONS_PER_SENDER_PER_DAY,
  REMINDER_DELAY_DAYS,
  type InvitationInput,
  type InvitationState,
} from "./invitation-input";
import type { Actor } from "./messaging";
import { confirmationTokenHash, mailboxKey, TOKEN_FORMAT } from "./mission-confirmation-input";

/*
 * Invitations par e-mail (C23). Deux sens : une entreprise invite les freelances avec qui elle travaille déjà (ils
 * rejoignent son vivier privé en acceptant), un freelance invite une entreprise cliente (rattachée quand la personne
 * invitée crée ou rejoint son entreprise). Aucune récompense, aucun argent.
 *
 * Rien ne dit à l'expéditeur si l'adresse a déjà un compte : l'envoi ne lit jamais la table des comptes, la réponse
 * et l'e-mail sont les mêmes dans les deux cas. Un compte existant voit en plus l'invitation dans son espace, à
 * condition que l'adresse soit l'une de ses adresses vérifiées. Un refus n'est jamais montré à l'expéditeur.
 *
 * Plafonds tenus sous verrou (l'expéditeur, l'entreprise, la boîte invitée) pour qu'aucune rafale ne passe entre le
 * comptage et l'écriture. Le jeton du lien n'est jamais en base : seulement son empreinte SHA-256.
 */

const DAY_MS = 86_400_000;
const Uuid = z.uuid();
const ADMINS = ["owner", "admin"] as const;
const LIST_LIMIT = 200;

/** L'identifiant et le jeton du lien, tirés par l'appelant (le jeton est recalculé au moment d'envoyer l'e-mail). */
export interface InvitationLink {
  readonly id: string;
  readonly token: string;
}

export type InvitationTarget = { readonly kind: "freelance"; readonly organisationId: string } | { readonly kind: "client" };

export type InvitationResult =
  | { readonly kind: "invited"; readonly invitationId: string }
  /** Adresse illisible, ou lien mal formé. */
  | { readonly kind: "invalid" }
  | { readonly kind: "message"; readonly problem: TextProblem }
  /** L'adresse est celle de l'expéditeur. */
  | { readonly kind: "self" }
  /** Entreprise inconnue, masquée, ou que l'expéditeur n'administre pas (propriétaire ou administrateur). */
  | { readonly kind: "absent" }
  /** Un freelance invite une entreprise depuis son profil : sans profil, rien à présenter. */
  | { readonly kind: "no_profile" }
  | { readonly kind: "already_invited" }
  | { readonly kind: "limit" };

export interface SentEmailInvitation {
  readonly id: string;
  readonly kind: InvitationKind;
  readonly email: string;
  readonly state: InvitationState;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly reminded: boolean;
  /** La relance unique est encore possible (délai passé, invitation ouverte, pas encore relancée). */
  readonly remindable: boolean;
  /** L'acteur peut révoquer ou relancer : l'expéditeur, ou un administrateur de l'entreprise qui invite. */
  readonly manageable: boolean;
  /** `client` : l'entreprise rattachée à l'invitation acceptée. */
  readonly linkedOrganisationName: string | null;
}

export type ManageResult = "done" | "absent" | "closed" | "too_soon" | "already";

export interface Invitations {
  invite(actor: Actor, target: InvitationTarget, input: InvitationInput, link: InvitationLink, lang: "fr" | "en", now: Date): Promise<InvitationResult>;
  /** Les invitations d'une entreprise, pour ses membres ; `null` pour les autres. */
  listForOrganisation(actor: Actor, organisationId: string, now: Date): Promise<readonly SentEmailInvitation[] | null>;
  /** Les invitations d'entreprises clientes envoyées par l'acteur. */
  listMine(actor: Actor, now: Date): Promise<readonly SentEmailInvitation[]>;
  revoke(actor: Actor, invitationId: string, now: Date): Promise<ManageResult>;
  /** La relance unique : l'e-mail repart une fois, avec le même lien. */
  remind(actor: Actor, invitationId: string, now: Date): Promise<ManageResult>;
}

/** Le nom sous lequel un freelance invite : son nom affiché, ou sa référence s'il contient une coordonnée. */
export const senderLabel = (displayName: string, reference: string | null): string => (containsContact(displayName) && reference !== null ? reference : displayName);

/**
 * Le nom sous lequel une entreprise invite, ou `null` (« Une entreprise ») s'il contient un lien ou une coordonnée : un
 * e-mail envoyé par Proofseen ne doit pas relayer « https://evil.xyz/verify » ni un faux domaine d'administration. Un
 * nom de domaine permis comme raison sociale (« Booking.com ») devient neutre lui aussi : prudence assumée.
 */
export const organisationLabel = (name: string): string | null => (containsContact(name) ? null : name);

/** Une invitation que l'acteur peut gérer : la sienne, ou celle d'une entreprise qu'il administre. */
const managedBy = (userId: string): Prisma.InvitationWhereInput => ({
  OR: [{ senderUserId: userId }, { organisation: { members: { some: { userId, role: { in: [...ADMINS] } } } } }],
});

const SENT_SELECT = {
  id: true,
  kind: true,
  email: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  remindedAt: true,
  senderUserId: true,
  clientOrganisation: { select: { name: true } },
} as const;

type SentRow = Prisma.InvitationGetPayload<{ select: typeof SENT_SELECT }>;

const sentView = (row: SentRow, manageable: boolean, now: Date): SentEmailInvitation => {
  const state = invitationState(row, now);
  return {
    id: row.id,
    kind: row.kind,
    email: row.email,
    state,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    reminded: row.remindedAt !== null,
    remindable: manageable && state === "pending" && row.remindedAt === null && now.getTime() - row.createdAt.getTime() >= REMINDER_DELAY_DAYS * DAY_MS,
    manageable,
    linkedOrganisationName: row.clientOrganisation?.name ?? null,
  };
};

/** Les plafonds de l'expéditeur et de l'entreprise, comptés sous les verrous déjà pris. */
const overSenderLimit = async (tx: Prisma.TransactionClient, senderUserId: string, organisationId: string | null, now: Date): Promise<boolean> => {
  const day = { gt: new Date(now.getTime() - DAY_MS) };
  const [bySender, byOrganisation] = await Promise.all([
    tx.invitation.count({ where: { senderUserId, createdAt: day } }),
    organisationId === null ? Promise.resolve(0) : tx.invitation.count({ where: { organisationId, createdAt: day } }),
  ]);
  return bySender >= MAX_INVITATIONS_PER_SENDER_PER_DAY || byOrganisation >= MAX_ORGANISATION_INVITATIONS_PER_DAY;
};

/**
 * Le plafond de la boîte invitée, tous expéditeurs confondus. Une invitation révoquée avant que son e-mail parte ne
 * compte pas : sinon trois invitations aussitôt révoquées fermeraient une adresse à tout le monde pendant 14 jours.
 */
const overMailboxLimit = async (tx: Prisma.TransactionClient, mailbox: string, now: Date): Promise<boolean> =>
  (await tx.invitation.count({
    where: { mailbox, createdAt: { gt: new Date(now.getTime() - INVITATION_TTL_DAYS * DAY_MS) }, NOT: { status: "revoked", emailSentAt: null } },
  })) >= MAX_INVITATIONS_PER_MAILBOX;

const createInvitation = async (
  tx: Prisma.TransactionClient,
  actor: Actor,
  target: InvitationTarget,
  input: { readonly email: string; readonly message: string | null },
  link: InvitationLink,
  lang: "fr" | "en",
  now: Date,
): Promise<InvitationResult> => {
  const sender = await tx.$queryRaw<{ email: string }[]>`SELECT "email" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
  const own = sender[0]?.email;
  if (own === undefined) return { kind: "absent" };
  const mailbox = mailboxKey(input.email);
  if (mailbox === mailboxKey(own)) return { kind: "self" };
  const organisationId = target.kind === "freelance" ? target.organisationId : null;
  if (organisationId !== null) {
    // Inviter engage le vivier de l'entreprise : comme accepter un devis, c'est l'affaire de ses administrateurs.
    const admin = await tx.organisation.count({ where: { id: organisationId, suspendedAt: null, members: { some: { userId: actor.userId, role: { in: [...ADMINS] } } } } });
    if (admin === 0) return { kind: "absent" };
    await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = ${organisationId}::uuid FOR UPDATE`;
  } else if ((await tx.freelanceProfile.count({ where: { userId: actor.userId } })) === 0) {
    return { kind: "no_profile" };
  }
  // La boîte invitée est verrouillée elle aussi : deux expéditeurs à la fois ne dépassent pas son plafond ensemble.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation:${mailbox}`}, 0))`;
  // Une invitation refusée compte comme une invitation en attente : inviter de nouveau ne doit pas trahir le refus.
  const duplicate = await tx.invitation.count({
    where: { kind: target.kind, mailbox, status: { in: ["pending", "declined"] }, expiresAt: { gt: now }, ...(organisationId === null ? { senderUserId: actor.userId } : { organisationId }) },
  });
  if (duplicate > 0) return { kind: "already_invited" };
  if (await overSenderLimit(tx, actor.userId, organisationId, now)) return { kind: "limit" };
  // Boîte saturée : la même réponse qu'un envoi, et rien n'est écrit. Un refus dirait à l'expéditeur que d'autres ont
  // invité cette adresse ; l'adresse, elle, ne reçoit rien de plus.
  if (await overMailboxLimit(tx, mailbox, now)) return { kind: "invited", invitationId: link.id };
  await tx.invitation.create({
    data: {
      id: link.id,
      kind: target.kind,
      senderUserId: actor.userId,
      organisationId,
      email: input.email,
      mailbox,
      message: input.message,
      lang,
      tokenHash: confirmationTokenHash(link.token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS),
      emailSendAfter: now,
      createdAt: now,
    },
    select: { id: true },
  });
  return { kind: "invited", invitationId: link.id };
};

export const invitations = (db: Db): Invitations => ({
  async invite(actor, target, raw, link, lang, now) {
    const parsed = InvitationInputSchema.safeParse(raw);
    if (!parsed.success || !Uuid.safeParse(link.id).success || !TOKEN_FORMAT.test(link.token)) return { kind: "invalid" };
    if (target.kind === "freelance" && !Uuid.safeParse(target.organisationId).success) return { kind: "absent" };
    const problem = invitationMessageProblem(parsed.data.message);
    if (problem !== null) return { kind: "message", problem };
    try {
      return await db.$transaction(async (tx) => createInvitation(tx, actor, target, parsed.data, link, lang, now));
    } catch (error) {
      // Identifiant ou jeton déjà pris : rien n'est créé, l'appelant en tire un autre.
      if (isUniqueViolation(error)) return { kind: "invalid" };
      throw error;
    }
  },

  async listForOrganisation(actor, organisationId, now) {
    if (!Uuid.safeParse(organisationId).success) return null;
    const membership = await db.membership.findUnique({ where: { organisationId_userId: { organisationId, userId: actor.userId } }, select: { role: true } });
    if (membership === null) return null;
    const admin = (ADMINS as readonly string[]).includes(membership.role);
    const rows = await db.invitation.findMany({ where: { organisationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: LIST_LIMIT, select: SENT_SELECT });
    return rows.map((row) => sentView(row, admin || row.senderUserId === actor.userId, now));
  },

  async listMine(actor, now) {
    const rows = await db.invitation.findMany({ where: { senderUserId: actor.userId, kind: "client" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: LIST_LIMIT, select: SENT_SELECT });
    return rows.map((row) => sentView(row, true, now));
  },

  async revoke(actor, invitationId, now) {
    if (!Uuid.safeParse(invitationId).success) return "absent";
    // Une invitation refusée se révoque aussi : l'expéditeur ne doit pas apprendre le refus par un échec.
    const { count } = await db.invitation.updateMany({ where: { id: invitationId, status: { in: ["pending", "declined"] }, ...managedBy(actor.userId) }, data: { status: "revoked", decidedAt: now } });
    if (count === 1) return "done";
    return (await db.invitation.count({ where: { id: invitationId, ...managedBy(actor.userId) } })) === 1 ? "closed" : "absent";
  },

  async remind(actor, invitationId, now) {
    if (!Uuid.safeParse(invitationId).success) return "absent";
    const row = await db.invitation.findFirst({ where: { id: invitationId, ...managedBy(actor.userId) }, select: { status: true, expiresAt: true, createdAt: true, remindedAt: true } });
    if (row === null) return "absent";
    if (invitationState(row, now) !== "pending") return "closed";
    if (row.remindedAt !== null) return "already";
    if (now.getTime() - row.createdAt.getTime() < REMINDER_DELAY_DAYS * DAY_MS) return "too_soon";
    const open = { id: invitationId, remindedAt: null, expiresAt: { gt: now } };
    // Refusée, elle est « relancée » sans qu'aucun e-mail ne parte : la personne a déjà répondu, l'expéditeur ne le sait pas.
    const { count } = await db.invitation.updateMany({ where: { ...open, status: "pending" }, data: { remindedAt: now, emailSentAt: null, emailSendAfter: now, emailAttempts: 0 } });
    if (count === 1) return "done";
    const declined = await db.invitation.updateMany({ where: { ...open, status: "declined" }, data: { remindedAt: now } });
    return declined.count === 1 ? "done" : "already";
  },
});
