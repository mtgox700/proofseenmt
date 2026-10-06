import { z } from "zod";
import type { Db } from "./client";
import { freelanceSnapshot, organisationSnapshot } from "./billing";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { ContractStatus } from "./generated/enums";
import type { Actor } from "./messaging";
import { notifications } from "./notifications";

/*
 * Contrats. Un contrat naît d'un devis accepté et en reprend exactement les conditions ; il fige l'identité légale des
 * deux parties au moment de sa création (une adresse modifiée plus tard ne réécrit pas un contrat signé).
 *
 * Signature : chaque partie accepte de son côté, horodatée ; le contrat devient actif quand la seconde signe, dans la
 * même instruction, de sorte que deux signatures simultanées ne peuvent pas laisser un contrat signé deux fois mais
 * resté « en attente ». L'entreprise valide ensuite la prestation : le contrat est terminé, et c'est ce qui libérera
 * le paiement.
 *
 * La base garde les mêmes règles (conditions et parties figées, parcours de statuts fermé, signatures non retirables).
 */

const Uuid = z.uuid();
const DateOnly = z.iso.date().transform((d) => new Date(`${d}T00:00:00Z`));

export const ContractDraftSchema = z
  .object({ startsOn: DateOnly, endsOn: DateOnly.nullable().default(null) })
  .refine((c) => c.endsOn === null || c.endsOn >= c.startsOn, { message: "la fin précède le début" });

export type ContractDraft = z.input<typeof ContractDraftSchema>;

export interface ContractRecord {
  readonly id: string;
  readonly quoteId: string | null;
  readonly organisationId: string | null;
  readonly profileId: string | null;
  readonly dailyRateCents: number;
  readonly days: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly startsOn: Date;
  readonly endsOn: Date | null;
  readonly acceptedByFreelanceAt: Date | null;
  readonly acceptedByOrgAt: Date | null;
  readonly status: ContractStatus;
}

export type CreateContractResult =
  | { readonly kind: "created"; readonly contract: ContractRecord }
  /** Le freelance n'a pas renseigné son identité de facturation : pas de contrat sans émetteur de facture. */
  | { readonly kind: "seller_identity_missing" }
  /** L'entreprise n'a pas renseigné son adresse de facturation. */
  | { readonly kind: "buyer_identity_missing" }
  | { readonly kind: "already_exists" }
  | { readonly kind: "absent" };

export type CompleteResult =
  | { readonly kind: "completed"; readonly contract: ContractRecord }
  /** Aucun paiement bloqué : l'entreprise doit d'abord payer. */
  | { readonly kind: "not_paid" }
  | { readonly kind: "absent" };

export interface Contracts {
  /** L'une ou l'autre partie crée le contrat d'un devis accepté. */
  createFromQuote(actor: Actor, quoteId: string, draft: ContractDraft): Promise<CreateContractResult>;
  /** L'acteur signe pour son côté ; le contrat devient actif à la seconde signature. */
  sign(actor: Actor, contractId: string, now: Date): Promise<ContractRecord | null>;
  /** Un membre de l'entreprise valide la prestation : le contrat actif est terminé. */
  complete(actor: Actor, contractId: string): Promise<CompleteResult>;
  /** L'une ou l'autre partie annule un contrat pas encore signé par les deux. */
  cancel(actor: Actor, contractId: string): Promise<ContractRecord | null>;
  /** Un contrat, pour ses parties ; `null` pour les autres. */
  find(actor: Actor, contractId: string): Promise<ContractRecord | null>;
  listMine(actor: Actor): Promise<readonly ContractRecord[]>;
}

const SELECT = {
  id: true,
  quoteId: true,
  organisationId: true,
  profileId: true,
  dailyRateCents: true,
  days: true,
  totalCents: true,
  currency: true,
  startsOn: true,
  endsOn: true,
  acceptedByFreelanceAt: true,
  acceptedByOrgAt: true,
  status: true,
} as const;

const party = (userId: string): Prisma.ContractWhereInput => ({
  OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }],
});

/*
 * Prévient les parties d'un contrat, sauf l'auteur de l'action. « to_sign » : l'autre partie doit signer ; « active » :
 * les deux ont signé ; « completed » : la prestation est validée.
 */
const notifyParties = async (db: Db, tx: Prisma.TransactionClient, contractId: string, status: "to_sign" | "active" | "completed", authorId: string): Promise<void> => {
  const c = await tx.contract.findUniqueOrThrow({ where: { id: contractId }, select: { profile: { select: { userId: true } }, organisationId: true } });
  const members = c.organisationId === null ? [] : await tx.membership.findMany({ where: { organisationId: c.organisationId }, select: { userId: true } });
  const recipients = [...(c.profile === null ? [] : [c.profile.userId]), ...members.map((m) => m.userId)].filter((id) => id !== authorId);
  await notifications(db).enqueue(tx, recipients, "contract_update", { contractId, status });
};

