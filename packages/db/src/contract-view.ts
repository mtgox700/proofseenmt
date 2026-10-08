import { z } from "zod";
import { LegalSnapshotSchema } from "./billing";
import type { Db } from "./client";
import type { ContractBilling, ContractStatus, MemberRole } from "./generated/enums";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";

/*
 * Ce que les écrans montrent d'un contrat : les deux parties par leur nom légal (un contrat est signé entre personnes
 * identifiées, les noms viennent des identités figées à sa création), le côté de la personne, où en sont les
 * signatures et, pour l'entreprise, les validations de la prestation. Pour les parties seulement.
 */

const Uuid = z.uuid();
export const CONTRACT_LIST_LIMIT = 100;

export type ContractSide = "company" | "freelance";

export interface ContractSummary {
  readonly id: string;
  readonly side: ContractSide;
  readonly status: ContractStatus;
  readonly counterpart: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly startsOn: Date;
}

export interface ContractDetail extends ContractSummary {
  readonly seller: { readonly legalName: string; readonly siret: string | null };
  readonly buyer: { readonly legalName: string; readonly siret: string | null };
  readonly dailyRateCents: number;
  readonly days: number;
  readonly billing: ContractBilling;
  readonly repeatClient: boolean;
  readonly endsOn: Date | null;
  readonly costCenter: string | null;
  readonly signedByFreelanceAt: Date | null;
  readonly signedByCompanyAt: Date | null;
  /** Le rôle de la personne dans l'entreprise du contrat ; `null` côté freelance. */
  readonly role: MemberRole | null;
  readonly approvals: { readonly count: number; readonly mine: boolean; readonly required: number };
  readonly conversationId: string | null;
}

const party = (userId: string): Prisma.ContractWhereInput => ({
  OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }],
});

const SELECT = {
  id: true,
  status: true,
  totalCents: true,
  currency: true,
  startsOn: true,
  sellerSnapshot: true,
  buyerSnapshot: true,
  profile: { select: { userId: true } },
} as const;

type Row = Prisma.ContractGetPayload<{ select: typeof SELECT }>;

const summary = (row: Row, userId: string): ContractSummary => {
  const side: ContractSide = row.profile?.userId === userId ? "freelance" : "company";
  const seller = LegalSnapshotSchema.parse(row.sellerSnapshot);
  const buyer = LegalSnapshotSchema.parse(row.buyerSnapshot);
  return { id: row.id, side, status: row.status, counterpart: side === "freelance" ? buyer.legalName : seller.legalName, totalCents: row.totalCents, currency: row.currency, startsOn: row.startsOn };
};

export const contractView = (db: Db) => ({
  /** Les contrats de la personne, les plus récents d'abord. */
  async list(actor: Actor): Promise<readonly ContractSummary[]> {
    const rows = await db.contract.findMany({ where: party(actor.userId), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: CONTRACT_LIST_LIMIT, select: SELECT });
    return rows.map((row) => summary(row, actor.userId));
  },

  /** Un contrat, pour ses parties ; `null` pour les autres. */
  async find(actor: Actor, contractId: string): Promise<ContractDetail | null> {
    if (!Uuid.safeParse(contractId).success) return null;
    const row = await db.contract.findFirst({
      where: { id: contractId, ...party(actor.userId) },
      select: {
        ...SELECT,
        dailyRateCents: true,
        days: true,
        billing: true,
        repeatClient: true,
        endsOn: true,
        costCenter: true,
        acceptedByFreelanceAt: true,
        acceptedByOrgAt: true,
        quote: { select: { conversationId: true } },
        organisation: { select: { approvalLevels: true, members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } } },
        approvals: { select: { userId: true } },
      },
    });
    if (row === null) return null;
    const head = summary(row, actor.userId);
    const seller = LegalSnapshotSchema.parse(row.sellerSnapshot);
    const buyer = LegalSnapshotSchema.parse(row.buyerSnapshot);
    const admins = row.organisation?.members.map((m) => m.userId) ?? [];
    const role =
      head.side === "freelance" || row.organisation === null
        ? null
        : ((await db.membership.findFirst({ where: { organisation: { contracts: { some: { id: contractId } } }, userId: actor.userId }, select: { role: true } }))?.role ?? null);
    return {
      ...head,
      seller: { legalName: seller.legalName, siret: seller.siret },
      buyer: { legalName: buyer.legalName, siret: buyer.siret },
      dailyRateCents: row.dailyRateCents,
      days: row.days,
      billing: row.billing,
      repeatClient: row.repeatClient,
      endsOn: row.endsOn,
      costCenter: row.costCenter,
      signedByFreelanceAt: row.acceptedByFreelanceAt,
      signedByCompanyAt: row.acceptedByOrgAt,
      role,
      approvals: {
        // Comme la base : seules comptent les validations de personnes encore administratrices, jamais plus que d'administrateurs.
        count: row.approvals.filter((a) => a.userId !== null && admins.includes(a.userId)).length,
        mine: row.approvals.some((a) => a.userId === actor.userId),
        required: Math.max(1, Math.min(row.organisation?.approvalLevels ?? 1, admins.length)),
      },
      conversationId: row.quote?.conversationId ?? null,
    };
  },
});

export type ContractView = ReturnType<typeof contractView>;
