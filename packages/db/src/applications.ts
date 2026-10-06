import { z } from "zod";
import type { Db } from "./client";
import { containsContact } from "./contact-detection";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { ApplicationStatus } from "./generated/enums";
import type { Actor } from "./messaging";

/*
 * Candidatures. Un freelance postule à une mission ouverte avec un mot ; la conversation avec l'entreprise s'ouvre dans
 * la même transaction, acceptée d'emblée puisque c'est lui qui a pris contact, et son mot en est le premier message.
 *
 * Le freelance voit toujours où en est sa candidature : « sans réponse » est le premier grief fait aux job boards.
 * L'entreprise voit des faits vérifiés sur le candidat (adresses prouvées, missions vérifiées), jamais une note ni un
 * rang calculé (AI Act). L'ordre de la liste est celui qu'elle choisit.
 */

const Uuid = z.uuid();
export const CoverNoteSchema = z.string().trim().min(1).max(5000);

export type ApplyResult =
  | { readonly kind: "applied"; readonly applicationId: string; readonly conversationId: string }
  /** L'acteur n'a pas de profil freelance : il doit en créer un avant de postuler. */
  | { readonly kind: "no_profile" }
  /** Le profil est privé : le publier d'abord, plutôt que de l'exposer par la candidature. */
  | { readonly kind: "profile_private" }
  | { readonly kind: "already_applied" }
  /** Mission inexistante, pas encore publiée ou clôturée. */
  | { readonly kind: "absent" };

export interface ApplicantView {
  readonly applicationId: string;
  readonly conversationId: string | null;
  readonly status: ApplicationStatus;
  readonly createdAt: Date;
  readonly profile: {
    readonly id: string;
    readonly reference: string;
    readonly headline: string | null;
    /** Adresses dont la possession est prouvée. Un fait, pas une note. */
    readonly verifiedUrls: number;
    readonly verifiedMissions: number;
  };
}

export interface MyApplicationView {
  readonly applicationId: string;
  readonly conversationId: string | null;
  readonly status: ApplicationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly mission: { readonly id: string; readonly title: string; readonly status: string };
}

/** Ce que l'entreprise peut décider, et depuis quels statuts. Les statuts finaux ne se rouvrent pas. */
const ORGANISATION_MOVES: Record<"shortlisted" | "declined" | "hired", readonly ApplicationStatus[]> = {
  shortlisted: ["submitted"],
  declined: ["submitted", "shortlisted"],
  hired: ["submitted", "shortlisted"],
};

export interface Applications {
  apply(actor: Actor, missionId: string, coverNote: string, now: Date): Promise<ApplyResult>;
  /** Les candidatures d'une mission, pour les membres de son entreprise ; `null` pour les autres. */
  listForMission(actor: Actor, missionId: string, order?: "oldest" | "newest"): Promise<readonly ApplicantView[] | null>;
  /** Les candidatures du freelance, les plus récentes d'abord. */
  listMine(actor: Actor): Promise<readonly MyApplicationView[]>;
  decide(actor: Actor, applicationId: string, status: keyof typeof ORGANISATION_MOVES): Promise<boolean>;
  withdraw(actor: Actor, applicationId: string): Promise<boolean>;
}

