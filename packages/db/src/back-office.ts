import { z } from "zod";
import type { Prisma } from "./generated/client";
import type { OperatorActionKind, OperatorTargetType } from "./generated/enums";

/*
 * Le socle du back-office opérateur (C19) : qui peut agir, comment une action est journalisée, comment la personne
 * concernée est prévenue.
 *
 * Le rôle d'opérateur vient de la liste OPERATOR_EMAILS du serveur, vérifiée sur des adresses confirmées : la base ne
 * le connaît pas. Chaque dépôt du back-office exige donc une capacité `Operator` à sa construction, et l'appelant ne la
 * fabrique qu'après avoir lu le rôle dans la session. Toute action écrit son entrée de journal dans la même transaction
 * qu'elle-même : si l'une échoue, l'autre n'existe pas.
 */

export interface Operator {
  readonly role: "operator";
  /** L'identifiant interne de l'opérateur (ligne `User`) : c'est lui que le journal retient. */
  readonly userId: string;
}

const Uuid = z.uuid();

/** Refuse de construire un dépôt du back-office pour autre chose qu'un opérateur identifié. */
export const assertOperator = (operator: Operator): void => {
  if (operator.role !== "operator" || !Uuid.safeParse(operator.userId).success) throw new Error("back-office réservé à l'opérateur");
};

/** Un motif lisible : trois caractères au moins, mille au plus, comme la contrainte en base. */
export const ReasonSchema = z.string().trim().min(3).max(1000);

export type Reason = z.output<typeof ReasonSchema>;

export type MetadataValue = string | number | boolean | null;

export interface AuditEntry {
  readonly action: OperatorActionKind;
  readonly targetType: OperatorTargetType;
  readonly targetId: string;
  readonly reason: string | null;
  readonly metadata?: Readonly<Record<string, MetadataValue>>;
}

/** Écrit l'entrée du journal, dans la transaction de l'action. */
export const recordAction = async (tx: Prisma.TransactionClient, operator: Operator, entry: AuditEntry, now: Date): Promise<void> => {
  await tx.operatorAction.create({
    data: {
      operatorUserId: operator.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason,
      metadata: { ...(entry.metadata ?? {}) },
      createdAt: now,
    },
  });
};

/** Ce dont la personne est prévenue par e-mail : la décision et son motif, jamais l'identité de l'opérateur. */
export const ACCOUNT_NOTICES = [
  "profile_hidden",
  "profile_restored",
  "mission_hidden",
  "mission_restored",
  "company_page_hidden",
  "company_page_restored",
  "organisation_hidden",
  "organisation_restored",
  "contact_closed",
  "vigilance_rejected",
  "proof_revoked",
  "account_suspended",
  "account_restored",
  "post_hidden",
  "post_restored",
  "comment_hidden",
  "comment_restored",
] as const;

export type AccountNotice = (typeof ACCOUNT_NOTICES)[number];

/*
 * Met l'e-mail en file, dans la transaction de l'action : il part même si l'envoi échoue la première fois. Une décision
 * qui touche le compte n'est pas un e-mail qu'on peut couper dans ses préférences : il est mis en file pour tous.
 */
export const notifyAccount = async (tx: Prisma.TransactionClient, userIds: readonly string[], notice: AccountNotice, reason: string | null, subject = ""): Promise<void> => {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  const payload: Prisma.InputJsonObject = { notice, reason: reason ?? "", subject };
  await tx.notification.createMany({ data: unique.map((userId) => ({ userId, kind: "account_notice" as const, payload })) });
};

/** Les personnes qui répondent d'une entreprise : ses propriétaires et administrateurs. */
export const organisationAdmins = async (tx: Prisma.TransactionClient, organisationId: string): Promise<readonly string[]> => {
  const rows = await tx.membership.findMany({ where: { organisationId, role: { in: ["owner", "admin"] } }, select: { userId: true } });
  return rows.map((row) => row.userId);
};

/** Le résultat d'une action d'opérateur : faite, déjà dans cet état, ou cible introuvable. */
export type OperatorResult = "done" | "unchanged" | "absent";
