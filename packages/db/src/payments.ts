import { z } from "zod";
import type { LegalSnapshot } from "./billing";
import { LegalSnapshotSchema } from "./billing";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { PaymentStatus } from "./generated/enums";
import { invoices, vatOf } from "./invoices";
import type { Actor } from "./messaging";

/*
 * Paiement sous séquestre (Stripe Connect, « charges et virements séparés ») :
 *   1. le contrat signé, l'entreprise paie le montant TTC de la mission ; les fonds arrivent chez Proofseen ;
 *   2. Stripe confirme le paiement par un événement signé : le paiement est « bloqué » (held) ;
 *   3. l'entreprise valide la prestation : Proofseen vire au freelance le montant moins sa commission TTC, et émet les
 *      deux factures (mission au nom du freelance, commission au freelance) ;
 *   4. remboursement ou litige tant que les fonds sont bloqués.
 *
 * Le prestataire est injecté (`PaymentGateway`) : ce module ne connaît pas Stripe. Chaque appel porte une clé
 * d'idempotence : si un virement a réussi chez le prestataire mais que l'écriture ici a échoué, le relancer rend le
 * même virement au lieu d'en créer un second.
 *
 * Les événements du prestataire arrivent en double et dans le désordre : chacun est enregistré avant d'être appliqué
 * (une seule fois), et chaque transition ne s'applique que depuis le statut qu'elle attend.
 *
 * Le taux de commission est une décision du founder : il est reçu en paramètre, jamais fixé ici.
 */

export interface PaymentGateway {
  /** Crée l'intention de paiement ; rend son identifiant et le secret que le formulaire de paiement utilise. */
  createIntent(input: { amountCents: number; currency: string; contractId: string; idempotencyKey: string }): Promise<{ intentId: string; clientSecret: string }>;
  /** Vire au compte du freelance. */
  transfer(input: { amountCents: number; currency: string; destination: string; contractId: string; idempotencyKey: string }): Promise<{ transferId: string }>;
  /** Rembourse tout ou partie d'un paiement. */
  refund(input: { intentId: string; amountCents: number; idempotencyKey: string }): Promise<{ refundId: string }>;
}

/** Événement du prestataire, normalisé. */
export interface PaymentEvent {
  readonly id: string;
  readonly type: "payment.succeeded" | "payment.failed" | "payment.canceled" | "dispute.opened" | "dispute.won" | "dispute.lost" | "refund.succeeded";
  readonly intentId: string;
}

export const MAX_COMMISSION_BP = 5000;

export type OpenPaymentResult =
  | { readonly kind: "opened"; readonly paymentId: string; readonly clientSecret: string; readonly amountCents: number; readonly commissionCents: number }
  /** Un paiement est déjà en cours, bloqué ou versé pour ce contrat. */
  | { readonly kind: "already_paid" }
  | { readonly kind: "absent" };

export type ReleaseResult =
  | { readonly kind: "released"; readonly transferId: string; readonly missionInvoice: string; readonly commissionInvoice: string }
  /** Le freelance n'a pas encore de compte de versement : les fonds restent bloqués, rien n'est perdu. */
  | { readonly kind: "account_missing" }
  | { readonly kind: "not_releasable" };

export type EventResult = "applied" | "duplicate" | "ignored";

export interface Payments {
  open(actor: Actor, contractId: string, gateway: PaymentGateway, commissionBp: number): Promise<OpenPaymentResult>;
  applyEvent(event: PaymentEvent): Promise<EventResult>;
  /** Libère les fonds d'un contrat terminé. Sans acteur : appelé par le système une fois la prestation validée. */
  release(contractId: string, gateway: PaymentGateway, proofseen: LegalSnapshot, now: Date): Promise<ReleaseResult>;
  /** Rembourse intégralement un paiement encore bloqué (décision d'arbitrage, pas d'une partie). */
  refundHeld(contractId: string, gateway: PaymentGateway): Promise<boolean>;
  /** Le paiement d'un contrat, pour ses parties. Le détail de la commission n'est montré qu'au freelance. */
  find(actor: Actor, contractId: string): Promise<{ readonly status: PaymentStatus; readonly amountCents: number; readonly commissionCents: number | null; readonly currency: string } | null>;
}

const Uuid = z.uuid();
/** Statuts qui interdisent d'ouvrir un nouveau paiement : quelque chose est déjà en cours ou acquis. */
const LIVE: readonly PaymentStatus[] = ["pending", "held", "released", "disputed"];

const TRANSITIONS: Readonly<Record<PaymentEvent["type"], { from: readonly PaymentStatus[]; to: PaymentStatus; refundAll?: boolean }>> = {
  "payment.succeeded": { from: ["pending"], to: "held" },
  "payment.failed": { from: ["pending"], to: "failed" },
  "payment.canceled": { from: ["pending"], to: "canceled" },
  "dispute.opened": { from: ["held"], to: "disputed" },
  "dispute.won": { from: ["disputed"], to: "held" },
  "dispute.lost": { from: ["disputed"], to: "refunded", refundAll: true },
  "refund.succeeded": { from: ["held", "disputed"], to: "refunded", refundAll: true },
};

