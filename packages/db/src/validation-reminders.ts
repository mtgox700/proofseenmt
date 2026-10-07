import type { Db } from "./client";
import { notifications } from "./notifications";

/*
 * Une mission payée que l'entreprise ne valide jamais : l'argent du freelance resterait bloqué sans fin. Décision de la
 * War Room (2026-10-07, par délégation du founder) : passé la fin prévue de VALIDATION_GRACE_DAYS jours, les deux
 * parties sont relancées et le paiement est marqué « à revoir » par une personne. **Jamais de versement automatique** :
 * l'entreprise a peut-être une vraie raison de ne pas valider, et seul un arbitrage humain tranche.
 *
 * La fin prévue est la date de fin du contrat, ou à défaut le début plus la durée en jours ouvrés (5 par semaine).
 * Rejouable : un paiement déjà marqué n'est ni relancé ni marqué une seconde fois.
 */

export const VALIDATION_GRACE_DAYS = 14;

const DAY_MS = 86_400_000;
const BATCH = 200;

/** La fin prévue d'une mission. */
export const plannedEnd = (c: { readonly startsOn: Date; readonly endsOn: Date | null; readonly days: number }): Date =>
  c.endsOn ?? new Date(c.startsOn.getTime() + Math.ceil((c.days * 7) / 5) * DAY_MS);

export const validationReminders = (db: Db) => ({
  /** Relance et marque les contrats en retard de validation ; rend le nombre de paiements marqués. */
  async flagOverdue(now: Date): Promise<number> {
    const candidates = await db.payment.findMany({
      where: { status: "held", needsReviewAt: null, contract: { status: "active" } },
      select: { id: true, contractId: true, contract: { select: { startsOn: true, endsOn: true, days: true } } },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });
    const overdue = candidates.filter((p) => plannedEnd(p.contract).getTime() + VALIDATION_GRACE_DAYS * DAY_MS < now.getTime());
    let flagged = 0;
    for (const payment of overdue) {
      const marked = await db.$transaction(async (tx) => {
        // La condition tient lieu de verrou : deux passages simultanés ne relancent qu'une fois.
        const { count } = await tx.payment.updateMany({ where: { id: payment.id, needsReviewAt: null, status: "held" }, data: { needsReviewAt: now } });
        if (count === 0) return false;
        const contract = await tx.contract.findUniqueOrThrow({ where: { id: payment.contractId }, select: { organisationId: true, profile: { select: { userId: true } } } });
        const members = contract.organisationId === null ? [] : await tx.membership.findMany({ where: { organisationId: contract.organisationId }, select: { userId: true } });
        const recipients = [...members.map((m) => m.userId), ...(contract.profile === null ? [] : [contract.profile.userId])];
        await notifications(db).enqueue(tx, recipients, "contract_update", { contractId: payment.contractId, status: "validation_due" });
        return true;
      });
      if (marked) flagged += 1;
    }
    return flagged;
  },
});
