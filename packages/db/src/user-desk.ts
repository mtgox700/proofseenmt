import { z } from "zod";
import { assertOperator, notifyAccount, ReasonSchema, recordAction, type Operator, type OperatorResult } from "./back-office";
import type { Db } from "./client";
import type { MemberRole, OperatorActionKind, ProfileVisibility } from "./generated/enums";
import { gdpr, type UserExport } from "./gdpr";
import { LIVE_CHANNEL } from "./live";

/*
 * Les comptes vus par l'opérateur (C19) : recherche par adresse ou par référence, résumé du compte, suspension, export
 * RGPD pour répondre à une demande d'accès reçue par le support.
 *
 * Le résumé ne montre que des faits et des nombres : jamais le texte d'un message, jamais le contenu d'une note. Aucune
 * fonction ne permet d'agir à la place de la personne : l'opérateur ne se connecte jamais en son nom.
 */

export interface UserHit {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly reference: string | null;
  readonly createdAt: Date;
  readonly suspendedAt: Date | null;
}

export interface UserSummary extends UserHit {
  readonly lang: string;
  readonly suspensionReason: string | null;
  readonly profile: { readonly reference: string; readonly visibility: ProfileVisibility; readonly slug: string | null; readonly moderatedAt: Date | null } | null;
  readonly organisations: readonly { readonly id: string; readonly name: string; readonly role: MemberRole; readonly publicSlug: string | null; readonly moderatedAt: Date | null }[];
  readonly counts: {
    readonly messagesSent: number;
    readonly conversations: number;
    readonly applications: number;
    readonly missionsAuthored: number;
    readonly contracts: number;
    readonly feedback: number;
  };
  readonly history: readonly { readonly action: OperatorActionKind; readonly reason: string | null; readonly createdAt: Date }[];
}

export type SuspendResult = OperatorResult | "self";

export interface UserDesk {
  search(query: string): Promise<readonly UserHit[]>;
  summary(userId: string): Promise<UserSummary | null>;
  suspend(userId: string, reason: string, now: Date): Promise<SuspendResult>;
  restore(userId: string, reason: string, now: Date): Promise<OperatorResult>;
  /** L'export RGPD de la personne, journalisé avec la demande de support qui le justifie ; `null` si le compte n'existe pas. */
  exportFor(userId: string, reason: string, now: Date): Promise<UserExport | null>;
}

const Uuid = z.uuid();
const QuerySchema = z.string().trim().min(2).max(254);
const REFERENCE = /^FR-[A-Z2-9]{5,8}$/i;
const MAX_HITS = 20;
const HISTORY = 20;
const HIT_SELECT = { id: true, email: true, displayName: true, createdAt: true, suspendedAt: true, freelanceProfile: { select: { reference: true } } } as const;