export const payments = (db: Db): Payments => ({
  async open(actor, contractId, gateway, commissionBp) {
    if (!Number.isInteger(commissionBp) || commissionBp < 1 || commissionBp > MAX_COMMISSION_BP) throw new Error("taux de commission non configuré ou hors bornes");
    if (!Uuid.safeParse(contractId).success) return { kind: "absent" };
    const contract = await db.contract.findFirst({
      where: { id: contractId, status: "active", organisation: { members: { some: { userId: actor.userId } } } },
      select: { totalCents: true, currency: true, sellerSnapshot: true, _count: { select: { payments: true } } },
    });
    if (contract === null) return { kind: "absent" };
    if ((await db.payment.count({ where: { contractId, status: { in: [...LIVE] } } })) > 0) return { kind: "already_paid" };

    const seller = LegalSnapshotSchema.parse(contract.sellerSnapshot);
    // L'entreprise paie le TTC de la facture de mission ; la commission se calcule sur le hors-taxe.
    const amountCents = contract.totalCents + vatOf(contract.totalCents, seller.vatRateBp ?? 0);
    const commissionCents = Math.round((contract.totalCents * commissionBp) / 10_000);
    const intent = await gateway.createIntent({
      amountCents,
      currency: contract.currency,
      contractId,
      idempotencyKey: `pay-${contractId}-${contract._count.payments + 1}`,
    });
    try {
      const payment = await db.payment.create({
        data: { contractId, amountCents, commissionCents, currency: contract.currency, stripeIntentId: intent.intentId },
        select: { id: true },
      });
      return { kind: "opened", paymentId: payment.id, clientSecret: intent.clientSecret, amountCents, commissionCents };
    } catch (error) {
      // Deux ouvertures simultanées : la même clé d'idempotence a rendu la même intention, déjà enregistrée.
      if (isUniqueViolation(error)) return { kind: "already_paid" };
      throw error;
    }
  },

  async applyEvent(event) {
    const transition = TRANSITIONS[event.type];
    return db.$transaction(async (tx): Promise<EventResult> => {
      try {
        await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
      } catch (error) {
        if (isUniqueViolation(error)) return "duplicate";
        throw error;
      }
      const payment = await tx.payment.findUnique({ where: { stripeIntentId: event.intentId }, select: { id: true, amountCents: true } });
      if (payment === null) return "ignored";
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: [...transition.from] } },
        data: { status: transition.to, ...(transition.refundAll === true ? { refundedCents: payment.amountCents } : {}) },
      });
      return count === 1 ? "applied" : "ignored";
    });
  },

  async release(contractId, gateway, proofseen, now) {
    if (!Uuid.safeParse(contractId).success) return { kind: "not_releasable" };
    const payment = await db.payment.findFirst({
      where: { contractId, status: { in: ["held", "released"] }, contract: { status: "completed" } },
      select: {
        id: true,
        status: true,
        transferId: true,
        amountCents: true,
        commissionCents: true,
        currency: true,
        contract: { select: { profile: { select: { billing: { select: { stripeAccountId: true } } } } } },
      },
    });
    if (payment === null) return { kind: "not_releasable" };
    let transferId = payment.transferId;
    if (payment.status === "held") {
      const destination = payment.contract.profile?.billing?.stripeAccountId ?? null;
      if (destination === null) return { kind: "account_missing" };
      const commissionWithVat = payment.commissionCents + vatOf(payment.commissionCents, 2000);
      const transfer = await gateway.transfer({
        amountCents: payment.amountCents - commissionWithVat,
        currency: payment.currency,
        destination,
        contractId,
        idempotencyKey: `release-${payment.id}`,
      });
      transferId = transfer.transferId;
      await db.payment.updateMany({ where: { id: payment.id, status: "held" }, data: { status: "released", transferId, releasedAt: now } });
    }
    // Les factures s'émettent une fois les fonds libérés ; relancer la libération les rend sans en émettre d'autres.
    const mission = await invoices(db).issueMission(contractId, now);
    const commission = await invoices(db).issueCommission(contractId, payment.commissionCents, proofseen, now);
    if (mission.kind === "not_invoiceable" || commission.kind === "not_invoiceable" || transferId === null) return { kind: "not_releasable" };
    return { kind: "released", transferId, missionInvoice: mission.invoice.number, commissionInvoice: commission.invoice.number };
  },

  async refundHeld(contractId, gateway) {
    if (!Uuid.safeParse(contractId).success) return false;
    const payment = await db.payment.findFirst({ where: { contractId, status: "held" }, select: { id: true, stripeIntentId: true, amountCents: true } });
    if (payment === null) return false;
    await gateway.refund({ intentId: payment.stripeIntentId, amountCents: payment.amountCents, idempotencyKey: `refund-${payment.id}` });
    const { count } = await db.payment.updateMany({ where: { id: payment.id, status: "held" }, data: { status: "refunded", refundedCents: payment.amountCents } });
    return count === 1;
  },

  async find(actor, contractId) {
    if (!Uuid.safeParse(contractId).success) return null;
    const contract = await db.contract.findFirst({
      where: { id: contractId, OR: [{ profile: { userId: actor.userId } }, { organisation: { members: { some: { userId: actor.userId } } } }] },
      select: { profile: { select: { userId: true } } },
    });
    if (contract === null) return null;
    const payment = await db.payment.findFirst({ where: { contractId }, orderBy: { createdAt: "desc" }, select: { status: true, amountCents: true, commissionCents: true, currency: true } });
    if (payment === null) return null;
    const isFreelance = contract.profile?.userId === actor.userId;
    return { ...payment, commissionCents: isFreelance ? payment.commissionCents : null };
  },
});
