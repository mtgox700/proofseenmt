import { z } from "zod";
import type { Db } from "./client";
import type { Actor } from "./messaging";
import { talentPool, type PoolMember } from "./talent-pool";

export type { PoolMember } from "./talent-pool";

/*
 * Ce qu'il faut à un grand compte ou à une ESN : un réglage de validation à deux niveaux, un centre de coûts sur chaque
 * contrat, et un vivier privé — les freelances avec qui l'entreprise a déjà travaillé et payé, présentés par des faits
 * (missions payées avec elle, dernière mission, jours), triés par date et jamais par un score (AI Act).
 */

const Uuid = z.uuid();
const ADMIN_ROLES = ["owner", "admin"] as const;
export const CostCenterSchema = z.string().trim().min(1).max(60).nullable();

export type ApprovalLevelsResult = "saved" | "absent" | "single_admin";
export type CostCenterResult = "saved" | "absent" | "invoiced";

export const largeAccounts = (db: Db) => ({
  /**
   * Le propriétaire fixe le nombre de validations exigées (1 ou 2). Deux validations demandent deux administrateurs :
   * avec un seul, aucune prestation ne pourrait plus être validée.
   */
  async setApprovalLevels(actor: Actor, organisationId: string, levels: 1 | 2): Promise<ApprovalLevelsResult> {
    if (!Uuid.safeParse(organisationId).success) return "absent";
    const owned = { id: organisationId, members: { some: { userId: actor.userId, role: "owner" as const } } };
    if (levels === 2) {
      const admins = await db.membership.count({ where: { organisationId, role: { in: [...ADMIN_ROLES] }, organisation: owned } });
      if (admins === 0) return "absent";
      if (admins < 2) return "single_admin";
    }
    const { count } = await db.organisation.updateMany({ where: owned, data: { approvalLevels: levels } });
    return count === 1 ? "saved" : "absent";
  },

  /**
   * Un administrateur de l'entreprise impute un contrat à un centre de coûts, tant que la facture de mission n'est pas
   * émise : après, l'export d'une période close ne doit plus changer (règle tenue aussi par la base).
   */
  async setCostCenter(actor: Actor, contractId: string, raw: string | null): Promise<CostCenterResult> {
    if (!Uuid.safeParse(contractId).success) return "absent";
    const costCenter = CostCenterSchema.parse(raw);
    const administered = { id: contractId, organisation: { members: { some: { userId: actor.userId, role: { in: [...ADMIN_ROLES] } } } } };
    const { count } = await db.contract.updateMany({ where: { ...administered, invoices: { none: { kind: "mission" } } }, data: { costCenter } });
    if (count === 1) return "saved";
    return (await db.contract.count({ where: administered })) === 1 ? "invoiced" : "absent";
  },

  /** Le vivier privé d'une entreprise, pour ses membres ; `null` pour les autres (`talent-pool.ts`). */
  async talentPool(actor: Actor, organisationId: string): Promise<readonly PoolMember[] | null> {
    return talentPool(db).list(actor, organisationId);
  },
});