export const applications = (db: Db): Applications => ({
  async apply(actor, missionId, rawNote, now) {
    if (!Uuid.safeParse(missionId).success) return { kind: "absent" };
    const note = CoverNoteSchema.parse(rawNote);
    const [profile, mission] = await Promise.all([
      db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true, visibility: true } }),
      // Une mission de sa propre entreprise est « absente » : personne ne s'embauche soi-même.
      db.jobPost.findFirst({ where: { id: missionId, status: "open", organisation: { members: { none: { userId: actor.userId } } } }, select: { organisationId: true } }),
    ]);
    if (profile === null) return { kind: "no_profile" };
    if (profile.visibility === "private") return { kind: "profile_private" };
    if (mission === null) return { kind: "absent" };
    try {
      return await db.$transaction(async (tx) => {
        const application = await tx.application.create({ data: { jobPostId: missionId, profileId: profile.id, coverNote: note }, select: { id: true } });
        const conversation = await tx.conversation.create({
          data: { organisationId: mission.organisationId, profileId: profile.id, applicationId: application.id, status: "accepted", decidedAt: now },
          select: { id: true },
        });
        await tx.message.create({ data: { conversationId: conversation.id, senderUserId: actor.userId, body: note, containsContact: containsContact(note) } });
        return { kind: "applied" as const, applicationId: application.id, conversationId: conversation.id };
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { kind: "already_applied" };
      // La mission a été clôturée entre la lecture et l'écriture : la base a refusé, la réponse est « absente ».
      if ((await db.jobPost.count({ where: { id: missionId, status: "open" } })) === 0) return { kind: "absent" };
      throw error;
    }
  },

  async listForMission(actor, missionId, order = "oldest") {
    if (!Uuid.safeParse(missionId).success) return null;
    const visible = await db.jobPost.count({ where: { id: missionId, organisation: { members: { some: { userId: actor.userId } } } } });
    if (visible === 0) return null;
    const rows = await db.application.findMany({
      where: { jobPostId: missionId, status: { not: "withdrawn" } },
      orderBy: [{ createdAt: order === "oldest" ? "asc" : "desc" }, { id: "asc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        conversation: { select: { id: true } },
        profile: {
          select: {
            id: true,
            reference: true,
            headline: true,
            _count: { select: { ownedUrls: { where: { verifiedAt: { not: null } } }, missions: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      applicationId: row.id,
      conversationId: row.conversation?.id ?? null,
      status: row.status,
      createdAt: row.createdAt,
      profile: {
        id: row.profile.id,
        reference: row.profile.reference,
        headline: row.profile.headline,
        verifiedUrls: row.profile._count.ownedUrls,
        verifiedMissions: row.profile._count.missions,
      },
    }));
  },

  async listMine(actor) {
    const rows = await db.application.findMany({
      where: { profile: { userId: actor.userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        conversation: { select: { id: true } },
        jobPost: { select: { id: true, title: true, status: true } },
      },
    });
    return rows.map((row) => ({
      applicationId: row.id,
      conversationId: row.conversation?.id ?? null,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      mission: row.jobPost,
    }));
  },

  async decide(actor, applicationId, status) {
    if (!Uuid.safeParse(applicationId).success) return false;
    return moveAndMaybeClose(db, applicationId, status, {
      status: { in: [...ORGANISATION_MOVES[status]] },
      jobPost: { organisation: { members: { some: { userId: actor.userId } } } },
    });
  },

  async withdraw(actor, applicationId) {
    if (!Uuid.safeParse(applicationId).success) return false;
    return moveAndMaybeClose(db, applicationId, "withdrawn", { status: { in: ["submitted", "shortlisted"] }, profile: { userId: actor.userId } });
  },
});

/*
 * Change le statut d'une candidature et, si elle est retirée ou déclinée, ferme le fil qu'elle avait ouvert, dans la
 * même transaction. Sans cela, une candidature retirée laissait un fil accepté que personne ne pouvait fermer : un canal
 * de harcèlement ouvert dans les deux sens.
 */
const moveAndMaybeClose = (db: Db, applicationId: string, status: ApplicationStatus, guard: Prisma.ApplicationWhereInput): Promise<boolean> =>
  db.$transaction(async (tx) => {
    const { count } = await tx.application.updateMany({ where: { id: applicationId, ...guard }, data: { status } });
    if (count !== 1) return false;
    if (status === "withdrawn" || status === "declined") {
      await tx.conversation.updateMany({ where: { applicationId, status: "accepted" }, data: { status: "closed" } });
    }
    return true;
  });
