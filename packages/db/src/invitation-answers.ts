import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { InvitationKind } from "./generated/enums";
import { maskEmail, normaliseEmails } from "./invitation-input";
import { organisationLabel, senderLabel } from "./invitations";
import type { Actor } from "./messaging";
import { confirmationTokenHash, TOKEN_FORMAT } from "./mission-confirmation-input";
import { notifications } from "./notifications";

/*
 * La réponse de la personne invitée (C23). Un lien seul ne suffit pas : accepter ou refuser exige d'être connecté avec
 * un compte dont l'une des adresses **vérifiées** est l'adresse invitée. Sans cette règle, un lien transféré ou
 * intercepté ferait entrer n'importe qui dans le vivier privé d'une entreprise.
 *
 * Une réponse est unique : la décision est une instruction conditionnelle sur une invitation encore en attente et non
 * échue, et la base refuse ensuite de la défaire. Le vivier rejoint, ou l'entreprise rattachée, prévient l'expéditeur.
 */

const Uuid = z.uuid();
const RECEIVED_LIMIT = 50;

export interface InvitationView {
  readonly id: string;
  readonly kind: InvitationKind;
  /**
   * Qui invite : le nom de l'entreprise, ou le nom affiché du freelance (sa référence s'il contient une coordonnée) ;
   * `null` pour une entreprise dont le nom porte un lien ou une coordonnée, présentée de façon neutre.
   */
  readonly inviter: string | null;
  readonly message: string | null;
  readonly expiresAt: Date;
  /** L'adresse invitée, à demi masquée : pour savoir avec quel compte se connecter. */
  readonly maskedEmail: string;
}

export type LookupResult = { readonly kind: "open"; readonly view: InvitationView } | { readonly kind: "invalid" } | { readonly kind: "expired" } | { readonly kind: "closed" };

export type AnswerResult =
  | { readonly kind: "accepted"; readonly invitationKind: InvitationKind; readonly linked: boolean }
  | { readonly kind: "declined" }
  | { readonly kind: "invalid" }
  | { readonly kind: "expired" }
  /** Déjà acceptée, refusée ou révoquée : un lien ne sert qu'une fois. */
  | { readonly kind: "closed" }
  /** Aucune adresse vérifiée du compte n'est l'adresse invitée. */
  | { readonly kind: "email_mismatch" }
  /** L'expéditeur lui-même, un membre de l'entreprise qui invite, ou une entreprise dont l'expéditeur est membre. */
  | { readonly kind: "self" };

export interface AnswerRequest {
  readonly id: string;
  /** Le jeton du lien de l'e-mail ; `null` depuis l'espace connecté, où seule compte l'adresse vérifiée. */
  readonly token: string | null;
  readonly decision: "accept" | "decline";
  /** Le type que la page a montré, et pour lequel elle a vérifié le côté du compte : une autre invitation est refusée. */
  readonly kind: InvitationKind;
  /** `client` : l'entreprise au nom de laquelle la personne accepte, si elle en a déjà une. */
  readonly organisationId: string | null;
}

export interface InvitationAnswers {
  /** Ce que montre la page du lien. Ne décide rien : seul le formulaire de cette page le fait. */
  lookup(id: string, token: string, now: Date): Promise<LookupResult>;
  /** Les invitations en attente adressées à l'une des adresses vérifiées du compte. */
  listReceived(actor: Actor, verifiedEmails: readonly string[], now: Date): Promise<readonly InvitationView[]>;
  answer(actor: Actor, verifiedEmails: readonly string[], request: AnswerRequest, now: Date): Promise<AnswerResult>;
  /**
   * Rattache à une entreprise que la personne vient de créer ou de rejoindre les invitations d'entreprise cliente
   * qu'elle avait acceptées sans entreprise. Rend le nombre d'invitations rattachées.
   */
  linkClient(userId: string, organisationId: string, now: Date): Promise<number>;
}

const VIEW_SELECT = {
  id: true,
  kind: true,
  email: true,
  message: true,
  expiresAt: true,
  status: true,
  senderUserId: true,
  organisationId: true,
  organisation: { select: { name: true, suspendedAt: true } },
  sender: { select: { displayName: true, suspendedAt: true, freelanceProfile: { select: { reference: true } } } },
} as const;

type ViewRow = Prisma.InvitationGetPayload<{ select: typeof VIEW_SELECT }>;

const viewOf = (row: ViewRow): InvitationView => ({
  id: row.id,
  kind: row.kind,
  inviter: row.organisation === null ? senderLabel(row.sender.displayName, row.sender.freelanceProfile?.reference ?? null) : organisationLabel(row.organisation.name),
  message: row.message,
  expiresAt: row.expiresAt,
  maskedEmail: maskEmail(row.email),
});

/** Un expéditeur ou une entreprise masqués par un opérateur : leurs invitations ne mènent plus à rien. */
const silenced = (row: ViewRow): boolean => row.sender.suspendedAt !== null || (row.organisation?.suspendedAt ?? null) !== null;

const stateOf = (row: ViewRow, now: Date): "open" | "expired" | "closed" => {
  if (row.status !== "pending" || silenced(row)) return "closed";
  return row.expiresAt.getTime() <= now.getTime() ? "expired" : "open";
};

const notifySender = async (db: Db, tx: Prisma.TransactionClient, senderUserId: string, invitationId: string, status: "pool" | "client"): Promise<void> => {
  await notifications(db).enqueue(tx, [senderUserId], "invitation_accepted", { invitationId, status });
};

