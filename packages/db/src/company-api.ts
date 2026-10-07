import { z } from "zod";
import { LegalSnapshotSchema } from "./billing";
import type { Db } from "./client";
import type { ContractBilling, ContractStatus } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Ce qu'une entreprise lit de ses propres données, par clé d'API ou pour son export comptable : ses contrats et les
 * factures de mission qui lui sont adressées. Jamais la facture de commission, adressée au freelance et qui ne la regarde
 * pas, ni rien d'une autre entreprise : chaque requête est bornée par l'identifiant de l'entreprise appelante.
 */

const Uuid = z.uuid();
export const API_PAGE_MAX = 100;
/** Plafond d'un export comptable : au-delà, l'entreprise réduit la période. */
export const EXPORT_MAX_ROWS = 5_000;

export const ApiPageSchema = z.object({
  after: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).default(50),
});
export type ApiPage = z.infer<typeof ApiPageSchema>;

export interface ApiContract {
  readonly id: string;
  readonly status: ContractStatus;
  readonly billing: ContractBilling;
  readonly costCenter: string | null;
  readonly freelance: { readonly reference: string | null; readonly legalName: string | null; readonly siret: string | null };
  readonly dailyRateCents: number;
  readonly days: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly createdAt: Date;
}

export interface ApiInvoice {
  readonly id: string;
  readonly number: string;
  readonly contractId: string;
  readonly costCenter: string | null;
  readonly label: string;
  readonly seller: { readonly legalName: string; readonly siret: string | null; readonly vatNumber: string | null };
  readonly netCents: number;
  readonly vatCents: number;
  readonly vatRateBp: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly issuedAt: Date;
  readonly dueOn: string;
}

export interface Paged<T> {
  readonly items: readonly T[];
  /** À passer en `after` pour la page suivante ; `null` à la dernière. */
  readonly next: string | null;
}

const day = (d: Date): string => d.toISOString().slice(0, 10);

const page = <T extends { readonly id: string }>(rows: readonly T[], limit: number): Paged<T> =>
  rows.length > limit ? { items: rows.slice(0, limit), next: rows[limit - 1]?.id ?? null } : { items: rows, next: null };

const missionInvoicesOf = (organisationId: string) => ({ kind: "mission" as const, contract: { organisationId } });

const INVOICE_SELECT = {
  id: true,
  number: true,
  contractId: true,
  label: true,
  sellerSnapshot: true,
  netCents: true,
  vatCents: true,
  vatRateBp: true,
  totalCents: true,
  currency: true,
  issuedAt: true,
  dueOn: true,
  contract: { select: { costCenter: true } },
} as const;

type InvoiceRow = {
  readonly id: string;
  readonly number: string;
  readonly contractId: string;
  readonly label: string;
  readonly sellerSnapshot: unknown;
  readonly netCents: number;
  readonly vatCents: number;
  readonly vatRateBp: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly issuedAt: Date;
  readonly dueOn: Date;
  readonly contract: { readonly costCenter: string | null };
};

const toInvoice = (row: InvoiceRow): ApiInvoice => {
  const seller = LegalSnapshotSchema.parse(row.sellerSnapshot);
  return {
    id: row.id,
    number: row.number,
    contractId: row.contractId,
    costCenter: row.contract.costCenter,
    label: row.label,
    seller: { legalName: seller.legalName, siret: seller.siret, vatNumber: seller.vatNumber },
    netCents: row.netCents,
    vatCents: row.vatCents,
    vatRateBp: row.vatRateBp,
    totalCents: row.totalCents,
    currency: row.currency,
    issuedAt: row.issuedAt,
    dueOn: day(row.dueOn),
  };
};

export const companyApi = (db: Db) => ({
  /** Les contrats de l'entreprise, du plus ancien au plus récent (identifiants ordonnés dans le temps). */
  async contracts(organisationId: string, request: ApiPage): Promise<Paged<ApiContract>> {
    const rows = await db.contract.findMany({
      where: { organisationId, ...(request.after === undefined ? {} : { id: { gt: request.after } }) },
      orderBy: { id: "asc" },
      take: request.limit + 1,
      select: {
        id: true,
        status: true,
        billing: true,
        costCenter: true,
        sellerSnapshot: true,
        dailyRateCents: true,
        days: true,
        totalCents: true,
        currency: true,
        startsOn: true,
        endsOn: true,
        createdAt: true,
        profile: { select: { reference: true } },
      },
    });
    const items = rows.map((row): ApiContract => {
      const seller = LegalSnapshotSchema.parse(row.sellerSnapshot);
      // L'identité légale du freelance n'est donnée qu'une fois le contrat signé des deux côtés : avant, ou s'il a été
      // annulé, il n'a pas consenti à ce qu'elle circule hors de la plateforme.
      const signed = row.status === "active" || row.status === "completed";
      return {
        id: row.id,
        status: row.status,
        billing: row.billing,
        costCenter: row.costCenter,
        freelance: { reference: row.profile?.reference ?? null, legalName: signed ? seller.legalName : null, siret: signed ? seller.siret : null },
        dailyRateCents: row.dailyRateCents,
        days: row.days,
        totalCents: row.totalCents,
        currency: row.currency,
        startsOn: day(row.startsOn),
        endsOn: row.endsOn === null ? null : day(row.endsOn),
        createdAt: row.createdAt,
      };
    });
    return page(items, request.limit);
  },

  /** Les factures de mission adressées à l'entreprise, de la plus ancienne à la plus récente. */
  async invoices(organisationId: string, request: ApiPage): Promise<Paged<ApiInvoice>> {
    const rows = await db.invoice.findMany({
      where: { ...missionInvoicesOf(organisationId), ...(request.after === undefined ? {} : { id: { gt: request.after } }) },
      orderBy: { id: "asc" },
      take: request.limit + 1,
      select: INVOICE_SELECT,
    });
    return page(rows.map(toInvoice), request.limit);
  },

  /**
   * L'export comptable d'une période d'émission, `from` inclus et `to` exclu ; `"too_many"` au-delà du plafond. L'appelant
   * a déjà vérifié le droit de lire (clé d'API de l'entreprise, ou `isAdmin`).
   */
  async exportInvoices(organisationId: string, from: Date, to: Date): Promise<readonly ApiInvoice[] | "too_many"> {
    const rows = await db.invoice.findMany({
      where: { ...missionInvoicesOf(organisationId), issuedAt: { gte: from, lt: to } },
      orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
      take: EXPORT_MAX_ROWS + 1,
      select: INVOICE_SELECT,
    });
    return rows.length > EXPORT_MAX_ROWS ? "too_many" : rows.map(toInvoice);
  },

  /** Vrai si l'acteur est propriétaire ou administrateur de l'entreprise. */
  async isAdmin(actor: Actor, organisationId: string): Promise<boolean> {
    if (!Uuid.safeParse(organisationId).success) return false;
    return (await db.membership.count({ where: { organisationId, userId: actor.userId, role: { in: ["owner", "admin"] } } })) === 1;
  },
});

export type CompanyApi = ReturnType<typeof companyApi>;
