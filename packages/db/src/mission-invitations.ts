import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { WorkMode } from "./generated/enums";
import type { Actor } from "./messaging";
import { LISTED_MISSION } from "./public-visibility";
import { notifications } from "./notifications";

/*
 * Invitations à postuler. Un membre de l'entreprise invite un freelance publié, désigné par sa référence publique, à
 * postuler à l'une de ses missions ouvertes. Le freelance est prévenu, voit l'invitation dans ses missions, et décide :
 * postuler, ou l'écarter. L'entreprise ne sait pas qu'elle a été écartée.
 *
 * Plafonds, tenus sous verrou de l'entreprise pour qu'aucune rafale ne passe entre le comptage et l'écriture : par
 * entreprise et par jour, par mission, et par freelance et par semaine (un freelance n'est pas une liste d'envoi). Une
 * référence inconnue, un profil privé et un membre de l'entreprise donnent la même réponse : rien n'est révélé.
 */

export const MAX_INVITATIONS_PER_ORGANISATION_PER_DAY = 20;
export const MAX_INVITATIONS_PER_MISSION = 100;
export const MAX_INVITATIONS_RECEIVED_PER_WEEK = 10;

const DAY_MS = 86_400_000;
const Uuid = z.uuid();
export const ProfileReferenceSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^FR-[A-Z0-9]{5}$/));

export type InviteResult =
  | { readonly kind: "invited"; readonly invitationId: string }
  /** Mission inconnue, pas ouverte, ou d'une autre entreprise. */
  | { readonly kind: "absent" }
  /** Aucun freelance publié sous cette référence (ou un membre de l'entreprise). */
  | { readonly kind: "unknown_profile" }
  | { readonly kind: "already_invited" }
  | { readonly kind: "already_applied" }
  | { readonly kind: "limit" };

export interface MyInvitation {
  readonly invitationId: string;
  readonly createdAt: Date;
  readonly applied: boolean;
  readonly mission: { readonly id: string; readonly title: string; readonly organisationName: string; readonly workMode: WorkMode; readonly city: string | null };
}

export interface SentInvitation {
  readonly reference: string;
  readonly createdAt: Date;
  readonly applied: boolean;
}

export interface MissionInvitations {
  invite(actor: Actor, missionId: string, reference: string, now: Date): Promise<InviteResult>;
  /** Les invitations reçues par le freelance, non écartées, sur des missions encore ouvertes. */
  listMine(actor: Actor): Promise<readonly MyInvitation[]>;
  /** Celles auxquelles il n'a pas encore répondu (ni postulé, ni écarté). */
  countPending(actor: Actor): Promise<number>;
  dismiss(actor: Actor, invitationId: string, now: Date): Promise<boolean>;
  /** Les invitations envoyées pour une mission, pour les membres de son entreprise ; `null` pour les autres. */
  listForMission(actor: Actor, missionId: string): Promise<readonly SentInvitation[] | null>;
}

const appliedMissions = async (db: Db, profileId: string, missionIds: readonly string[]): Promise<ReadonlySet<string>> => {
  if (missionIds.length === 0) return new Set();
  const rows = await db.application.findMany({ where: { profileId, jobPostId: { in: [...missionIds] } }, select: { jobPostId: true } });
  return new Set(rows.map((r) => r.jobPostId));
};

export const missionInvitations = (db: Db): MissionInvitations => ({
  async invite(actor, missionId, rawReference, now) {
    if (!Uuid.safeParse(missionId).success) return { kind: "absent" };
    const reference = ProfileReferenceSchema.safeParse(rawReference);
    if (!reference.success) return { kind: "unknown_profile" };
    const mission = await db.jobPost.findFirst({
      where: { id: missionId, status: "open", moderatedAt: null, organisation: { suspendedAt: null, members: { some: { userId: actor.userId } } } },
      select: { organisationId: true },
    });
    if (mission === null) return { kind: "absent" };
    const profile = await db.freelanceProfile.findFirst({
      where: { reference: reference.data, visibility: { not: "private" }, moderatedAt: null, user: { suspendedAt: null, memberships: { none: { organisationId: mission.organisationId } } } },
      select: { id: true, userId: true },
    });
    if (profile === null) return { kind: "unknown_profile" };
    if ((await db.application.count({ where: { jobPostId: missionId, profileId: profile.id } })) > 0) return { kind: "already_applied" };
    try {
      return await db.$transaction(async (tx): Promise<InviteResult> => {
        await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = ${mission.organisationId}::uuid FOR UPDATE`;
        const [today, onMission, received] = await Promise.all([
          tx.missionInvitation.count({ where: { jobPost: { organisationId: mission.organisationId }, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } }),
          tx.missionInvitation.count({ where: { jobPostId: missionId } }),
          tx.missionInvitation.count({ where: { profileId: profile.id, createdAt: { gt: new Date(now.getTime() - 7 * DAY_MS) } } }),
        ]);
        if (today >= MAX_INVITATIONS_PER_ORGANISATION_PER_DAY || onMission >= MAX_INVITATIONS_PER_MISSION || received >= MAX_INVITATIONS_RECEIVED_PER_WEEK) {
          return { kind: "limit" };
        }
        const { id } = await tx.missionInvitation.create({
          data: { jobPostId: missionId, profileId: profile.id, invitedByUserId: actor.userId, createdAt: now },
          select: { id: true },
        });
        await notifications(db).enqueue(tx, [profile.userId], "mission_invitation", { invitationId: id, missionId });
        return { kind: "invited", invitationId: id };
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { kind: "already_invited" };
      throw error;
    }
  },

  async listMine(actor) {
    const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (profile === null) return [];
    const rows = await db.missionInvitation.findMany({
      where: { profileId: profile.id, dismissedAt: null, jobPost: { status: "open", ...LISTED_MISSION } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        createdAt: true,
        jobPost: { select: { id: true, title: true, workMode: true, city: true, organisation: { select: { name: true } } } },
      },
    });
    const applied = await appliedMissions(db, profile.id, rows.map((r) => r.jobPost.id));
    return rows.map((row) => ({
      invitationId: row.id,
      createdAt: row.createdAt,
      applied: applied.has(row.jobPost.id),
      mission: { id: row.jobPost.id, title: row.jobPost.title, organisationName: row.jobPost.organisation.name, workMode: row.jobPost.workMode, city: row.jobPost.city },
    }));
  },

  async countPending(actor) {
    return db.missionInvitation.count({
      where: {
        dismissedAt: null,
        profile: { userId: actor.userId },
        jobPost: { status: "open", ...LISTED_MISSION, applications: { none: { profile: { userId: actor.userId } } } },
      },
    });
  },

  async dismiss(actor, invitationId, now) {
    if (!Uuid.safeParse(invitationId).success) return false;
    const { count } = await db.missionInvitation.updateMany({ where: { id: invitationId, dismissedAt: null, profile: { userId: actor.userId } }, data: { dismissedAt: now } });
    return count === 1;
  },

  async listForMission(actor, missionId) {
    if (!Uuid.safeParse(missionId).success) return null;
    const visible = await db.jobPost.count({ where: { id: missionId, organisation: { members: { some: { userId: actor.userId } } } } });
    if (visible === 0) return null;
    const rows = await db.missionInvitation.findMany({
      where: { jobPostId: missionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_INVITATIONS_PER_MISSION,
      select: { createdAt: true, profile: { select: { reference: true, applications: { where: { jobPostId: missionId }, select: { id: true } } } } },
    });
    return rows.map((row) => ({ reference: row.profile.reference, createdAt: row.createdAt, applied: row.profile.applications.length > 0 }));
  },
});
