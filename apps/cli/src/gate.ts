import { PaymentJournalSchema, deliveryStatus, gateStatus } from "@proofseen/presale";
import { loadJson } from "./files";
import type { CommonOptions } from "./commands";

/*
 * Décompte de la GATE (3) Argent depuis le journal des paiements (US-P01).
 *
 * La sortie dit toujours **deux** nombres : ce qui est acquis, et ce qui le serait si les paiements encore rétractables
 * tenaient. Un seul nombre inviterait à lire le plus flatteur des deux.
 */

export interface GateCommand extends Pick<CommonOptions, "log" | "now"> {
  readonly journalPath: string;
}

const euros = (cents: number): string => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

export const commandGate = async (o: GateCommand): Promise<void> => {
  const journal = await loadJson(o.journalPath, PaymentJournalSchema, "journal des paiements");
  const status = gateStatus(journal.payments, o.now());

  o.log(`GATE (3) Argent — échéance ${status.deadline}, cible ${status.target} pré-paiements`);
  o.log(`  acquis        : ${status.counted}/${status.target} · ${euros(status.revenueCents)}`);
  if (status.provisional > 0) {
    o.log(`  provisoires   : ${status.provisional} (encaissés, encore rétractables — non comptés)`);
  }
  for (const [label, value] of [["remboursés", status.refunded], ["contestés", status.disputed], ["hors délai", status.afterDeadline]] as const) {
    if (value > 0) o.log(`  ${label.padEnd(14)}: ${value} (exclus)`);
  }

  // Avant l'échéance de la gate, et pas seulement après : c'est là que l'alerte « livraison qui approche » sert.
  reportDelivery(o, journal.payments);

  if (!status.decidable) {
    o.log("\nÉchéance non atteinte : aucune décision, aucun remboursement déclenché.");
    if (status.counted + status.provisional >= status.target) {
      o.log("La cible serait atteinte aujourd'hui — cela n'engage rien tant que l'échéance n'est pas passée.");
    }
    return;
  }

  o.log(status.met ? "\nGATE FRANCHIE." : "\nGATE NON FRANCHIE.");
  if (!status.met && status.metWithProvisional) {
    o.log("La cible n'est atteinte qu'en comptant des paiements encore rétractables : elle n'est donc pas atteinte.");
  }
  if (status.toRefund.length > 0) {
    o.log(`\n${status.toRefund.length} paiement(s) à rembourser intégralement sous 14 jours (CGV article 10) :`);
    for (const reference of status.toRefund) o.log(`  ${reference}`);
  }
};

/**
 * Ce qui reste à livrer. Les CGV promettent un remboursement « intégral et automatique, sans démarche de votre part »
 * si rien n'est livré au 31/12 : une obligation automatique que personne ne calcule attend qu'un client la réclame,
 * ce que les CGV disent précisément qu'il n'aura pas à faire.
 */
const reportDelivery = (o: GateCommand, payments: Parameters<typeof deliveryStatus>[0]): void => {
  const delivery = deliveryStatus(payments, o.now());
  if (delivery.paid === 0) return;
  o.log("");
  o.log(`LIVRAISON — échéance ${delivery.deadline}`);
  o.log(`  livrées       : ${delivery.delivered}/${delivery.paid}`);
  if (delivery.pending > 0) o.log(`  restantes     : ${delivery.pending}`);
  if (delivery.dueSoon > 0) o.log(`  ⚠ ${delivery.dueSoon} commande(s) non livrée(s) à moins de deux semaines de l'échéance.`);
  if (delivery.overdue > 0) {
    o.log(`  ⚠ ÉCHÉANCE DÉPASSÉE : ${delivery.overdue} commande(s) non livrée(s) — remboursement dû, sans démarche du client (CGV art. 10).`);
    o.log(`    ${euros(delivery.toRefundCents)} à rembourser : ${delivery.toRefund.join(", ")}`);
  }
};
