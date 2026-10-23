import { z } from "zod";
import type { Db } from "./client";
import type { ConversationStatus, PaymentStatus } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Les dates du fil de l'affaire (échange, signatures, validations, versement, mission vérifiée), telles que la base les
 * a enregistrées : jamais une date déduite d'une autre. Deux faits n'ont pas de date en base et n'en reçoivent pas ici :
 * l'acceptation d'un devis (le devis ne garde que son statut) et la mise sous séquestre (le paiement ne garde que sa
 * création, qui est l'ouverture du paiement, pas l'arrivée des fonds). Pour les parties seulement, comme le contrat.
 */

const Uuid = z.uuid();

export interface ConversationDates {
  readonly status: ConversationStatus;
  /** Le contact accepté (ou décliné) par le freelance ; posé d'emblée pour un fil né d'une candidature. */
  readonly decidedAt: Date | null;
}

export interface ContractDates {
  /** `null` : le devis d'origine a disparu, et avec lui le lien vers l'échange. */
  readonly conversation: ConversationDates | null;
  /** Les validations qui comptent (administrateurs encore en poste, comme la base), de la plus ancienne à la plus récente. */
  readonly approvedAt: readonly Date[];
  /** Le dernier paiement : son statut et, une fois versé au freelance, la date du versement. */
  readonly payment: { readonly status: PaymentStatus; readonly releasedAt: Date | null } | null;
  /** La mission vérifiée née du versement (« payée sur Proofseen »), si elle existe. */
  readonly verifiedAt: Date | null;
}

const party = (userId: string) => ({ OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }] });

export const dealDates = (db: Db) => ({
  /** L'état et la date de décision d'un échange, pour ses deux côtés ; `null` pour tout autre acteur. */
  async conversation(actor: Actor, conversationId: string): Promise<ConversationDates | null> {
    if (!Uuid.safeParse(conversationId).success) return null;
    return db.conversation.findFirst({ where: { id: conversationId, ...party(actor.userId) }, select: { status: true, decidedAt: true } });
  },

  /** Les dates d'un contrat, pour ses parties ; `null` pour tout autre acteur. */
  async contract(actor: Actor, contractId: string): Promise<ContractDates | null> {
    if (!Uuid.safeParse(contractId).success) return null;
    const row = await db.contract.findFirst({
      where: { id: contractId, ...party(actor.userId) },
      select: {
        quote: { select: { conversation: { select: { status: true, decidedAt: true } } } },
        organisation: { select: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } } },
        approvals: { orderBy: { approvedAt: "asc" }, select: { userId: true, approvedAt: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, releasedAt: true } },
        verifiedMission: { select: { verifiedAt: true } },
      },
    });
    if (row === null) return null;
    const admins = new Set(row.organisation?.members.map((m) => m.userId) ?? []);
    return {
      conversation: row.quote?.conversation ?? null,
      approvedAt: row.approvals.filter((a) => a.userId !== null && admins.has(a.userId)).map((a) => a.approvedAt),
      payment: row.payments[0] ?? null,
      verifiedAt: row.verifiedMission?.verifiedAt ?? null,
    };
  },
});

export type DealDates = ReturnType<typeof dealDates>;
