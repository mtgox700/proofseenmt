import { z } from "zod";
import type { LegalSnapshot } from "./billing";
import { LegalSnapshotSchema } from "./billing";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { PaymentStatus } from "./generated/enums";
import { invoices, vatOf } from "./invoices";
import type { Actor } from "./messaging";
import { chargeToRecord } from "./payment-charge";
import { establishSource } from "./payment-source";
import { recordPaidMission } from "./verified-missions";

/*
 * Paiement sous séquestre (Stripe Connect, « charges et virements séparés ») :
 *   1. le contrat signé, un administrateur de l'entreprise paie le montant TTC ; les fonds arrivent chez Proofseen ;
 *   2. Stripe confirme par un événement signé : le paiement est bloqué (held) ;
 *   3. l'entreprise valide la prestation (impossible sans fonds bloqués) ; Proofseen vire au freelance le montant moins
 *      sa commission TTC, puis émet les deux factures ;
 *   4. remboursement tant que les fonds sont bloqués.
 *
 * Trois règles tiennent l'argent :
 *  - **réserver avant d'appeler** : un versement ou un remboursement commence par faire passer la ligne de « bloqué »
 *    à « en cours » en une instruction. Un seul des deux peut gagner ; l'autre ne voit plus rien à prendre. Si l'appel
 *    au prestataire échoue, la ligne revient à « bloqué » ;
 *  - **chercher avant de créer** : avant un virement, on demande au prestataire s'il en existe déjà un pour ce contrat
 *    — une clé d'idempotence expire au bout de 24 h, une reprise tardive ne doit pas virer deux fois ;
 *  - **les faits avant les statuts** : un litige ou un remboursement est enregistré quel que soit le statut du
 *    paiement, même s'il arrive dans le désordre. Il bloque le versement s'il arrive avant, et marque le paiement « à
 *    revoir » s'il arrive après : rien n'est ignoré en silence.
 *
 * Le taux de commission est une décision du founder : il est écrit sur le contrat à sa création (voir contracts.ts) et
 * figé. Ce fichier le lit sur le contrat, jamais dans l'environnement du moment, et ne le fixe pas.
 *
 * Chaque virement porte la charge du paiement qui le finance (`source_transaction`, relevée au paiement réussi) :
 * sans elle, Stripe prendrait l'argent sur le solde commun de la plateforme, donc celui d'autres clients. Une charge
 * inconnue est relue chez le prestataire (lecture seule) et vérifiée ; si elle ne peut être établie, le virement est
 * refusé (SourceChargeMissingError), avant toute réservation et tout appel de virement. Voir payment-source.ts.
 */

/** Ce que le prestataire dit d'une charge (identifiants normalisés, montants en centimes, devise en majuscules). */
export interface ChargeFacts {
  readonly chargeId: string;
  /** L'intention de paiement que cette charge a encaissée. */
  readonly intentId: string | null;
  readonly currency: string;
  readonly amountCents: number;
  readonly refundedCents: number;
  readonly paid: boolean;
  /** Quand la charge a été créée chez le prestataire ; nul s'il ne le dit pas. */
  readonly createdAt: Date | null;
}

/** Ce que le prestataire dit d'une intention : son statut et sa dernière charge (nulle s'il n'y en a pas, ou illisible). */
export interface IntentFacts {
  readonly intentId: string;
  readonly status: string;
  readonly charge: ChargeFacts | null;
}

