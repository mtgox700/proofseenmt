import { z } from "zod";
import type { Db } from "./client";
import type { ApplicationStatus } from "./generated/enums";
import type { Actor } from "./messaging";
import { notifications } from "./notifications";
import { isListedProfile } from "./public-visibility";

/*
 * Une candidature ouverte par l'entreprise : le mot du freelance, ses réponses aux questions de la mission, ses faits
 * vérifiés. La première ouverture par un membre de l'entreprise est datée une fois pour toutes (« candidature lue ») :
 * le freelance voit cette date dans ses candidatures et peut en être prévenu par e-mail. Qui l'a ouverte reste privé.
 *
 * La date est écrite en SQL direct, sans toucher `updatedAt` : `updatedAt` mesure le délai de décision de l'entreprise
 * (publié sur ses missions), et une lecture n'est pas une décision. Un déclencheur garde la première date.
 */

const Uuid = z.uuid();

export interface ApplicationDetail {
  readonly applicationId: string;
  readonly conversationId: string | null;
  readonly status: ApplicationStatus;
  readonly createdAt: Date;
  readonly readAt: Date;
  readonly coverNote: string;
  /** Chaque question de la mission avec la réponse du freelance, dans leur ordre. */
  readonly answers: readonly { readonly question: string; readonly answer: string }[];
  readonly mission: { readonly id: string; readonly title: string };
  readonly profile: {
    readonly reference: string;
    readonly headline: string | null;
    /** Adresse du profil public ; `null` si le profil est redevenu privé depuis. */
    readonly slug: string | null;
    readonly verifiedUrls: number;
    readonly verifiedMissions: number;
  };
}

export interface ApplicationDetails {
  /**
   * La candidature, pour un membre de l'entreprise qui publie la mission ; `null` pour tout autre, et pour une
   * candidature retirée. La première ouverture date la lecture et prévient le freelance.
   */
  open(actor: Actor, applicationId: string, now: Date): Promise<ApplicationDetail | null>;
}

export const applicationDetails = (db: Db): ApplicationDetails => ({
  async open(actor, applicationId, now) {
    if (!Uuid.safeParse(applicationId).success) return null;
    const row = await db.application.findFirst({
      where: { id: applicationId, status: { not: "withdrawn" }, jobPost: { organisation: { members: { some: { userId: actor.userId } } } } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        readAt: true,
        coverNote: true,
        answers: true,
        conversation: { select: { id: true } },
        jobPost: { select: { id: true, title: true, questions: true } },
        profile: {
          select: {
            userId: true,
            reference: true,
            headline: true,
            slug: true,
            visibility: true,
            moderatedAt: true,
            user: { select: { suspendedAt: true } },
            _count: { select: { ownedUrls: { where: { verifiedAt: { not: null } } }, missions: true } },
          },
        },
      },
    });
    if (row === null) return null;
    const readAt = row.readAt ?? (await markRead(db, row.id, row.jobPost.id, row.profile.userId, actor, now));
    return {
      applicationId: row.id,
      conversationId: row.conversation?.id ?? null,
      status: row.status,
      createdAt: row.createdAt,
      readAt,
      coverNote: row.coverNote,
      answers: row.jobPost.questions.map((question, i) => ({ question, answer: row.answers[i] ?? "" })),
      mission: { id: row.jobPost.id, title: row.jobPost.title },
      profile: {
        reference: row.profile.reference,
        headline: row.profile.headline,
        // Pas d'adresse publique pour un profil privé, masqué ou dont le compte est suspendu (revue vague 3, L9).
        slug: row.profile.visibility === "private" || !isListedProfile(row.profile) ? null : row.profile.slug,
        verifiedUrls: row.profile._count.ownedUrls,
        verifiedMissions: row.profile._count.missions,
      },
    };
  },
});

/** Date la première lecture et prévient le freelance, une seule fois même si deux membres ouvrent en même temps. */
const markRead = (db: Db, applicationId: string, missionId: string, freelanceUserId: string, actor: Actor, now: Date): Promise<Date> =>
  db.$transaction(async (tx) => {
    const marked = await tx.$executeRaw`
      UPDATE "Application" SET "readAt" = ${now}, "readByUserId" = ${actor.userId}::uuid
      WHERE "id" = ${applicationId}::uuid AND "readAt" IS NULL`;
    if (marked === 1) {
      await notifications(db).enqueue(tx, [freelanceUserId], "application_read", { applicationId, missionId });
      return now;
    }
    const { readAt } = await tx.application.findUniqueOrThrow({ where: { id: applicationId }, select: { readAt: true } });
    return readAt ?? now;
  });
