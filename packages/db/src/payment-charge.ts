import type { Prisma } from "./generated/client";
import { isSourceCharge } from "./payment-errors";

/*
 * La charge qui a encaissé un paiement devient sa source de virement. Une charge ne finance qu'un paiement : si celle
 * que l'événement annonce est déjà attribuée à un autre paiement, elle n'est pas retenue (sinon le virement de l'un
 * pourrait puiser dans l'argent de l'autre) et le paiement reste sans charge, donc sans virement, jusqu'à revue.
 *
 * L'attribution est sérialisée par un verrou consultatif sur la charge, tenu jusqu'à la fin de la transaction : deux
 * traitements concurrents qui annoncent la même charge pour deux paiements se suivent, le second voit le premier et
 * prend le chemin « conflit », au lieu de se heurter à l'index unique et d'annuler toute sa transaction.
 */
export interface ChargeToRecord {
  readonly chargeId: string | null;
  /** La charge annoncée appartient déjà à un autre paiement. */
  readonly conflict: boolean;
}

export const chargeToRecord = async (tx: Prisma.TransactionClient, paymentId: string, announced: string | null): Promise<ChargeToRecord> => {
  if (!isSourceCharge(announced)) return { chargeId: null, conflict: false };
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${announced}))`;
  const other = await tx.payment.findFirst({ where: { chargeId: announced, NOT: { id: paymentId } }, select: { id: true } });
  return other === null ? { chargeId: announced, conflict: false } : { chargeId: null, conflict: true };
};
