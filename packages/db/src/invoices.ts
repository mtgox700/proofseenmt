import { z } from "zod";
import { LegalSnapshotSchema, type LegalSnapshot } from "./billing";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { InvoiceKind } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Factures. Deux sortes, deux émetteurs :
 *  - la facture de la mission, émise par Proofseen **au nom et pour le compte du freelance** (mandat de facturation),
 *    adressée à l'entreprise, dans la série de numéros propre à ce freelance ;
 *  - la facture de commission, émise par Proofseen, adressée au freelance, dans la série de Proofseen.
 *
 * Le numéro est attribué dans la transaction qui crée la facture : si elle échoue, le compteur revient en arrière, et
 * la série reste sans trou. L'émission est idempotente (une facture de chaque sorte par contrat, garanti par la base) :
 * un paiement notifié deux fois rend la facture déjà émise. Une facture émise ne se modifie ni ne se supprime.
 *
 * La facture de commission n'est montrée qu'au freelance : l'entreprise n'a pas à connaître ce que Proofseen prélève.
 */

export const PROOFSEEN_ISSUER = "proofseen";
/** Délai de paiement par défaut entre professionnels : 30 jours (art. L441-10 du code de commerce). */
export const DEFAULT_PAYMENT_TERM_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const Uuid = z.uuid();

export interface InvoiceRecord {
  readonly id: string;
  readonly number: string;
  readonly kind: InvoiceKind;
  readonly contractId: string;
  readonly label: string;
  readonly netCents: number;
  readonly vatCents: number;
  readonly vatRateBp: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly seller: LegalSnapshot;
  readonly buyer: LegalSnapshot;
  readonly issuedAt: Date;
  readonly dueOn: Date;
}

export type IssueResult =
  | { readonly kind: "issued" | "existing"; readonly invoice: InvoiceRecord }
  /** Le contrat n'est pas terminé, n'existe pas, ou le freelance a supprimé son compte avant la facturation. */
  | { readonly kind: "not_invoiceable" };

export interface Invoices {
  /** Émet la facture de la mission d'un contrat terminé, au nom du freelance. */
  issueMission(contractId: string, now: Date): Promise<IssueResult>;
  /** Émet la facture de la commission prélevée, de Proofseen au freelance. */
  issueCommission(contractId: string, commissionCents: number, proofseen: LegalSnapshot, now: Date): Promise<IssueResult>;
  /** Les factures que l'acteur peut voir. */
  listMine(actor: Actor): Promise<readonly InvoiceRecord[]>;
  find(actor: Actor, invoiceId: string): Promise<InvoiceRecord | null>;
}

const SELECT = {
  id: true,
  number: true,
  kind: true,
  contractId: true,
  label: true,
  netCents: true,
  vatCents: true,
  vatRateBp: true,
  totalCents: true,
  currency: true,
  sellerSnapshot: true,
  buyerSnapshot: true,
  issuedAt: true,
  dueOn: true,
} as const;

type Row = Prisma.InvoiceGetPayload<{ select: typeof SELECT }>;

const toRecord = ({ sellerSnapshot, buyerSnapshot, ...row }: Row): InvoiceRecord => ({
  ...row,
  seller: LegalSnapshotSchema.parse(sellerSnapshot),
  buyer: LegalSnapshotSchema.parse(buyerSnapshot),
});

/** TVA arrondie au centime le plus proche. */
export const vatOf = (netCents: number, rateBp: number): number => Math.round((netCents * rateBp) / 10_000);

