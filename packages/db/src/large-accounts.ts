import { z } from "zod";
import type { Db } from "./client";
import type { Actor } from "./messaging";
import { SETTLED_PAYMENT } from "./reviews";

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

export interface PoolMember {
  readonly profileId: string;
  readonly reference: string;
  readonly headline: string | null;
  readonly skills: readonly string[];
  /** Missions payées (paiement acquis) avec cette entreprise. */
  readonly paidMissions: number;
  readonly totalDays: number;
  readonly lastMissionStartedOn: Date;
}

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

  /** Le vivier privé d'une entreprise, pour ses membres ; `null` pour les autres. Le plus récent d'abord. */
  async talentPool(actor: Actor, organisationId: string): Promise<readonly PoolMember[] | null> {
    if (!Uuid.safeParse(organisationId).success) return null;
    const member = await db.membership.count({ where: { organisationId, userId: actor.userId } });
    if (member === 0) return null;
    const rows = await db.contract.findMany({
      where: { organisationId, profileId: { not: null }, payments: { some: SETTLED_PAYMENT } },
      select: { days: true, startsOn: true, profile: { select: { id: true, reference: true, headline: true, skills: { select: { skill: { select: { label: true } } } } } } },
      take: 2_000,
    });
    const byProfile = new Map<string, PoolMember>();
    for (const row of rows) {
      if (row.profile === null) continue;
      const known = byProfile.get(row.profile.id);
      byProfile.set(row.profile.id, {
        profileId: row.profile.id,
        reference: row.profile.reference,
        headline: row.profile.headline,
        skills: row.profile.skills.map((s) => s.skill.label),
        paidMissions: (known?.paidMissions ?? 0) + 1,
        totalDays: (known?.totalDays ?? 0) + row.days,
        lastMissionStartedOn: known === undefined || row.startsOn > known.lastMissionStartedOn ? row.startsOn : known.lastMissionStartedOn,
      });
    }
    return [...byProfile.values()].sort((a, b) => b.lastMissionStartedOn.getTime() - a.lastMissionStartedOn.getTime() || a.reference.localeCompare(b.reference));
  },
});
