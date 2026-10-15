import { z } from "zod";
import { assertOperator, notifyAccount, organisationAdmins, ReasonSchema, recordAction, type AccountNotice, type Operator, type OperatorResult } from "./back-office";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { OperatorActionKind } from "./generated/enums";

/*
 * Modération des contenus publics (C19) : un opérateur masque ou rétablit un profil, une mission ou la page publique
 * d'une entreprise, toujours avec un motif. Masquer ne supprime rien et ne touche pas aux réglages de la personne : le
 * contenu sort de tous les chemins publics (voir `public-visibility.ts`), la personne voit le motif dans son espace et
 * le reçoit par e-mail. Rétablir enlève le masque, sans rien republier de plus.
 *
 * Chaque action passe par une seule instruction conditionnelle (« pas encore masqué », « encore masqué ») : deux
 * opérateurs qui cliquent en même temps ne produisent qu'une décision et qu'une entrée de journal.
 */

export type ModerationTarget = "profile" | "mission" | "company";

export const ProfileReferenceInputSchema = z.string().trim().toUpperCase().regex(/^FR-[A-Z2-9]{5,8}$/);
const Uuid = z.uuid();
const Slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,80}$/);

export interface HiddenItem {
  readonly target: ModerationTarget;
  readonly id: string;
  /** Ce qui désigne la cible dans le formulaire : référence du profil, identifiant de la mission, adresse de la page. */
  readonly key: string;
  /** Référence du profil, intitulé de la mission, nom de l'entreprise. */
  readonly label: string;
  readonly reason: string;
  readonly moderatedAt: Date;
}

export interface Moderation {
  /** `key` : la référence d'un profil (FR-XXXXX), l'identifiant d'une mission, l'adresse de la page d'une entreprise. */
  hide(target: ModerationTarget, key: string, reason: string, now: Date): Promise<OperatorResult>;
  restore(target: ModerationTarget, key: string, reason: string, now: Date): Promise<OperatorResult>;
  /** Ce qui est masqué aujourd'hui, le plus récent d'abord. */
  hidden(): Promise<readonly HiddenItem[]>;
}

const MAX_LISTED = 200;

const ACTIONS: Readonly<Record<ModerationTarget, { readonly hide: OperatorActionKind; readonly restore: OperatorActionKind }>> = {
  profile: { hide: "profile_hidden", restore: "profile_restored" },
  mission: { hide: "mission_hidden", restore: "mission_restored" },
  company: { hide: "company_page_hidden", restore: "company_page_restored" },
};

const NOTICES: Readonly<Record<ModerationTarget, { readonly hide: AccountNotice; readonly restore: AccountNotice }>> = {
  profile: { hide: "profile_hidden", restore: "profile_restored" },
  mission: { hide: "mission_hidden", restore: "mission_restored" },
  company: { hide: "company_page_hidden", restore: "company_page_restored" },
};

/** La cible résolue : son identifiant, ce qui la décrit dans le journal, et qui prévenir. */
interface Resolved {
  readonly id: string;
  readonly label: string;
  readonly recipients: readonly string[];
  readonly moderated: boolean;
}

const resolve = async (tx: Prisma.TransactionClient, target: ModerationTarget, key: string): Promise<Resolved | null> => {
  if (target === "profile") {
    const reference = ProfileReferenceInputSchema.safeParse(key);
    if (!reference.success) return null;
    const row = await tx.freelanceProfile.findUnique({ where: { reference: reference.data }, select: { id: true, reference: true, userId: true, moderatedAt: true } });
    return row === null ? null : { id: row.id, label: row.reference, recipients: [row.userId], moderated: row.moderatedAt !== null };
  }
  if (target === "mission") {
    const id = Uuid.safeParse(key.trim());
    if (!id.success) return null;
    const row = await tx.jobPost.findUnique({ where: { id: id.data }, select: { id: true, title: true, organisationId: true, authorUserId: true, moderatedAt: true } });
    if (row === null) return null;
    const admins = await organisationAdmins(tx, row.organisationId);
    return { id: row.id, label: row.title, recipients: [...admins, ...(row.authorUserId === null ? [] : [row.authorUserId])], moderated: row.moderatedAt !== null };
  }
  const slug = Slug.safeParse(key);
  if (!slug.success) return null;
  const row = await tx.organisation.findUnique({ where: { publicSlug: slug.data }, select: { id: true, name: true, moderatedAt: true } });
  return row === null ? null : { id: row.id, label: row.name, recipients: await organisationAdmins(tx, row.id), moderated: row.moderatedAt !== null };
};