export interface PaymentGateway {
  /** Crée l'intention de paiement ; rend son identifiant et le secret que le formulaire de paiement utilise. */
  createIntent(input: { amountCents: number; currency: string; contractId: string; idempotencyKey: string }): Promise<{ intentId: string; clientSecret: string }>;
  /** Le secret d'une intention existante : reprendre un paiement abandonné plutôt que d'en ouvrir un second. */
  intentSecret(intentId: string): Promise<string>;
  /**
   * Vire au compte du freelance, financé par la charge `sourceTransaction` du paiement du contrat. Refuse (erreur
   * SourceChargeMissingError) quand la charge n'est pas une charge valide : jamais un virement sans source.
   */
  transfer(input: { amountCents: number; currency: string; destination: string; contractId: string; idempotencyKey: string; sourceTransaction: string }): Promise<{ transferId: string }>;
  /** Le virement déjà fait pour ce contrat, s'il existe. */
  findTransfer(contractId: string): Promise<string | null>;
  /** Rembourse tout ou partie d'un paiement. */
  refund(input: { intentId: string; amountCents: number; idempotencyKey: string }): Promise<{ refundId: string }>;
  /** Crée le compte de versement d'un freelance. */
  createAccount(input: { email: string; country: string; idempotencyKey: string }): Promise<{ accountId: string }>;
  /** Lien d'inscription chez le prestataire, où le freelance donne lui-même son identité et son IBAN. */
  onboardingLink(input: { accountId: string; returnUrl: string; refreshUrl: string }): Promise<{ url: string }>;
  /** Le compte peut recevoir nos virements, d'après l'état qu'en tient le prestataire à cet instant. */
  payoutAccountReady(accountId: string): Promise<boolean>;
  /** Lecture seule : l'intention et sa dernière charge. Sert à retrouver la source d'un virement, jamais à payer. */
  readIntent(intentId: string): Promise<IntentFacts>;
  /** Lecture seule : une charge. Sert à vérifier la source d'un virement avant le premier virement. */
  readCharge(chargeId: string): Promise<ChargeFacts>;
}

/** Événement du prestataire, normalisé. */
export type PaymentEvent =
  | { readonly id: string; readonly type: "payment.failed" | "payment.canceled" | "dispute.opened"; readonly intentId: string }
  /** Paiement encaissé ; `chargeId` est la charge (`latest_charge`) qui financera les virements, nulle si elle n'est pas connue. */
  | {
      readonly id: string;
      readonly type: "payment.succeeded";
      readonly intentId: string;
      readonly chargeId: string | null;
      /** L'heure de l'événement chez le prestataire (`created`) : date l'encaissement même si l'événement est rejoué plus tard. */
      readonly occurredAt?: Date | undefined;
    }
  | { readonly id: string; readonly type: "dispute.closed"; readonly intentId: string; readonly won: boolean }
  /** Montant remboursé cumulé, tel que le prestataire le connaît : un remboursement partiel n'est pas un remboursement total. */
  | { readonly id: string; readonly type: "refund.updated"; readonly intentId: string; readonly amountRefundedCents: number }
  | { readonly id: string; readonly type: "account.updated"; readonly accountId: string; readonly payoutsEnabled: boolean };

/** Au-delà, une réservation de versement est considérée comme interrompue (processus mort en plein appel). */
const STALE_CLAIM_MS = 10 * 60 * 1000;

export type OpenPaymentResult =
  | { readonly kind: "opened" | "resumed"; readonly paymentId: string; readonly clientSecret: string; readonly amountCents: number; readonly commissionCents: number }
  /** Des fonds sont déjà bloqués, en cours de versement ou versés pour ce contrat. */
  | { readonly kind: "already_paid" }
  /** La commission arrondie serait nulle : montant trop faible pour ce taux. */
  | { readonly kind: "amount_too_small" }
  /** Contrat en régie : il se paiera mois par mois sur relevé validé, pas d'un seul paiement. */
  | { readonly kind: "monthly_contract" }
  /** Le contrat est né sans taux de commission (aucun taux configuré à sa création) : il ne peut pas être payé. */
  | { readonly kind: "rate_missing" }
  | { readonly kind: "absent" };

export type ReleaseResult =
  | { readonly kind: "released"; readonly transferId: string; readonly missionInvoice: string; readonly commissionInvoice: string }
  /** Le freelance n'a pas encore de compte de versement validé : les fonds restent bloqués, rien n'est perdu. */
  | { readonly kind: "account_missing" }
  /** Litige ou remboursement : rien n'est versé, une personne doit trancher. */
  | { readonly kind: "blocked" }
  | { readonly kind: "not_releasable" };

export type PayoutAccountResult =
  | { readonly kind: "link"; readonly url: string }
  | { readonly kind: "identity_missing" }
  | { readonly kind: "absent" };

export type EventResult = "applied" | "duplicate" | "ignored";

