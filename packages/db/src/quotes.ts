import { z } from "zod";
import type { Db } from "./client";
import { containsDirectContact, NO_CONTACT } from "./contact-detection";
import { isUniqueViolation } from "./errors";
import type { ContractBilling, QuoteStatus } from "./generated/enums";
import { parisDay } from "./invoice-settlement";
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
export const VALIDITY_PAST = "validité du devis déjà passée";

/** Plafonds de l'objet et des livrables : les mêmes en base (CHECK) et ici. */
export const MAX_SCOPE_CHARS = 6000;
export const MAX_DELIVERABLES = 30;
const MAX_DELIVERABLE_CHARS = 300;

/** Un texte libre de devis : le même refus des coordonnées directes que la messagerie, avant qu'un contrat payé existe. */
const freeText = (max: number) => z.string().trim().min(1).max(max).refine((text) => !containsDirectContact(text), { message: NO_CONTACT });

/** Le jour (à Paris) d'aujourd'hui, au format AAAA-MM-JJ. */
const todayIso = (): string => parisDay(new Date()).toISOString().slice(0, 10);

/** L'objet de la prestation manque, ou n'est que des espaces : un devis sans objet ne dit pas ce que le freelance s'engage à faire. */
export const SCOPE_REQUIRED = "objet de la prestation requis";

const QuoteObject = z.object({
  dailyRateCents: z.number().int().min(1).max(10_000_000),
  days: z.number().int().min(1).max(1000),
  currency: z.enum(["EUR", "GBP", "CHF", "USD"]).default("EUR"),
  /** Forfait (un montant) ou régie (un plafond de jours, facturé chaque mois sur relevé validé). */
  billing: z.enum(["fixed", "monthly"]).default("fixed"),
  /** L'objet de la prestation, déterminé ou déterminable (Code civil 1163). Figé à l'envoi, recopié au contrat. */
  scope: freeText(MAX_SCOPE_CHARS).optional(),
  /** Les livrables, un par entrée. Facultatifs. */
  deliverables: z.array(freeText(MAX_DELIVERABLE_CHARS)).max(MAX_DELIVERABLES).default([]),
  /** Dernier jour pour accepter le devis (AAAA-MM-JJ), strictement après aujourd'hui ; absent : pas de durée fixée. */
  validUntil: z.iso.date().optional(),
});

type QuoteFields = z.output<typeof QuoteObject>;
const atLeastTheFloor = (q: QuoteFields): boolean => q.dailyRateCents * q.days >= MIN_QUOTE_TOTAL_CENTS;
const validityInTheFuture = (q: QuoteFields): boolean => q.validUntil === undefined || q.validUntil > todayIso();

/**
 * Le devis tel que le dépôt le lit : l'objet y reste facultatif, parce que les devis d'avant l'objet obligatoire existent et
 * se lisent (et se rejouent dans les tests). Les frontières d'écriture (API, action) utilisent `NewQuoteInputSchema`.
 */
export const QuoteInputSchema = QuoteObject.refine(atLeastTheFloor, { message: BELOW_MINIMUM }).refine(validityInTheFuture, { message: VALIDITY_PAST });

/**
 * Un NOUVEAU devis, à l'envoi : l'objet de la prestation est obligatoire (Code civil 1163, L1-134), les livrables restent
 * facultatifs. Les devis déjà écrits sans objet ne sont pas touchés.
 */
export const NewQuoteInputSchema = QuoteObject.extend({
  scope: z.string({ error: SCOPE_REQUIRED }).trim().min(1, { error: SCOPE_REQUIRED }).max(MAX_SCOPE_CHARS).refine((text) => !containsDirectContact(text), { message: NO_CONTACT }),
})
  .refine(atLeastTheFloor, { message: BELOW_MINIMUM })
  .refine(validityInTheFuture, { message: VALIDITY_PAST });

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
  /** L'objet de la prestation ; nul pour un devis d'avant (jamais inventé). */
  readonly scope: string | null;
  readonly deliverables: readonly string[];
  /** Dernier jour pour accepter le devis ; nul : pas de durée fixée. */
  readonly validUntil: Date | null;
  /** Le moment où l'entreprise l'a accepté ; nul tant qu'il ne l'est pas, et pour l'historique. */
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
}

export type DecideQuoteResult =
  | { readonly kind: "ok"; readonly quote: QuoteRecord }
  | { readonly kind: "already_accepted" }
  /** Le devis envoyé a dépassé sa durée de validité : il ne s'accepte plus. */
  | { readonly kind: "expired" }
  | { readonly kind: "absent" };

export interface Quotes {
  /** Brouillon rédigé par le freelance du fil ; `null` pour tout autre acteur ou un fil non accepté. */
  draft(actor: Actor, conversationId: string, input: QuoteInput): Promise<QuoteRecord | null>;
  /** Envoie un brouillon, et remplace le devis encore en attente du même fil. */
  send(actor: Actor, quoteId: string): Promise<QuoteRecord | null>;
  /**
   * Un membre de l'entreprise accepte ou décline un devis envoyé. L'acceptation pose le moment (`acceptedAt`, `now`) et
   * est refusée (« expired ») au-delà de la durée de validité du devis.
   */
  decide(actor: Actor, quoteId: string, decision: "accepted" | "declined", now?: Date): Promise<DecideQuoteResult>;
  /** Les devis d'un fil, pour ses deux parties ; `null` pour les autres. L'entreprise ne voit pas les brouillons. */
  list(actor: Actor, conversationId: string): Promise<readonly QuoteRecord[] | null>;
}

const SELECT = {
  id: true,
  conversationId: true,
  dailyRateCents: true,
  days: true,
  totalCents: true,
  currency: true,
  billing: true,
  status: true,
  scope: true,
  deliverables: true,
  validUntil: true,
  acceptedAt: true,
  createdAt: true,
} as const;

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
      data: {
        conversationId,
        dailyRateCents: input.dailyRateCents,
        days: input.days,
        totalCents: input.dailyRateCents * input.days,
        currency: input.currency,
        billing: input.billing,
        scope: input.scope ?? null,
        deliverables: input.deliverables,
        validUntil: input.validUntil === undefined ? null : new Date(`${input.validUntil}T00:00:00Z`),
      },
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

  async decide(actor, quoteId, decision, now = new Date()) {
    if (!Uuid.safeParse(quoteId).success) return { kind: "absent" };
    // Au-delà de sa durée de validité, un devis envoyé ne s'accepte plus (il peut toujours être décliné).
    const today = parisDay(now);
    if (decision === "accepted" && (await db.quote.count({ where: { id: quoteId, status: "sent", validUntil: { lt: today }, ...deciderOf(actor.userId) } })) > 0) return { kind: "expired" };
    try {
      const { count } = await db.quote.updateMany({
        where: { id: quoteId, status: "sent", ...deciderOf(actor.userId) },
        data: { status: decision, ...(decision === "accepted" ? { acceptedAt: now } : {}) },
      });
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
