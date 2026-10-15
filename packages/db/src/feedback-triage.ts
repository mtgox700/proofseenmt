import { z } from "zod";
import { assertOperator, recordAction, type Operator, type OperatorResult } from "./back-office";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import { FeedbackKind, FeedbackStatus, type FeedbackSide } from "./generated/enums";

/*
 * Classement des retours de la bêta par l'opérateur (C19) : nouveau, retenu, fait, écarté, avec une note interne.
 * L'auteur n'est pas montré (le texte suffit pour décider), sauf pour une contestation d'une décision d'opérateur :
 * pour y répondre, il faut savoir de quel compte elle vient.
 */

/** Le chemin sous lequel une personne conteste une décision d'opérateur depuis son espace. */
export const APPEAL_PAGE = "/app/contestation";

export const TriageFilterSchema = z.object({
  status: z.enum(FeedbackStatus).optional(),
  kind: z.enum(FeedbackKind).optional(),
  appealsOnly: z.boolean().default(false),
  page: z.number().int().min(1).max(100).default(1),
});

export type TriageFilter = z.input<typeof TriageFilterSchema>;

export const TriageInputSchema = z.object({
  status: z.enum(FeedbackStatus),
  note: z.string().trim().max(2000).transform((note) => (note === "" ? null : note)),
});

export interface TriageEntry {
  readonly id: string;
  readonly kind: FeedbackKind;
  readonly side: FeedbackSide;
  readonly page: string | null;
  readonly body: string;
  readonly status: FeedbackStatus;
  readonly triageNote: string | null;
  readonly triagedAt: Date | null;
  readonly createdAt: Date;
  /** Seulement pour une contestation : le compte qui la fait. */
  readonly appealUserId: string | null;
}

export interface FeedbackTriage {
  list(filter: TriageFilter): Promise<{ readonly items: readonly TriageEntry[]; readonly hasMore: boolean }>;
  countNew(): Promise<number>;
  triage(id: string, input: z.input<typeof TriageInputSchema>, now: Date): Promise<OperatorResult>;
}

export const TRIAGE_PAGE_SIZE = 50;
const Uuid = z.uuid();

export const feedbackTriage = (db: Db, operator: Operator): FeedbackTriage => {
  assertOperator(operator);
  return {
    async list(raw) {
      const f = TriageFilterSchema.parse(raw);
      const where: Prisma.FeedbackWhereInput = {
        ...(f.status === undefined ? {} : { status: f.status }),
        ...(f.kind === undefined ? {} : { kind: f.kind }),
        ...(f.appealsOnly ? { page: APPEAL_PAGE } : {}),
      };
      const rows = await db.feedback.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (f.page - 1) * TRIAGE_PAGE_SIZE,
        take: TRIAGE_PAGE_SIZE + 1,
        select: { id: true, kind: true, side: true, page: true, body: true, status: true, triageNote: true, triagedAt: true, createdAt: true, userId: true },
      });
      const items = rows.slice(0, TRIAGE_PAGE_SIZE).map(({ userId, ...row }) => ({ ...row, appealUserId: row.page === APPEAL_PAGE ? userId : null }));
      return { items, hasMore: rows.length > TRIAGE_PAGE_SIZE };
    },

    countNew: () => db.feedback.count({ where: { status: "new" } }),

    async triage(id, raw, now) {
      const input = TriageInputSchema.parse(raw);
      if (!Uuid.safeParse(id).success) return "absent";
      return db.$transaction(async (tx): Promise<OperatorResult> => {
        const { count } = await tx.feedback.updateMany({ where: { id }, data: { status: input.status, triageNote: input.note, triagedAt: now } });
        if (count === 0) return "absent";
        await recordAction(tx, operator, { action: "feedback_triaged", targetType: "feedback", targetId: id, reason: null, metadata: { status: input.status, noted: input.note !== null } }, now);
        return "done";
      });
    },
  };
};