/** Pose ou retire le masque, seulement s'il est dans l'état attendu ; rend le nombre de lignes changées. */
const flip = async (tx: Prisma.TransactionClient, target: ModerationTarget, id: string, hide: boolean, reason: string, now: Date): Promise<number> => {
  const data = hide ? { moderatedAt: now, moderationReason: reason } : { moderatedAt: null, moderationReason: null };
  const where = { id, moderatedAt: hide ? null : { not: null } };
  if (target === "profile") return (await tx.freelanceProfile.updateMany({ where, data })).count;
  if (target === "mission") return (await tx.jobPost.updateMany({ where, data })).count;
  return (await tx.organisation.updateMany({ where, data })).count;
};

const TARGET_TYPE = { profile: "profile", mission: "mission", company: "organisation" } as const;

export const moderation = (db: Db, operator: Operator): Moderation => {
  assertOperator(operator);

  const apply = async (target: ModerationTarget, key: string, rawReason: string, hide: boolean, now: Date): Promise<OperatorResult> => {
    const reason = ReasonSchema.parse(rawReason);
    return db.$transaction(async (tx): Promise<OperatorResult> => {
      const found = await resolve(tx, target, key);
      if (found === null) return "absent";
      if ((await flip(tx, target, found.id, hide, reason, now)) === 0) return "unchanged";
      const kind = hide ? "hide" : "restore";
      await recordAction(tx, operator, { action: ACTIONS[target][kind], targetType: TARGET_TYPE[target], targetId: found.id, reason, metadata: { label: found.label } }, now);
      await notifyAccount(tx, found.recipients, NOTICES[target][kind], reason, found.label);
      return "done";
    });
  };

  return {
    hide: (target, key, reason, now) => apply(target, key, reason, true, now),
    restore: (target, key, reason, now) => apply(target, key, reason, false, now),

    async hidden() {
      const where = { moderatedAt: { not: null } };
      const order = [{ moderatedAt: "desc" as const }, { id: "desc" as const }];
      const [profiles, missions, companies] = await Promise.all([
        db.freelanceProfile.findMany({ where, orderBy: order, take: MAX_LISTED, select: { id: true, reference: true, moderatedAt: true, moderationReason: true } }),
        db.jobPost.findMany({ where, orderBy: order, take: MAX_LISTED, select: { id: true, title: true, moderatedAt: true, moderationReason: true } }),
        db.organisation.findMany({ where, orderBy: order, take: MAX_LISTED, select: { id: true, name: true, publicSlug: true, moderatedAt: true, moderationReason: true } }),
      ]);
      const item = (target: ModerationTarget, id: string, key: string, label: string, at: Date | null, reason: string | null): HiddenItem[] =>
        at === null || reason === null ? [] : [{ target, id, key, label, reason, moderatedAt: at }];
      return [
        ...profiles.flatMap((p) => item("profile", p.id, p.reference, p.reference, p.moderatedAt, p.moderationReason)),
        ...missions.flatMap((m) => item("mission", m.id, m.id, m.title, m.moderatedAt, m.moderationReason)),
        ...companies.flatMap((c) => (c.publicSlug === null ? [] : item("company", c.id, c.publicSlug, c.name, c.moderatedAt, c.moderationReason))),
      ].sort((a, b) => b.moderatedAt.getTime() - a.moderatedAt.getTime());
    },
  };
};