export const userDesk = (db: Db, operator: Operator): UserDesk => {
  assertOperator(operator);

  const counts = async (userId: string, profileId: string | null, organisationIds: readonly string[]): Promise<UserSummary["counts"]> => {
    const [messagesSent, conversations, applications, missionsAuthored, contracts, feedback] = await Promise.all([
      db.message.count({ where: { senderUserId: userId } }),
      db.conversation.count({ where: { OR: [...(profileId === null ? [] : [{ profileId }]), { organisationId: { in: [...organisationIds] } }] } }),
      profileId === null ? 0 : db.application.count({ where: { profileId } }),
      db.jobPost.count({ where: { authorUserId: userId } }),
      db.contract.count({ where: { OR: [...(profileId === null ? [] : [{ profileId }]), { organisationId: { in: [...organisationIds] } }] } }),
      db.feedback.count({ where: { userId } }),
    ]);
    return { messagesSent, conversations, applications, missionsAuthored, contracts, feedback };
  };

  const setSuspension = async (userId: string, rawReason: string, suspend: boolean, now: Date): Promise<OperatorResult> => {
    const reason = ReasonSchema.parse(rawReason);
    if (!Uuid.safeParse(userId).success) return "absent";
    return db.$transaction(async (tx): Promise<OperatorResult> => {
      if ((await tx.user.count({ where: { id: userId } })) === 0) return "absent";
      const { count } = await tx.user.updateMany({
        where: { id: userId, suspendedAt: suspend ? null : { not: null } },
        data: suspend ? { suspendedAt: now, suspensionReason: reason } : { suspendedAt: null, suspensionReason: null },
      });
      if (count === 0) return "unchanged";
      // Les clés d'API créées par un compte suspendu sont révoquées pour toujours, et le journal en garde le nombre
      // (revue de sécurité vague 3, M6). Rétablir le compte ne les rend pas.
      const revoked = suspend ? (await tx.apiKey.updateMany({ where: { createdByUserId: userId, revokedAt: null }, data: { revokedAt: now } })).count : 0;
      const metadata = suspend ? { apiKeysRevoked: revoked } : {};
      await recordAction(tx, operator, { action: suspend ? "user_suspended" : "user_restored", targetType: "user", targetId: userId, reason, metadata }, now);
      await notifyAccount(tx, [userId], suspend ? "account_suspended" : "account_restored", reason);
      // Les flux en direct ouverts par la personne sont coupés à la validation de la transaction (revue vague 3, L12).
      if (suspend) await tx.$executeRaw`SELECT pg_notify(${LIVE_CHANNEL}, ${JSON.stringify({ kind: "suspended", userId })})`;
      return "done";
    });
  };

  return {
    async search(raw) {
      const parsed = QuerySchema.safeParse(raw);
      if (!parsed.success) return [];
      const q = parsed.data;
      const rows = REFERENCE.test(q)
        ? await db.user.findMany({ where: { freelanceProfile: { reference: q.toUpperCase() } }, take: 1, select: HIT_SELECT })
        : await db.user.findMany({ where: { email: { contains: q.toLowerCase() } }, orderBy: [{ email: "asc" }], take: MAX_HITS, select: HIT_SELECT });
      return rows.map(({ freelanceProfile, ...u }) => ({ ...u, reference: freelanceProfile?.reference ?? null }));
    },

    async summary(userId) {
      if (!Uuid.safeParse(userId).success) return null;
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          ...HIT_SELECT,
          lang: true,
          suspensionReason: true,
          freelanceProfile: { select: { id: true, reference: true, visibility: true, slug: true, moderatedAt: true } },
          memberships: { select: { role: true, organisation: { select: { id: true, name: true, publicSlug: true, moderatedAt: true } } } },
        },
      });
      if (user === null) return null;
      const { freelanceProfile: profile, memberships, ...rest } = user;
      const organisations = memberships.map((m) => ({ ...m.organisation, role: m.role }));
      const targets = [userId, ...(profile === null ? [] : [profile.id])];
      const [tally, history] = await Promise.all([
        counts(userId, profile?.id ?? null, organisations.map((o) => o.id)),
        db.operatorAction.findMany({ where: { targetId: { in: targets } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: HISTORY, select: { action: true, reason: true, createdAt: true } }),
      ]);
      return {
        ...rest,
        reference: profile?.reference ?? null,
        profile: profile === null ? null : { reference: profile.reference, visibility: profile.visibility, slug: profile.slug, moderatedAt: profile.moderatedAt },
        organisations,
        counts: tally,
        history,
      };
    },

    async suspend(userId, reason, now) {
      if (userId === operator.userId) return "self";
      return setSuspension(userId, reason, true, now);
    },

    restore: (userId, reason, now) => setSuspension(userId, reason, false, now),

    async exportFor(userId, rawReason, now) {
      const reason = ReasonSchema.parse(rawReason);
      if (!Uuid.safeParse(userId).success) return null;
      if ((await db.user.count({ where: { id: userId } })) === 0) return null;
      // Le journal d'abord : un export qui échoue après lui laisse une trace de tentative, jamais l'inverse.
      await db.$transaction((tx) => recordAction(tx, operator, { action: "user_exported", targetType: "user", targetId: userId, reason }, now));
      return gdpr(db).exportUser(userId, now);
    },
  };
};