export interface Payments {
  /**
   * Ouvre le paiement d'un contrat au forfait. Le taux de commission est celui que le contrat a figé à sa création
   * (fidélité comprise) : ni la configuration du jour ni l'appelant ne le changent.
   */
  open(actor: Actor, contractId: string, gateway: PaymentGateway): Promise<OpenPaymentResult>;
  applyEvent(event: PaymentEvent, now: Date): Promise<EventResult>;
  /** Libère les fonds d'un contrat terminé. Sans acteur : appelé par le système, et rejouable sans risque. */
  release(contractId: string, gateway: PaymentGateway, proofseen: LegalSnapshot, now: Date): Promise<ReleaseResult>;
  /** Rejoue les versements dus : contrats terminés aux fonds encore bloqués, réservations interrompues. */
  releaseDue(gateway: PaymentGateway, proofseen: LegalSnapshot, now: Date): Promise<Readonly<Record<ReleaseResult["kind"], number>>>;
  /** Rembourse intégralement un paiement encore bloqué (décision d'arbitrage, pas d'une partie). */
  refundHeld(contractId: string, gateway: PaymentGateway, now: Date): Promise<boolean>;
  /** Le lien d'inscription du freelance chez le prestataire, son compte créé au premier appel. */
  payoutAccount(actor: Actor, gateway: PaymentGateway, urls: { readonly returnUrl: string; readonly refreshUrl: string }): Promise<PayoutAccountResult>;
  /**
   * Au retour du freelance sur sa page de facturation : un compte ouvert mais pas encore confirmé est relu chez le
   * prestataire. Rend `null` sans compte ouvert, sinon s'il est prêt. Un compte déjà prêt n'est pas relu.
   */
  confirmPayoutAccount(actor: Actor, gateway: PaymentGateway, now: Date): Promise<boolean | null>;
  /** Le paiement d'un contrat, pour ses parties. Le détail de la commission n'est montré qu'au freelance. */
  find(actor: Actor, contractId: string): Promise<{ readonly status: PaymentStatus; readonly amountCents: number; readonly commissionCents: number | null; readonly currency: string } | null>;
}

const Uuid = z.uuid();
const ADMIN_ROLES = ["owner", "admin"] as const;

/** Un administrateur de l'entreprise du contrat, qui n'en est pas le freelance. */
const payer = (userId: string): Prisma.ContractWhereInput => ({
  organisation: { members: { some: { userId, role: { in: [...ADMIN_ROLES] } } } },
  NOT: { profile: { userId } },
});

const commissionWithVat = (commissionCents: number): number => commissionCents + vatOf(commissionCents, 2000);

/** Recopie l'état lu chez le prestataire, sans réécrire la date de première confirmation si le compte reste prêt. */
const recordReadiness = async (db: Db, stripeAccountId: string, enabledAt: Date | null, ready: boolean, now: Date): Promise<void> => {
  if (ready === (enabledAt !== null)) return;
  await db.billingIdentity.update({ where: { stripeAccountId }, data: { payoutsEnabledAt: ready ? now : null } });
};

