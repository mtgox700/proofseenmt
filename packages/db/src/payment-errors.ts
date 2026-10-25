/*
 * Erreurs nommées du flux d'argent. Une erreur nommée se retrouve dans les journaux et se teste : un virement refusé
 * parce que sa source manque ne doit jamais se confondre avec une panne réseau.
 */

/** Une charge Stripe (`ch_`) ou un paiement équivalent (`py_`) : la seule source valable d'un virement. */
const SOURCE_CHARGE = /^(ch|py)_[A-Za-z0-9]+$/;

export const isSourceCharge = (value: unknown): value is string => typeof value === "string" && SOURCE_CHARGE.test(value);

/**
 * Le virement n'a pas de charge source établie : inconnue, introuvable chez le prestataire, illisible ou non retenue.
 * Sans `source_transaction`, Stripe prendrait l'argent sur le solde commun de la plateforme (celui des autres clients) :
 * on refuse plutôt que de virer sans source.
 */
export class SourceChargeMissingError extends Error {
  constructor() {
    super("virement refusé : la charge source du paiement n'est pas établie");
    this.name = "SourceChargeMissingError";
  }
}

/**
 * La charge enregistrée ne correspond pas au paiement chez le prestataire (autre intention, autre devise, impayée, ou trop
 * remboursée pour couvrir le virement) : une erreur de logique ou d'aiguillage, pas une charge manquante.
 */
export class SourceChargeMismatchError extends Error {
  constructor() {
    super("virement refusé : la charge source ne correspond pas au paiement");
    this.name = "SourceChargeMismatchError";
  }
}
