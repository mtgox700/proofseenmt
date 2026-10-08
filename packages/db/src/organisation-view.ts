import { z } from "zod";
import type { Db } from "./client";
import type { MemberRole } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Les membres d'une entreprise, pour ses membres : le nom de chacun et son rôle. L'adresse e-mail des collègues n'est
 * montrée qu'aux propriétaires et administrateurs, qui en ont besoin pour gérer l'équipe.
 */

const Uuid = z.uuid();
const ROLE_ORDER: Readonly<Record<MemberRole, number>> = { owner: 0, admin: 1, member: 2 };

export interface MemberView {
  readonly userId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly role: MemberRole;
  readonly isMe: boolean;
}

export const organisationView = (db: Db) => ({
  /** Le nombre de validations exigé avant un versement, pour les membres ; `null` pour les autres. */
  async approvalLevels(actor: Actor, organisationId: string): Promise<number | null> {
    if (!Uuid.safeParse(organisationId).success) return null;
    const row = await db.organisation.findFirst({ where: { id: organisationId, members: { some: { userId: actor.userId } } }, select: { approvalLevels: true } });
    return row?.approvalLevels ?? null;
  },

  /** Les membres, propriétaires d'abord ; `null` pour qui n'est pas membre. */
  async members(actor: Actor, organisationId: string): Promise<readonly MemberView[] | null> {
    if (!Uuid.safeParse(organisationId).success) return null;
    const rows = await db.membership.findMany({
      where: { organisationId, organisation: { members: { some: { userId: actor.userId } } } },
      orderBy: { createdAt: "asc" },
      select: { role: true, user: { select: { id: true, displayName: true, email: true } } },
    });
    const me = rows.find((row) => row.user.id === actor.userId);
    if (me === undefined) return null;
    const admin = me.role === "owner" || me.role === "admin";
    return rows
      .map((row) => ({ userId: row.user.id, displayName: row.user.displayName, email: admin ? row.user.email : null, role: row.role, isMe: row.user.id === actor.userId }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  },
});

export type OrganisationView = ReturnType<typeof organisationView>;