export const payments = (db: Db): Payments => {
  const releaseOne = async (contractId: string, gateway: PaymentGateway, proofseen: LegalSnapshot, now: Date): Promise<ReleaseResult> => {
    const payment = await db.payment.findFirst({
      where: { contractId, status: { in: ["held", "releasing", "released"] }, contract: { status: "completed" } },
      select: {
        id: true,
        status: true,
        claimedAt: true,
        transferId: true,
        chargeId: true,
        paidAt: true,
        stripeIntentId: true,
        amountCents: true,
        commissionCents: true,
        refundedCents: true,
        disputeOpenedAt: true,
        disputeWon: true,
        currency: true,
        contract: { select: { profile: { select: { billing: { select: { stripeAccountId: true, payoutsEnabledAt: true } } } } } },
      },
    });
    if (payment === null) return { kind: "not_releasable" };

    let transferId = payment.transferId;
    if (payment.status !== "released") {
      if (payment.refundedCents > 0 || (payment.disputeOpenedAt !== null && payment.disputeWon !== true)) return { kind: "blocked" };
      const account = payment.contract.profile?.billing ?? null;
      if (account?.stripeAccountId == null) {
        if (payment.contract.profile === null) await db.payment.update({ where: { id: payment.id }, data: { needsReviewAt: now } });
        return { kind: "account_missing" };
      }
      // Jamais de virement sans source : la charge de CE paiement (retrouvée et vérifiée chez le prestataire si besoin)
      // finance CE virement, pas le solde commun. Contrôlé en premier (un paiement sans source ne coûte aucun autre appel)
      // et avant la réservation, donc sans état à rendre ; un refus signale le paiement à une personne.
      const transferCents = payment.amountCents - commissionWithVat(payment.commissionCents);
      const sourceTransaction = await establishSource(db, gateway, payment, transferCents, now);
      // L'état qui fait foi est celui du prestataire à cet instant (capacité de réception des virements), pas le dernier
      // événement reçu : il est relu avant chaque versement et recopié s'il a changé.
      const ready = await gateway.payoutAccountReady(account.stripeAccountId);
      await recordReadiness(db, account.stripeAccountId, account.payoutsEnabledAt, ready, now);
      if (!ready) return { kind: "account_missing" };
      // Réserver : de « bloqué » à « en cours », ou reprendre une réservation interrompue. Une seule instruction.
      const stale = new Date(now.getTime() - STALE_CLAIM_MS);
      const { count } = await db.payment.updateMany({
        where: { id: payment.id, OR: [{ status: "held" }, { status: "releasing", claimedAt: { lt: stale } }] },
        data: { status: "releasing", claimedAt: now },
      });
      if (count === 0) return { kind: "not_releasable" };
      try {
        transferId =
          (await gateway.findTransfer(contractId)) ??
          (
            await gateway.transfer({
              amountCents: transferCents,
              currency: payment.currency,
              destination: account.stripeAccountId,
              contractId,
              idempotencyKey: `release-${payment.id}`,
              sourceTransaction,
            })
          ).transferId;
      } catch (error) {
        // L'appel a échoué : la réservation est rendue, le versement sera repris.
        await db.payment.updateMany({ where: { id: payment.id, status: "releasing" }, data: { status: "held", claimedAt: null } });
        throw error;
      }
      const after = await db.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { disputeOpenedAt: true, refundedCents: true } });
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: "released",
          transferId,
          releasedAt: now,
          // Un litige ou un remboursement arrivé pendant le virement : l'argent est parti, une personne doit trancher.
          ...(after.disputeOpenedAt !== null || after.refundedCents > 0 ? { needsReviewAt: now } : {}),
        },
      });
    }
    // Les factures s'émettent une fois les fonds libérés ; relancer la libération les rend sans en émettre d'autres.
    const mission = await invoices(db).issueMission(contractId, now);
    const commission = await invoices(db).issueCommission(contractId, payment.commissionCents, proofseen, now);
    if (mission.kind === "not_invoiceable" || commission.kind === "not_invoiceable" || transferId === null) {
      await db.payment.update({ where: { id: payment.id }, data: { needsReviewAt: now } });
      return { kind: "not_releasable" };
    }
    // Fonds versés, factures émises : la mission devient un fait vérifié du profil (une seule fois par contrat).
    await recordPaidMission(db, contractId, now);
    return { kind: "released", transferId, missionInvoice: mission.invoice.number, commissionInvoice: commission.invoice.number };
  };

  return {
    async open(actor, contractId, gateway) {
      if (!Uuid.safeParse(contractId).success) return { kind: "absent" };
      const contract = await db.contract.findFirst({
        where: { id: contractId, status: "active", ...payer(actor.userId) },
        select: { totalCents: true, currency: true, billing: true, commissionBp: true, feePayer: true, sellerSnapshot: true, _count: { select: { payments: true } } },
      });
      if (contract === null) return { kind: "absent" };
      if (contract.billing !== "fixed") return { kind: "monthly_contract" };
      // Le taux est celui que le contrat a figé à sa création (fidélité comprise), jamais celui de l'environnement du jour.
      if (contract.commissionBp === null) return { kind: "rate_missing" };
      if (contract.feePayer !== "freelance") throw new Error("payeur de la commission non pris en charge");
      const seller = LegalSnapshotSchema.parse(contract.sellerSnapshot);
      // L'entreprise paie le TTC de la facture de mission ; la commission se calcule sur le hors-taxe.
      const amountCents = contract.totalCents + vatOf(contract.totalCents, seller.vatRateBp ?? 0);
      const commissionCents = Math.round((contract.totalCents * contract.commissionBp) / 10_000);
      if (commissionCents < 1) return { kind: "amount_too_small" };

      const existing = await db.payment.findFirst({
        where: { contractId, status: { in: ["pending", "held", "releasing", "released", "refunding"] } },
        select: { id: true, status: true, stripeIntentId: true, amountCents: true, commissionCents: true },
      });
      if (existing !== null && existing.status !== "pending") return { kind: "already_paid" };
      if (existing !== null) {
        // Paiement abandonné (onglet fermé, autre administrateur) : on reprend la même intention, jamais une seconde.
        const clientSecret = await gateway.intentSecret(existing.stripeIntentId);
        return { kind: "resumed", paymentId: existing.id, clientSecret, amountCents: existing.amountCents, commissionCents: existing.commissionCents };
      }

      const intent = await gateway.createIntent({ amountCents, currency: contract.currency, contractId, idempotencyKey: `pay-${contractId}-${contract._count.payments + 1}` });
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

    async applyEvent(event, now) {
      return db.$transaction(async (tx): Promise<EventResult> => {
        try {
          await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
        } catch (error) {
          if (isUniqueViolation(error)) return "duplicate";
          throw error;
        }
        if (event.type === "account.updated") {
          const account = await tx.billingIdentity.findUnique({ where: { stripeAccountId: event.accountId }, select: { payoutsEnabledAt: true } });
          if (account === null) return "ignored";
          await tx.billingIdentity.update({
            where: { stripeAccountId: event.accountId },
            data: { payoutsEnabledAt: event.payoutsEnabled ? (account.payoutsEnabledAt ?? now) : null },
          });
          return "applied";
        }
        const payment = await tx.payment.findUnique({
          where: { stripeIntentId: event.intentId },
          select: { id: true, status: true, amountCents: true, refundedCents: true },
        });
        if (payment === null) return "ignored";
        const afterRelease = payment.status === "released" || payment.status === "releasing";

        switch (event.type) {
          case "payment.succeeded": {
            // La charge qui a encaissé ce paiement, si elle n'est pas déjà attribuée à un autre. Sans charge établie (absente de
            // l'événement, invalide, ou prise par un autre paiement), le paiement est bloqué quand même (le client a payé) mais
            // une personne est prévenue tout de suite ; la charge sera retrouvée au versement, ou apportée par un événement tardif.
            const charge = await chargeToRecord(tx, payment.id, event.chargeId);
            const review = charge.chargeId === null ? { needsReviewAt: now } : {};
            // Daté de l'heure de l'événement (rejoué des jours plus tard après une panne), jamais dans le futur.
            const paidAt = new Date(Math.min((event.occurredAt ?? now).getTime(), now.getTime()));
            const first = await tx.payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status: "held", paidAt, chargeId: charge.chargeId, ...review } });
            if (first.count === 1) return "applied";
            if (charge.chargeId === null) return "ignored";
            // Un événement tardif complète un paiement déjà bloqué sans charge ; il n'en change jamais une connue.
            const late = await tx.payment.updateMany({ where: { id: payment.id, status: "held", chargeId: null }, data: { chargeId: charge.chargeId } });
            return late.count === 1 ? "applied" : "ignored";
          }
          case "payment.failed":
            // Pas un état final : le client peut réessayer sur la même intention, qui réussira peut-être.
            return "ignored";
          case "payment.canceled": {
            const { count } = await tx.payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status: "canceled" } });
            return count === 1 ? "applied" : "ignored";
          }
          case "dispute.opened":
            await tx.payment.update({ where: { id: payment.id }, data: { disputeOpenedAt: now, disputeWon: null, ...(afterRelease ? { needsReviewAt: now } : {}) } });
            return "applied";
          case "dispute.closed":
            if (event.won) {
              await tx.payment.update({ where: { id: payment.id }, data: { disputeWon: true } });
            } else {
              // Litige perdu : le prestataire a repris les fonds au client.
              await tx.payment.update({
                where: { id: payment.id },
                data: {
                  disputeWon: false,
                  refundedCents: payment.amountCents,
                  ...(payment.status === "held" ? { status: "refunded" } : {}),
                  ...(afterRelease ? { needsReviewAt: now } : {}),
                },
              });
            }
            return "applied";
          case "refund.updated": {
            const refunded = Math.min(payment.amountCents, Math.max(payment.refundedCents, event.amountRefundedCents));
            const full = refunded === payment.amountCents;
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                refundedCents: refunded,
                ...(full && (payment.status === "held" || payment.status === "refunding") ? { status: "refunded" } : {}),
                // Un remboursement partiel, ou survenu après le versement, n'a pas de suite automatique.
                ...(afterRelease || !full ? { needsReviewAt: now } : {}),
              },
            });
            return "applied";
          }
        }
      });
    },

    release(contractId, gateway, proofseen, now) {
      if (!Uuid.safeParse(contractId).success) return Promise.resolve({ kind: "not_releasable" });
      return releaseOne(contractId, gateway, proofseen, now);
    },

    async releaseDue(gateway, proofseen, now) {
      const stale = new Date(now.getTime() - STALE_CLAIM_MS);
      // Les paiements à charge connue passent d'abord (certains), puis les plus anciens ; un paiement signalé à une personne
      // (relecture de sa charge échouée, charge qui ne correspond pas) sort de la sélection : 50 paiements en panne ne
      // doivent pas affamer ceux qui peuvent être versés. `release` reste possible pour celui qu'une personne a réglé.
      const due = await db.payment.findMany({
        where: { contract: { status: "completed" }, needsReviewAt: null, OR: [{ status: "held" }, { status: "releasing", claimedAt: { lt: stale } }] },
        orderBy: [{ chargeId: { sort: "asc", nulls: "last" } }, { updatedAt: "asc" }],
        select: { contractId: true },
        take: 50,
      });
      const counts: Record<ReleaseResult["kind"], number> = { released: 0, account_missing: 0, blocked: 0, not_releasable: 0 };
      for (const { contractId } of due) {
        try {
          counts[(await releaseOne(contractId, gateway, proofseen, now)).kind] += 1;
        } catch (error) {
          // Le nom de l'erreur seulement : jamais d'identifiant, de montant ni de message du prestataire.
          console.error(JSON.stringify({ level: "error", event: "release due failed", error: error instanceof Error ? error.name : "unknown" }));
          counts.not_releasable += 1;
        }
      }
      return counts;
    },

    async refundHeld(contractId, gateway, now) {
      if (!Uuid.safeParse(contractId).success) return false;
      const payment = await db.payment.findFirst({ where: { contractId, status: "held" }, select: { id: true, stripeIntentId: true, amountCents: true } });
      if (payment === null) return false;
      const { count } = await db.payment.updateMany({ where: { id: payment.id, status: "held" }, data: { status: "refunding", claimedAt: now } });
      if (count === 0) return false;
      try {
        await gateway.refund({ intentId: payment.stripeIntentId, amountCents: payment.amountCents, idempotencyKey: `refund-${payment.id}` });
      } catch (error) {
        await db.payment.updateMany({ where: { id: payment.id, status: "refunding" }, data: { status: "held", claimedAt: null } });
        throw error;
      }
      await db.payment.update({ where: { id: payment.id }, data: { status: "refunded", refundedCents: payment.amountCents } });
      return true;
    },

    async payoutAccount(actor, gateway, urls) {
      const profile = await db.freelanceProfile.findUnique({
        where: { userId: actor.userId },
        select: { id: true, user: { select: { email: true } }, billing: { select: { stripeAccountId: true, address: true } } },
      });
      if (profile === null) return { kind: "absent" };
      if (profile.billing === null) return { kind: "identity_missing" };
      let accountId = profile.billing.stripeAccountId;
      if (accountId === null) {
        const country = z.object({ country: z.string().regex(/^[A-Z]{2}$/) }).safeParse(profile.billing.address);
        if (!country.success) return { kind: "identity_missing" };
        accountId = (await gateway.createAccount({ email: profile.user.email, country: country.data.country, idempotencyKey: `acct-${profile.id}` })).accountId;
        await db.billingIdentity.update({ where: { profileId: profile.id }, data: { stripeAccountId: accountId } });
      }
      return { kind: "link", url: (await gateway.onboardingLink({ accountId, ...urls })).url };
    },

    async confirmPayoutAccount(actor, gateway, now) {
      const profile = await db.freelanceProfile.findUnique({
        where: { userId: actor.userId },
        select: { billing: { select: { stripeAccountId: true, payoutsEnabledAt: true } } },
      });
      const account = profile?.billing ?? null;
      if (account?.stripeAccountId == null) return null;
      if (account.payoutsEnabledAt !== null) return true;
      const ready = await gateway.payoutAccountReady(account.stripeAccountId);
      await recordReadiness(db, account.stripeAccountId, account.payoutsEnabledAt, ready, now);
      return ready;
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
  };
};
