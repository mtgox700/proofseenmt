import { z } from "zod";

/*
 * Journal des pré-paiements et décompte de la GATE (3) Argent (US-P01, ROADMAP §7).
 *
 * Le piège que ce fichier existe pour éviter : **annoncer une gate franchie avec des paiements qu'un client peut
 * défaire le lendemain.** Un pré-paiement de moins de 14 jours reste rétractable sans justification (CGV article 9) ;
 * le compter, c'est se mentir sur le seul chiffre qui décide de la suite du projet. Il est donc mis de côté comme
 * « provisoire », et le décompte dit les deux nombres au lieu d'un seul.
 *
 * Même logique pour le reste : un paiement remboursé ou contesté ne compte pas, un paiement encaissé après l'échéance
 * ne compte pas, et si la gate échoue, le journal produit lui-même la liste de ce qu'il faut rembourser.
 */

/** Les deux offres annoncées (OFFRE_PREVENTE). Vocabulaire fermé : un décompte ne porte que sur ce qui a été vendu. */
export const OFFERS = ["audit", "cle_en_main"] as const;
export type Offer = (typeof OFFERS)[number];

/** Gate (3) : 10 freelances pré-paient avant cette date (ROADMAP §7). Heure de Paris, fin de journée. */
export const GATE_DEADLINE = "2026-11-27T23:59:59+01:00";
export const GATE_TARGET = 10;
/** Délai de rétractation légal, repris à l'article 9 des CGV. */
export const WITHDRAWAL_DAYS = 14;
/** Livraison au plus tard, sinon remboursement intégral **et automatique** (CGV article 10). */
export const DELIVERY_DEADLINE = "2026-12-31T23:59:59+01:00";
/** À partir de ce reste, une commande non livrée est signalée : assez tôt pour livrer, pas pour découvrir. */
export const DUE_SOON_DAYS = 14;

const MS_PER_DAY = 86_400_000;
/**
 * ISO strict avec fuseau explicite. `Date.parse` accepterait des formats dont l'interprétation dépend du fuseau de la
 * machine : le même journal pourrait alors donner deux décomptes différents selon où il est lu, sur le seul chiffre
 * qui décide de la suite du projet.
 */
const instant = z.iso.datetime({ offset: true });

export const PaymentSchema = z.object({
  /** Référence du paiement chez le prestataire (Stripe). Sert de clé : elle ne peut pas apparaître deux fois. */
  reference: z.string().min(1).max(120),
  paidAt: instant,
  offer: z.enum(OFFERS),
  amountCents: z.number().int().positive(),
  status: z.enum(["paid", "refunded", "disputed"]),
  /**
   * Date de la demande expresse écrite d'exécution anticipée (CGV article 9). Le client y renonce à se rétracter une
   * fois l'audit livré : son paiement est donc acquis sans attendre les 14 jours.
   */
  earlyStartRequestedAt: instant.nullable().default(null),
  /**
   * Date de livraison de la prestation. `null` = pas encore livrée. Sans ce champ, rien ne saurait dire ce qui reste
   * dû au 31/12 — or ce remboursement-là est **automatique** : il ne dépend d'aucune démarche du client.
   */
  deliveredAt: instant.nullable().default(null),
}).refine((p) => p.deliveredAt === null || Date.parse(p.deliveredAt) >= Date.parse(p.paidAt), "livraison antérieure au paiement");
export type Payment = z.infer<typeof PaymentSchema>;

export const PaymentJournalSchema = z.object({
  version: z.literal(1),
  payments: z.array(PaymentSchema).max(1000),
});
export type PaymentJournal = z.infer<typeof PaymentJournalSchema>;

export interface DeliveryStatus {
  readonly deadline: string;
  /** Commandes encaissées et non remboursées : celles qui donnent droit à une livraison. */
  readonly paid: number;
  readonly delivered: number;
  readonly pending: number;
  /** Non livrées dont l'échéance approche. */
  readonly dueSoon: number;
  /** Non livrées après l'échéance : le remboursement est dû, sans démarche du client. */
  readonly overdue: number;
  readonly toRefund: readonly string[];
  readonly toRefundCents: number;
}

/**
 * Ce qui reste à livrer, et ce qui est dû faute de l'avoir été.
 *
 * Les CGV (article 10) promettent un remboursement **intégral et automatique** si rien n'est livré au 31/12 : « sans
 * démarche de votre part ». Une obligation automatique que personne ne calcule n'est pas automatique — elle attend
 * qu'un client la réclame, ce que les CGV disent précisément qu'il n'aura pas à faire.
 */