/** L'entreprise cliente à rattacher : une dont la personne est membre, et dont l'expéditeur ne l'est pas. */
const clientOrganisation = async (tx: Prisma.TransactionClient, userId: string, senderUserId: string, organisationId: string | null): Promise<string | "self" | null> => {
  if (organisationId === null || !Uuid.safeParse(organisationId).success) return null;
  const members = await tx.membership.findMany({ where: { organisationId, userId: { in: [userId, senderUserId] } }, select: { userId: true } });
  if (!members.some((m) => m.userId === userId)) return null;
  return members.some((m) => m.userId === senderUserId) ? "self" : organisationId;
};

const accept = async (db: Db, tx: Prisma.TransactionClient, actor: Actor, row: ViewRow, organisationId: string | null, now: Date): Promise<AnswerResult> => {
  const open = { id: row.id, status: "pending" as const, expiresAt: { gt: now } };
  if (row.kind === "freelance" && row.organisationId !== null) {
    if ((await tx.membership.count({ where: { organisationId: row.organisationId, userId: actor.userId } })) > 0) return { kind: "self" };
    const { count } = await tx.invitation.updateMany({ where: open, data: { status: "accepted", decidedAt: now, acceptedByUserId: actor.userId } });
    if (count === 0) return { kind: "closed" };
    await tx.talentPoolEntry.upsert({
      where: { organisationId_userId: { organisationId: row.organisationId, userId: actor.userId } },
      create: { organisationId: row.organisationId, userId: actor.userId, joinedAt: now },
      update: {},
    });
    await notifySender(db, tx, row.senderUserId, row.id, "pool");
    return { kind: "accepted", invitationKind: "freelance", linked: true };
  }
  const client = await clientOrganisation(tx, actor.userId, row.senderUserId, organisationId);
  if (client === "self") return { kind: "self" };
  const link = client === null ? {} : { clientOrganisationId: client, linkedAt: now };
  const { count } = await tx.invitation.updateMany({ where: open, data: { status: "accepted", decidedAt: now, acceptedByUserId: actor.userId, ...link } });
  if (count === 0) return { kind: "closed" };
  if (client !== null) await notifySender(db, tx, row.senderUserId, row.id, "client");
  return { kind: "accepted", invitationKind: "client", linked: client !== null };
};

export const invitationAnswers = (db: Db): InvitationAnswers => ({
  async lookup(id, token, now) {
    if (!Uuid.safeParse(id).success || !TOKEN_FORMAT.test(token)) return { kind: "invalid" };
    const row = await db.invitation.findFirst({ where: { id, tokenHash: confirmationTokenHash(token) }, select: VIEW_SELECT });
    if (row === null) return { kind: "invalid" };
    const state = stateOf(row, now);
    return state === "open" ? { kind: "open", view: viewOf(row) } : { kind: state };
  },

  async listReceived(actor, verifiedEmails, now) {
    const emails = normaliseEmails(verifiedEmails);
    if (emails.length === 0) return [];
    const rows = await db.invitation.findMany({
      where: {
        email: { in: [...emails] },
        status: "pending",
        expiresAt: { gt: now },
        senderUserId: { not: actor.userId },
        sender: { suspendedAt: null },
        OR: [{ organisationId: null }, { organisation: { suspendedAt: null } }],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RECEIVED_LIMIT,
      select: VIEW_SELECT,
    });
    return rows.map(viewOf);
  },

  async answer(actor, verifiedEmails, request, now) {
    if (!Uuid.safeParse(request.id).success) return { kind: "invalid" };
    if (request.token !== null && !TOKEN_FORMAT.test(request.token)) return { kind: "invalid" };
    const emails = normaliseEmails(verifiedEmails);
    return db.$transaction(async (tx): Promise<AnswerResult> => {
      const row = await tx.invitation.findFirst({
        where: { id: request.id, ...(request.token === null ? {} : { tokenHash: confirmationTokenHash(request.token) }) },
        select: VIEW_SELECT,
      });
      if (row === null || row.kind !== request.kind) return { kind: "invalid" };
      const state = stateOf(row, now);
      if (state !== "open") return { kind: state };
      if (!emails.includes(row.email)) return { kind: "email_mismatch" };
      if (row.senderUserId === actor.userId) return { kind: "self" };
      if (request.decision === "decline") {
        const { count } = await tx.invitation.updateMany({ where: { id: row.id, status: "pending", expiresAt: { gt: now } }, data: { status: "declined", decidedAt: now, acceptedByUserId: actor.userId } });
        return count === 1 ? { kind: "declined" } : { kind: "closed" };
      }
      return accept(db, tx, actor, row, request.organisationId, now);
    });
  },

  async linkClient(userId, organisationId, now) {
    if (!Uuid.safeParse(userId).success || !Uuid.safeParse(organisationId).success) return 0;
    return db.$transaction(async (tx) => {
      const rows = await tx.invitation.findMany({
        where: { kind: "client", status: "accepted", acceptedByUserId: userId, clientOrganisationId: null },
        select: { id: true, senderUserId: true },
        take: 20,
      });
      let linked = 0;
      for (const row of rows) {
        if ((await clientOrganisation(tx, userId, row.senderUserId, organisationId)) !== organisationId) continue;
        const { count } = await tx.invitation.updateMany({ where: { id: row.id, clientOrganisationId: null }, data: { clientOrganisationId: organisationId, linkedAt: now } });
        if (count === 0) continue;
        await notifySender(db, tx, row.senderUserId, row.id, "client");
        linked += 1;
      }
      return linked;
    });
  },
});
