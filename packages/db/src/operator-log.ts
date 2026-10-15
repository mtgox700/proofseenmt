import { z } from "zod";
import { assertOperator, type Operator } from "./back-office";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import { OperatorActionKind, OperatorTargetType } from "./generated/enums";

/*
 * Lecture du journal des opérateurs (C19), avec filtres. Le journal ne s'écrit que par `recordAction`, dans la
 * transaction de l'action ; il ne se modifie jamais (déclencheur en base) et part au bout de cinq ans (conservation).
 */

export const OPERATOR_LOG_PAGE_SIZE = 50;

export const OperatorLogFilterSchema = z.object({
  action: z.enum(OperatorActionKind).optional(),
  targetType: z.enum(OperatorTargetType).optional(),
  targetId: z.uuid().optional(),
  operatorUserId: z.uuid().optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  page: z.number().int().min(1).max(200).default(1),
});

export type OperatorLogFilter = z.input<typeof OperatorLogFilterSchema>;

export interface OperatorLogEntry {
  readonly id: string;
  readonly operatorUserId: string;
  /** L'adresse de l'opérateur, si son compte existe encore. */
  readonly operatorEmail: string | null;
  readonly action: OperatorActionKind;
  readonly targetType: OperatorTargetType;
  readonly targetId: string;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

export interface OperatorLog {
  list(filter: OperatorLogFilter): Promise<{ readonly items: readonly OperatorLogEntry[]; readonly hasMore: boolean }>;
}

const MetadataSchema = z.record(z.string(), z.unknown()).catch({});

export const operatorLog = (db: Db, operator: Operator): OperatorLog => {
  assertOperator(operator);
  return {
    async list(raw) {
      const f = OperatorLogFilterSchema.parse(raw);
      const where: Prisma.OperatorActionWhereInput = {
        ...(f.action === undefined ? {} : { action: f.action }),
        ...(f.targetType === undefined ? {} : { targetType: f.targetType }),
        ...(f.targetId === undefined ? {} : { targetId: f.targetId }),
        ...(f.operatorUserId === undefined ? {} : { operatorUserId: f.operatorUserId }),
        ...(f.from === undefined && f.to === undefined ? {} : { createdAt: { ...(f.from === undefined ? {} : { gte: f.from }), ...(f.to === undefined ? {} : { lt: f.to }) } }),
      };
      const rows = await db.operatorAction.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (f.page - 1) * OPERATOR_LOG_PAGE_SIZE,
        take: OPERATOR_LOG_PAGE_SIZE + 1,
      });
      const operatorIds = [...new Set(rows.map((r) => r.operatorUserId))];
      const operators = operatorIds.length === 0 ? [] : await db.user.findMany({ where: { id: { in: operatorIds } }, select: { id: true, email: true } });
      const emailOf = new Map(operators.map((o) => [o.id, o.email]));
      const items = rows.slice(0, OPERATOR_LOG_PAGE_SIZE).map((r) => ({
        id: r.id,
        operatorUserId: r.operatorUserId,
        operatorEmail: emailOf.get(r.operatorUserId) ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        metadata: MetadataSchema.parse(r.metadata),
        createdAt: r.createdAt,
      }));
      return { items, hasMore: rows.length > OPERATOR_LOG_PAGE_SIZE };
    },
  };
};