const allocate = async (tx: Prisma.TransactionClient, issuer: string, year: number): Promise<number> => {
  const [row] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceSequence" ("issuer", "year", "last") VALUES (${issuer}, ${year}, 1)
    ON CONFLICT ("issuer", "year") DO UPDATE SET "last" = "InvoiceSequence"."last" + 1
    RETURNING "last"`;
  if (row === undefined) throw new Error("numéro de facture non attribué");
  return Number(row.last);
};

const dateLabel = (d: Date): string => d.toISOString().slice(0, 10);

/** L'année civile à Paris : une facture émise le 1er janvier à 0 h 30 appartient à la nouvelle année. */
export const parisYear = (d: Date): number => Number(new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Europe/Paris" }).format(d));

/** Ce que voit l'acteur : toutes les factures de ses contrats côté freelance ; seulement celles de mission côté entreprise. */
const visibleTo = (userId: string): Prisma.InvoiceWhereInput => ({
  OR: [
    { contract: { profile: { userId } } },
    { kind: "mission", contract: { organisation: { members: { some: { userId } } } } },
  ],
});

const issue = async (
  db: Db,
  contractId: string,
  kind: InvoiceKind,
  build: (c: { profileId: string; reference: string; seller: LegalSnapshot; buyer: LegalSnapshot; netCents: number; currency: string; days: number; startsOn: Date; endsOn: Date | null }) => {
    issuer: string;
    prefix: string;
    label: string;
    netCents: number;
    vatRateBp: number;
    seller: LegalSnapshot;
    buyer: LegalSnapshot;
  },
  now: Date,
): Promise<IssueResult> => {
  if (!Uuid.safeParse(contractId).success) return { kind: "not_invoiceable" };
  const existing = await db.invoice.findUnique({ where: { contractId_kind: { contractId, kind } }, select: SELECT });
  if (existing !== null) return { kind: "existing", invoice: toRecord(existing) };
  try {
    return await db.$transaction(async (tx): Promise<IssueResult> => {
      const c = await tx.contract.findFirst({
        where: { id: contractId, status: "completed" },
        select: { profileId: true, totalCents: true, currency: true, days: true, startsOn: true, endsOn: true, sellerSnapshot: true, buyerSnapshot: true, profile: { select: { reference: true } } },
      });
      if (c === null || c.profileId === null || c.profile === null) return { kind: "not_invoiceable" };
      const spec = build({
        profileId: c.profileId,
        reference: c.profile.reference,
        seller: LegalSnapshotSchema.parse(c.sellerSnapshot),
        buyer: LegalSnapshotSchema.parse(c.buyerSnapshot),
        netCents: c.totalCents,
        currency: c.currency,
        days: c.days,
        startsOn: c.startsOn,
        endsOn: c.endsOn,
      });
      const year = parisYear(now);
      const sequence = await allocate(tx, spec.issuer, year);
      const vatCents = vatOf(spec.netCents, spec.vatRateBp);
      const row = await tx.invoice.create({
        data: {
          number: `${spec.prefix}-${year}-${String(sequence).padStart(4, "0")}`,
          kind,
          issuer: spec.issuer,
          contractId,
          label: spec.label,
          netCents: spec.netCents,
          vatCents,
          vatRateBp: spec.vatRateBp,
          totalCents: spec.netCents + vatCents,
          currency: c.currency,
          sellerSnapshot: spec.seller as unknown as Prisma.InputJsonObject,
          buyerSnapshot: spec.buyer as unknown as Prisma.InputJsonObject,
          issuedAt: now,
          dueOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DEFAULT_PAYMENT_TERM_DAYS * DAY_MS),
        },
        select: SELECT,
      });
      return { kind: "issued", invoice: toRecord(row) };
    });
  } catch (error) {
    // Deux émissions simultanées : la base n'a gardé que la première, et l'autre transaction a rendu son numéro.
    if (!isUniqueViolation(error)) throw error;
    const winner = await db.invoice.findUnique({ where: { contractId_kind: { contractId, kind } }, select: SELECT });
    if (winner === null) throw error;
    return { kind: "existing", invoice: toRecord(winner) };
  }
};

export const invoices = (db: Db): Invoices => ({
  issueMission(contractId, now) {
    return issue(
      db,
      contractId,
      "mission",
      (c) => ({
        issuer: c.profileId,
        prefix: c.reference,
        label: `Prestation de services : ${c.days} jour${c.days > 1 ? "s" : ""}, du ${dateLabel(c.startsOn)}${c.endsOn === null ? "" : ` au ${dateLabel(c.endsOn)}`}`,
        netCents: c.netCents,
        vatRateBp: c.seller.vatRateBp ?? 0,
        seller: c.seller,
        buyer: c.buyer,
      }),
      now,
    );
  },

  issueCommission(contractId, commissionCents, proofseen, now) {
    if (!Number.isInteger(commissionCents) || commissionCents <= 0) throw new Error("commission invalide");
    return issue(
      db,
      contractId,
      "commission",
      (c) => ({
        issuer: PROOFSEEN_ISSUER,
        prefix: "PS",
        label: `Commission d'intermédiation sur la mission facturée ${c.reference}`,
        netCents: commissionCents,
        // La commission est un service de Proofseen, soumis au taux normal.
        vatRateBp: 2000,
        seller: { ...proofseen, vatRateBp: 2000 },
        buyer: { ...c.seller, vatRateBp: null },
      }),
      now,
    );
  },

  async listMine(actor) {
    const rows = await db.invoice.findMany({ where: visibleTo(actor.userId), orderBy: [{ issuedAt: "desc" }, { id: "desc" }], select: SELECT });
    return rows.map(toRecord);
  },

  async find(actor, invoiceId) {
    if (!Uuid.safeParse(invoiceId).success) return null;
    const row = await db.invoice.findFirst({ where: { id: invoiceId, ...visibleTo(actor.userId) }, select: SELECT });
    return row === null ? null : toRecord(row);
  },
});
