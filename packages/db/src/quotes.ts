import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { ContractBilling, QuoteStatus } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Devis. Le freelance le rédige et l'envoie dans une conversation acceptée ; l'entreprise l'accepte ou le décline.
 * Envoyer un nouveau devis remplace le précédent encore en attente : il n'y a jamais deux propositions concurrentes
 * dans un même fil. Le total est toujours recalculé ici, jamais reçu : un client ne fixe pas le montant qu'il paie.
 *
 * La base garde les mêmes règles (devis seulement dans un fil accepté, montants figés une fois envoyé, un seul devis
 * accepté par fil) : ce module répond clairement, elle empêche tout autre chemin.
 */

const Uuid = z.uuid();

/**
 * Plancher d'un devis (100 dans la devise). En deçà, un contrat ne rémunère aucune prestation réelle : il sert à acheter
 * un avis pour quelques centimes, et les frais fixes du paiement dépassent la commission.
 */
export const MIN_QUOTE_TOTAL_CENTS = 10_000;
export const BELOW_MINIMUM = "devis sous le montant minimum";

export const QuoteInputSchema = z
  .object({
    dailyRateCents: z.number().int().min(1).max(10_000_000),
    days: z.number().int().min(1).max(1000),
    currency: z.enum(["EUR", "GBP", "CHF", "USD"]).default("EUR"),
    /** Forfait (un montant) ou régie (un plafond de jours, facturé chaque mois sur relevé validé). */
    billing: z.enum(["fixed", "monthly"]).default("fixed"),
  })
  .refine((q) => q.dailyRateCents * q.days >= MIN_QUOTE_TOTAL_CENTS, { message: BELOW_MINIMUM });

export type QuoteInput = z.input<typeof QuoteInputSchema>;

export interface QuoteRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly dailyRateCents: number;
  readonly days: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly billing: ContractBilling;
  readonly status: QuoteStatus;
  readonly createdAt: Date;
}

export type DecideQuoteResult = { readonly kind: "ok"; readonly quote: QuoteRecord } | { readonly kind: "already_accepted" } | { readonly kind: "absent" };

export interface Quotes {
  /** Brouillon rédigé par le freelance du fil ; `null` pour tout autre acteur ou un fil non accepté. */
  draft(actor: Actor, conversationId: string, input: QuoteInput): Promise<QuoteRecord | null>;
  /** Envoie un brouillon, et remplace le devis encore en attente du même fil. */
  send(actor: Actor, quoteId: string): Promise<QuoteRecord | null>;
  /** Un membre de l'entreprise accepte ou décline un devis envoyé. */
  decide(actor: Actor, quoteId: string, decision: "accepted" | "declined"): Promise<DecideQuoteResult>;
  /** Les devis d'un fil, pour ses deux parties ; `null` pour les autres. L'entreprise ne voit pas les brouillons. */
  list(actor: Actor, conversationId: string): Promise<readonly QuoteRecord[] | null>;
}

const SELECT = { id: true, conversationId: true, dailyRateCents: true, days: true, totalCents: true, currency: true, billing: true, status: true, createdAt: true } as const;

const freelanceOf = (userId: string) => ({ conversation: { profile: { userId } } });
/** Accepter un devis engage l'entreprise : propriétaires et administrateurs seulement, dans un fil encore ouvert. */
const deciderOf = (userId: string) => ({ conversation: { status: "accepted" as const, organisation: { members: { some: { userId, role: { in: ["owner" as const, "admin" as const] } } } } } });

export const quotes = (db: Db): Quotes => ({
  async draft(actor, conversationId, raw) {
    if (!Uuid.safeParse(conversationId).success) return null;
    const input = QuoteInputSchema.parse(raw);
    const conversation = await db.conversation.count({ where: { id: conversationId, status: "accepted", profile: { userId: actor.userId } } });
    if (conversation === 0) return null;
    return db.quote.create({
      data: { conversationId, dailyRateCents: input.dailyRateCents, days: input.days, totalCents: input.dailyRateCents * input.days, currency: input.currency, billing: input.billing },
      select: SELECT,
    });
  },

  async send(actor, quoteId) {
    if (!Uuid.safeParse(quoteId).success) return null;
    return db.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({ where: { id: quoteId, status: "draft", ...freelanceOf(actor.userId) }, select: { conversationId: true } });
      if (quote === null) return null;
      await tx.quote.updateMany({ where: { conversationId: quote.conversationId, status: "sent" }, data: { status: "superseded" } });
      return tx.quote.update({ where: { id: quoteId }, data: { status: "sent" }, select: SELECT });
    });
  },

  async decide(actor, quoteId, decision) {
    if (!Uuid.safeParse(quoteId).success) return { kind: "absent" };
    try {
      const { count } = await db.quote.updateMany({ where: { id: quoteId, status: "sent", ...deciderOf(actor.userId) }, data: { status: decision } });
      if (count === 0) return { kind: "absent" };
    } catch (error) {
      // L'index unique « un seul devis accepté par fil » a refusé : un autre devis du fil est déjà accepté.
      if (isUniqueViolation(error)) return { kind: "already_accepted" };
      throw error;
    }
    return { kind: "ok", quote: await db.quote.findUniqueOrThrow({ where: { id: quoteId }, select: SELECT }) };
  },

  async list(actor, conversationId) {
    if (!Uuid.safeParse(conversationId).success) return null;
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, OR: [{ profile: { userId: actor.userId } }, { organisation: { members: { some: { userId: actor.userId } } } }] },
      select: { profile: { select: { userId: true } } },
    });
    if (conversation === null) return null;
    const isFreelance = conversation.profile.userId === actor.userId;
    return db.quote.findMany({
      where: { conversationId, ...(isFreelance ? {} : { status: { not: "draft" } }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: SELECT,
    });
  },
});
