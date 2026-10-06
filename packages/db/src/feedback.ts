import { z } from "zod";
import type { Db } from "./client";
import type { FeedbackKind, FeedbackSide } from "./generated/enums";

/*
 * Retours de la bêta : ce qui ne marche pas, ce qui manque, les idées. Classés par nature et par côté (freelance,
 * entreprise, visiteur), lus par le founder en totaux puis en texte. Jamais rattachés à un classement de personnes.
 */

const PAGE = /^\/[A-Za-z0-9/_.-]{0,199}$/;

export const FeedbackInputSchema = z.object({
  kind: z.enum(["bug", "missing", "idea", "other"]),
  side: z.enum(["freelance", "company", "visitor"]),
  // Le chemin seul : une adresse complète avec ses paramètres pourrait porter un jeton.
  page: z
    .string()
    .trim()
    .transform((p) => p.split(/[?#]/)[0] ?? "")
    .pipe(z.string().regex(PAGE))
    .nullable()
    .default(null),
  body: z.string().trim().min(5).max(2000),
});

export type FeedbackInput = z.input<typeof FeedbackInputSchema>;

export interface FeedbackSummary {
  readonly total: number;
  readonly byKind: Readonly<Partial<Record<FeedbackKind, number>>>;
  readonly bySide: Readonly<Partial<Record<FeedbackSide, number>>>;
}

export interface FeedbackEntry {
  readonly kind: FeedbackKind;
  readonly side: FeedbackSide;
  readonly page: string | null;
  readonly body: string;
  readonly createdAt: Date;
}

export interface FeedbackPeriod {
  readonly from?: Date;
  readonly to?: Date;
}

const range = (p: FeedbackPeriod) => ({ createdAt: { ...(p.from === undefined ? {} : { gte: p.from }), ...(p.to === undefined ? {} : { lt: p.to }) } });

export const feedback = (db: Db) => ({
  /** Enregistre un retour ; `userId` nul pour un visiteur non connecté. */
  async submit(userId: string | null, raw: FeedbackInput): Promise<{ readonly id: string }> {
    const input = FeedbackInputSchema.parse(raw);
    return db.feedback.create({ data: { userId, kind: input.kind, side: input.side, page: input.page, body: input.body }, select: { id: true } });
  },

  async summary(period: FeedbackPeriod = {}): Promise<FeedbackSummary> {
    const [kinds, sides] = await Promise.all([
      db.feedback.groupBy({ by: ["kind"], where: range(period), _count: { _all: true } }),
      db.feedback.groupBy({ by: ["side"], where: range(period), _count: { _all: true } }),
    ]);
    return {
      total: kinds.reduce((sum, k) => sum + k._count._all, 0),
      byKind: Object.fromEntries(kinds.map((k) => [k.kind, k._count._all])),
      bySide: Object.fromEntries(sides.map((s) => [s.side, s._count._all])),
    };
  },

  /** Les derniers retours d'une nature, sans auteur : le texte suffit pour décider. */
  async latest(kind: FeedbackKind, limit: number, period: FeedbackPeriod = {}): Promise<readonly FeedbackEntry[]> {
    return db.feedback.findMany({
      where: { kind, ...range(period) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(limit, 1), 200),
      select: { kind: true, side: true, page: true, body: true, createdAt: true },
    });
  },
});
