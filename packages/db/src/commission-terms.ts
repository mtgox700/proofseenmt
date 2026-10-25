import { z } from "zod";

/*
 * Les conditions de commission que le contrat fige à sa création. Le taux est une décision du founder : il vient de la
 * configuration (variables d'environnement), n'est jamais inventé ici, et n'est lu qu'à la création du contrat. Le
 * paiement lit ensuite le contrat, jamais l'environnement du moment.
 */

export const MAX_COMMISSION_BP = 5000;

/** Taux de fidélité par défaut (décision de la War Room du 2026-10-07 : 5 %), à confirmer par le founder (D11). */
export const DEFAULT_REPEAT_COMMISSION_BP = 500;

export interface CommissionTerms {
  /** Taux standard, en points de base (1000 = 10 %). */
  readonly commissionBp: number;
  /** Taux de fidélité, appliqué s'il est plus bas quand le freelance a déjà été payé par cette entreprise. */
  readonly repeatCommissionBp: number;
}

type Env = Readonly<Record<string, string | undefined>>;

const BasisPoints = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_COMMISSION_BP));

const read = (raw: string | undefined): number | null => {
  const parsed = BasisPoints.safeParse(raw ?? "");
  return parsed.success ? parsed.data : null;
};

/**
 * Les conditions du jour, ou `null` si le taux standard n'est pas configuré ou invalide : aucun contrat n'invente un
 * taux. Une faute de frappe sur le taux de fidélité retombe sur le défaut publié plutôt que sur le taux standard : elle
 * ne doit pas retirer en silence une remise annoncée.
 */
export const commissionTermsFromEnv = (env: Env): CommissionTerms | null => {
  const commissionBp = read(env.PROOFSEEN_COMMISSION_BP);
  if (commissionBp === null) return null;
  return { commissionBp, repeatCommissionBp: read(env.PROOFSEEN_REPEAT_COMMISSION_BP) ?? DEFAULT_REPEAT_COMMISSION_BP };
};

/** Le taux qui s'appliquera au contrat : le plus bas des deux quand le freelance a déjà été payé par l'entreprise. */
export const effectiveCommissionBp = (terms: CommissionTerms, repeatClient: boolean): number =>
  repeatClient ? Math.min(terms.commissionBp, terms.repeatCommissionBp) : terms.commissionBp;
