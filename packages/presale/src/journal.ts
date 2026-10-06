import { PaymentJournalSchema, PaymentSchema, type Payment, type PaymentJournal } from "./gate";

/*
 * Écrire dans le journal des paiements.
 *
 * Jusqu'ici, `gate` savait compter mais personne ne savait écrire : il fallait éditer le JSON à la main. C'est
 * exactement l'endroit où une erreur coûte de l'argent, et les trois erreurs possibles sont connues d'avance :
 *
 *  1. **La même référence deux fois.** C'est la référence du prestataire de paiement ; la compter deux fois gonfle le
 *     décompte de la gate — on croirait avoir atteint 10 ventes avec 9.
 *  2. **Écraser un paiement existant** en croyant le corriger. Un paiement est un fait daté : il se complète
 *     (livraison, remboursement), il ne se réécrit pas.
 *  3. **Perdre les autres paiements** en réécrivant le fichier. Toutes ces fonctions rendent un journal neuf qui
 *     contient les anciens, jamais un journal repartant de zéro.
 *
 * Aucune n'écrit sur disque : le journal entre, un nouveau journal sort. Ce qui les rend testables sans fichier, et
 * surtout utilisables par la CLI comme par le web sans deux copies de la règle.
 */

export const EMPTY_JOURNAL: PaymentJournal = { version: 1, payments: [] };

const find = (journal: PaymentJournal, reference: string): Payment | undefined => journal.payments.find((payment) => payment.reference === reference);

/** Ajoute un paiement. Refuse une référence déjà présente plutôt que de la compter deux fois. */
export const recordPayment = (journal: PaymentJournal, input: unknown): PaymentJournal => {
  const payment = PaymentSchema.parse(input);
  if (find(journal, payment.reference) !== undefined) {
    throw new Error(`paiement ${payment.reference} déjà enregistré : un paiement se complète, il ne se réécrit pas`);
  }
  return PaymentJournalSchema.parse({ ...journal, payments: [...journal.payments, payment] });
};

const replace = (journal: PaymentJournal, reference: string, change: (payment: Payment) => Payment): PaymentJournal => {
  const existing = find(journal, reference);
  if (existing === undefined) throw new Error(`aucun paiement ${reference} dans le journal`);
  return PaymentJournalSchema.parse({
    ...journal,
    payments: journal.payments.map((payment) => (payment.reference === reference ? change(payment) : payment)),
  });
};

/**
 * Marque une prestation livrée. C'est ce champ qui dit ce qui reste dû au 31/12 — et ce remboursement-là est
 * automatique, il ne dépend d'aucune démarche du client. Le poser deux fois masquerait la vraie date.
 */
export const markDelivered = (journal: PaymentJournal, reference: string, at: Date): PaymentJournal =>
  replace(journal, reference, (payment) => {
    if (payment.deliveredAt !== null) throw new Error(`paiement ${reference} déjà marqué livré le ${payment.deliveredAt}`);
    if (payment.status !== "paid") throw new Error(`paiement ${reference} au statut « ${payment.status} » : rien à livrer`);
    return PaymentSchema.parse({ ...payment, deliveredAt: at.toISOString() });
  });

/**
 * Marque un remboursement. La livraison éventuelle est **conservée** : effacer la date ferait croire qu'on n'a jamais
 * livré, et c'est cette trace-là qui explique pourquoi on a remboursé.
 */
export const markRefunded = (journal: PaymentJournal, reference: string): PaymentJournal =>
  replace(journal, reference, (payment) => {
    if (payment.status === "refunded") throw new Error(`paiement ${reference} déjà remboursé`);
    return PaymentSchema.parse({ ...payment, status: "refunded" });
  });