export const contracts = (db: Db): Contracts => ({
  async createFromQuote(actor, quoteId, raw) {
    if (!Uuid.safeParse(quoteId).success) return { kind: "absent" };
    const draft = ContractDraftSchema.parse(raw);
    try {
      return await db.$transaction(async (tx): Promise<CreateContractResult> => {
        const quote = await tx.quote.findFirst({
          where: {
            id: quoteId,
            status: "accepted",
            conversation: { OR: [{ profile: { userId: actor.userId } }, { organisation: { members: { some: { userId: actor.userId } } } }] },
          },
          select: { dailyRateCents: true, days: true, totalCents: true, currency: true, conversation: { select: { organisationId: true, profileId: true } } },
        });
        if (quote === null) return { kind: "absent" };
        const { organisationId, profileId } = quote.conversation;
        if ((await tx.contract.count({ where: { quoteId } })) > 0) return { kind: "already_exists" };
        const seller = await freelanceSnapshot(tx, profileId);
        if (seller === null) return { kind: "seller_identity_missing" };
        const buyer = await organisationSnapshot(tx, organisationId);
        if (buyer === null) return { kind: "buyer_identity_missing" };
        const contract = await tx.contract.create({
          data: {
            quoteId,
            organisationId,
            profileId,
            dailyRateCents: quote.dailyRateCents,
            days: quote.days,
            totalCents: quote.totalCents,
            currency: quote.currency,
            sellerSnapshot: seller as unknown as Prisma.InputJsonObject,
            buyerSnapshot: buyer as unknown as Prisma.InputJsonObject,
            startsOn: draft.startsOn,
            endsOn: draft.endsOn,
          },
          select: SELECT,
        });
        await notifyParties(db, tx, contract.id, "to_sign", actor.userId);
        return { kind: "created", contract };
      });
    } catch (error) {
      // Deux créations simultanées du même devis : l'unicité du devis sur le contrat a départagé.
      if (isUniqueViolation(error)) return { kind: "already_exists" };
      throw error;
    }
  },

  async sign(actor, contractId, now) {
    if (!Uuid.safeParse(contractId).success) return null;
    return db.$transaction(async (tx) => {
      const contract = await tx.contract.findFirst({
        where: { id: contractId, status: "pending_signatures", ...party(actor.userId) },
        select: { profile: { select: { userId: true } }, organisationId: true },
      });
      if (contract === null) return null;
      const side = contract.profile?.userId === actor.userId ? "acceptedByFreelanceAt" : "acceptedByOrgAt";
      // La signature et le passage en « actif » dans une seule instruction : la seconde signature voit la première.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "Contract" SET
          "acceptedByFreelanceAt" = CASE WHEN ${side} = 'acceptedByFreelanceAt' THEN COALESCE("acceptedByFreelanceAt", ${now}) ELSE "acceptedByFreelanceAt" END,
          "acceptedByOrgAt" = CASE WHEN ${side} = 'acceptedByOrgAt' THEN COALESCE("acceptedByOrgAt", ${now}) ELSE "acceptedByOrgAt" END,
          "status" = CASE
            WHEN (CASE WHEN ${side} = 'acceptedByFreelanceAt' THEN true ELSE "acceptedByFreelanceAt" IS NOT NULL END)
             AND (CASE WHEN ${side} = 'acceptedByOrgAt' THEN true ELSE "acceptedByOrgAt" IS NOT NULL END)
            THEN 'active'::"ContractStatus" ELSE "status" END,
          "updatedAt" = ${now}
        WHERE "id" = ${contractId}::uuid AND "status" = 'pending_signatures'
        RETURNING "id"`;
      if (rows.length === 0) return null;
      const signed = await tx.contract.findUniqueOrThrow({ where: { id: contractId }, select: SELECT });
      if (signed.status === "active") await notifyParties(db, tx, contractId, "active", actor.userId);
      return signed;
    });
  },

  async complete(actor, contractId) {
    if (!Uuid.safeParse(contractId).success) return { kind: "absent" };
    return db.$transaction(async (tx): Promise<CompleteResult> => {
      // Valider déclenche le versement : réservé aux administrateurs de l'entreprise, jamais au freelance du contrat.
      const mine = { id: contractId, status: "active" as const, organisation: { members: { some: { userId: actor.userId, role: { in: ["owner" as const, "admin" as const] } } } }, NOT: { profile: { userId: actor.userId } } };
      if ((await tx.contract.count({ where: mine })) === 0) return { kind: "absent" };
      // Sans fonds bloqués, valider laisserait le freelance sans paiement possible : la base le refuse aussi.
      if ((await tx.payment.count({ where: { contractId, status: "held" } })) === 0) return { kind: "not_paid" };
      await tx.contract.update({ where: { id: contractId }, data: { status: "completed" } });
      await notifyParties(db, tx, contractId, "completed", actor.userId);
      return { kind: "completed", contract: await tx.contract.findUniqueOrThrow({ where: { id: contractId }, select: SELECT }) };
    });
  },

  async cancel(actor, contractId) {
    if (!Uuid.safeParse(contractId).success) return null;
    const { count } = await db.contract.updateMany({ where: { id: contractId, status: "pending_signatures", ...party(actor.userId) }, data: { status: "cancelled" } });
    return count === 1 ? db.contract.findUniqueOrThrow({ where: { id: contractId }, select: SELECT }) : null;
  },

  async find(actor, contractId) {
    if (!Uuid.safeParse(contractId).success) return null;
    return db.contract.findFirst({ where: { id: contractId, ...party(actor.userId) }, select: SELECT });
  },

  async listMine(actor) {
    return db.contract.findMany({ where: party(actor.userId), orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: SELECT });
  },
});