export const deliveryStatus = (payments: readonly Payment[], now: Date): DeliveryStatus => {
  const deadline = Date.parse(DELIVERY_DEADLINE);
  const owed = payments.filter((payment) => payment.status === "paid");
  const pending = owed.filter((payment) => payment.deliveredAt === null);
  const past = now.getTime() > deadline;
  const late = past ? pending : [];
  return {
    deadline: DELIVERY_DEADLINE,
    paid: owed.length,
    delivered: owed.length - pending.length,
    pending: pending.length,
    // Avant l'échéance il reste du temps pour livrer : signaler, oui ; réclamer un remboursement, non.
    dueSoon: past ? 0 : pending.filter(() => deadline - now.getTime() <= DUE_SOON_DAYS * MS_PER_DAY).length,
    overdue: late.length,
    toRefund: late.map((payment) => payment.reference),
    toRefundCents: late.reduce((sum, payment) => sum + payment.amountCents, 0),
  };
};

export interface GateStatus {
  readonly target: number;
  readonly deadline: string;
  /** Paiements acquis : encaissés, non remboursés, dans les délais, et hors période de rétractation. */
  readonly counted: number;
  /** Encaissés mais encore rétractables : réels, pas encore acquis. */
  readonly provisional: number;
  readonly refunded: number;
  readonly disputed: number;
  readonly afterDeadline: number;
  /** Produit des seuls paiements comptés, en centimes. */
  readonly revenueCents: number;
  /** L'échéance est passée : la gate peut être tranchée. */
  readonly decidable: boolean;
  readonly met: boolean;
  /** Ce que dirait le décompte si tous les provisoires tenaient : à montrer, jamais à annoncer comme acquis. */
  readonly metWithProvisional: boolean;
  /** Références à rembourser si la gate échoue (CGV article 10). Vide tant que rien n'est tranché. */
  readonly toRefund: readonly string[];
}

/**
 * Une renonciation n'est valable que si sa date est cohérente : après le paiement, et pas dans le futur. Se contenter
 * de la présence du champ laisserait une date fantaisiste acquérir un paiement encore rétractable — exactement le
 * genre de `true` non contrôlé qui ferait annoncer une gate franchie à tort.
 */
const renounced = (payment: Payment, now: Date): boolean => {
  if (payment.earlyStartRequestedAt === null) return false;
  const at = Date.parse(payment.earlyStartRequestedAt);
  return at >= Date.parse(payment.paidAt) && at <= now.getTime();
};

/** Un paiement est acquis quand le délai de rétractation est écoulé, ou quand le client y a valablement renoncé. */
const settled = (payment: Payment, now: Date): boolean =>
  renounced(payment, now) || now.getTime() - Date.parse(payment.paidAt) >= WITHDRAWAL_DAYS * MS_PER_DAY;

/**
 * Décompte de la gate à une date donnée. Aucune décision avant l'échéance : `met` reste faux même si la cible est
 * dépassée, parce qu'un décompte pris en cours de route n'engage rien et qu'un remboursement ne se déclenche pas sur
 * une gate qui n'a pas encore eu lieu.
 */
export const gateStatus = (payments: readonly Payment[], now: Date): GateStatus => {
  const references = new Set<string>();
  for (const payment of payments) {
    if (references.has(payment.reference)) throw new Error(`référence de paiement en double dans le journal : ${payment.reference}`);
    references.add(payment.reference);
  }

  const deadline = Date.parse(GATE_DEADLINE);
  const inTime = payments.filter((payment) => Date.parse(payment.paidAt) <= deadline);
  const live = inTime.filter((payment) => payment.status === "paid");
  const acquired = live.filter((payment) => settled(payment, now));
  const provisional = live.filter((payment) => !settled(payment, now));

  const decidable = now.getTime() >= deadline;
  const met = decidable && acquired.length >= GATE_TARGET;
  return {
    target: GATE_TARGET,
    deadline: GATE_DEADLINE,
    counted: acquired.length,
    provisional: provisional.length,
    refunded: payments.filter((payment) => payment.status === "refunded").length,
    disputed: payments.filter((payment) => payment.status === "disputed").length,
    afterDeadline: payments.length - inTime.length,
    revenueCents: acquired.reduce((sum, payment) => sum + payment.amountCents, 0),
    decidable,
    met,
    metWithProvisional: decidable && acquired.length + provisional.length >= GATE_TARGET,
    // Tout ce qui a été encaissé et pas encore rendu, provisoires compris : un client rétractable est un client à rembourser.
    toRefund: decidable && !met ? payments.filter((payment) => payment.status === "paid").map((payment) => payment.reference) : [],
  };
};
