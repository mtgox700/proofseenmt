import { z } from "zod";
import { assertOperator, notifyAccount, organisationAdmins, ReasonSchema, recordAction, type Operator, type OperatorResult } from "./back-office";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";

/*
 * Relecture des premiers contacts (C19). Le premier message d'un fil ouvert par une entreprise récente (compte ou
 * entreprise de moins de `newAccountDays` jours) est signalé aux opérateurs : c'est là que se tentent le démarchage,
 * l'arnaque à la mission et la collecte de coordonnées.
 *
 * Le signalement ne retient rien : le message est livré, la notification part. `mode` est l'interrupteur prévu pour
 * passer plus tard à « retenu jusqu'à relecture » ; seul « flag » est en service aujourd'hui, et le changer demandera
 * de retenir aussi la notification et l'affichage du fil (C15).
 *
 * L'opérateur lit le premier message (c'est l'objet même de la relecture), puis le laisse passer ou ferme le fil avec un
 * motif, que l'entreprise reçoit.
 */

export type FirstContactMode = "flag" | "hold";

export const FIRST_CONTACT_REVIEW: { readonly mode: FirstContactMode; readonly newAccountDays: number } = { mode: "flag", newAccountDays: 7 };

const DAY_MS = 86_400_000;

/** Vrai si l'entreprise ou la personne qui écrit existe depuis moins de `newAccountDays` jours. */
export const isRecentSender = (organisationCreatedAt: Date, senderCreatedAt: Date | null, now: Date): boolean => {
  const since = now.getTime() - FIRST_CONTACT_REVIEW.newAccountDays * DAY_MS;
  return organisationCreatedAt.getTime() > since || (senderCreatedAt !== null && senderCreatedAt.getTime() > since);
};

/** Signale le fil s'il vient d'une entreprise récente ; appelé dans la transaction qui crée le fil et son premier message. */
export const flagFirstContact = async (tx: Prisma.TransactionClient, conversationId: string, senderUserId: string, now: Date): Promise<boolean> => {
  const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { direct: true, organisation: { select: { createdAt: true } } } });
  if (conversation === null || !conversation.direct) return false;
  const sender = await tx.user.findUnique({ where: { id: senderUserId }, select: { createdAt: true } });
  if (!isRecentSender(conversation.organisation.createdAt, sender?.createdAt ?? null, now)) return false;
  await tx.contactReview.createMany({ data: [{ conversationId, flaggedAt: now }], skipDuplicates: true });
  return true;
};

export interface PendingContact {
  readonly conversationId: string;
  readonly flaggedAt: Date;
  readonly organisation: { readonly id: string; readonly name: string; readonly createdAt: Date };
  readonly profileReference: string;
  readonly status: string;
  /** Le premier message du fil : ce que l'opérateur relit. */
  readonly firstMessage: { readonly body: string; readonly containsContact: boolean; readonly createdAt: Date } | null;
}

export interface ContactReviews {
  pending(limit?: number): Promise<readonly PendingContact[]>;
  pendingCount(): Promise<number>;
  /** Rien à redire : le fil sort de la file. */
  clear(conversationId: string, now: Date): Promise<OperatorResult>;
  /** Le fil est fermé, l'entreprise prévenue avec le motif. */
  close(conversationId: string, reason: string, now: Date): Promise<OperatorResult>;
}

const Uuid = z.uuid();
const MAX_PENDING = 100;

export const contactReviews = (db: Db, operator: Operator): ContactReviews => {
  assertOperator(operator);

  const decide = async (conversationId: string, outcome: "ok" | "closed", reason: string | null, now: Date): Promise<OperatorResult> => {
    if (!Uuid.safeParse(conversationId).success) return "absent";
    return db.$transaction(async (tx): Promise<OperatorResult> => {
      const review = await tx.contactReview.findUnique({ where: { conversationId }, select: { conversation: { select: { organisationId: true, status: true } } } });
      if (review === null) return "absent";
      const { count } = await tx.contactReview.updateMany({ where: { conversationId, reviewedAt: null }, data: { reviewedAt: now, outcome } });
      if (count === 0) return "unchanged";
      if (outcome === "closed") {
        // Conditionnel : si le freelance décide au même instant, le fil n'est fermé que s'il est encore ouvert. Seule
        // cette relecture ferme un fil en attente, et elle le dit à la base pour sa transaction (revue vague 3, L15).
        await tx.$executeRaw`SELECT set_config('proofseen.operator_review', 'on', true)`;
        const pending = await tx.conversation.updateMany({ where: { id: conversationId, status: "pending" }, data: { status: "closed", decidedAt: now } });
        const accepted = pending.count === 1 ? pending : await tx.conversation.updateMany({ where: { id: conversationId, status: "accepted" }, data: { status: "closed" } });
        if (accepted.count === 1) await notifyAccount(tx, await organisationAdmins(tx, review.conversation.organisationId), "contact_closed", reason);
      }
      await recordAction(tx, operator, { action: outcome === "ok" ? "contact_cleared" : "contact_closed", targetType: "conversation", targetId: conversationId, reason }, now);
      return "done";
    });
  };

  return {
    async pending(limit = MAX_PENDING) {
      const rows = await db.contactReview.findMany({
        where: { reviewedAt: null },
        orderBy: [{ flaggedAt: "asc" }, { id: "asc" }],
        take: Math.min(Math.max(limit, 1), MAX_PENDING),
        select: {
          conversationId: true,
          flaggedAt: true,
          conversation: {
            select: {
              status: true,
              organisation: { select: { id: true, name: true, createdAt: true } },
              profile: { select: { reference: true } },
              messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1, select: { body: true, containsContact: true, createdAt: true } },
            },
          },
        },
      });
      return rows.map((r) => ({
        conversationId: r.conversationId,
        flaggedAt: r.flaggedAt,
        organisation: r.conversation.organisation,
        profileReference: r.conversation.profile.reference,
        status: r.conversation.status,
        firstMessage: r.conversation.messages[0] ?? null,
      }));
    },

    pendingCount: () => db.contactReview.count({ where: { reviewedAt: null } }),

    clear: (conversationId, now) => decide(conversationId, "ok", null, now),

    close: (conversationId, rawReason, now) => decide(conversationId, "closed", ReasonSchema.parse(rawReason), now),
  };
};
