import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { JobPostStatus, WorkMode } from "./generated/enums";
import type { Actor } from "./messaging";
import { LISTED_MISSION } from "./public-visibility";

/*
 * Missions enregistrées : une liste privée pour y revenir avant de postuler. Seule une mission ouverte s'enregistre ;
 * une mission clôturée depuis reste dans la liste, marquée comme telle, jusqu'à ce que la personne la retire.
 * Personne d'autre ne la voit, pas même l'entreprise : c'est un marque-page, pas un signal.
 */

/** Au-delà, la liste n'est plus un choix mais une copie du site. */
export const MAX_SAVED_MISSIONS = 200;

const Uuid = z.uuid();

export type SaveResult = "saved" | "already" | "limit" | "absent";

export interface SavedMissionView {
  readonly missionId: string;
  readonly title: string;
  readonly organisationName: string;
  readonly status: JobPostStatus;
  readonly workMode: WorkMode;
  readonly city: string | null;
  readonly savedAt: Date;
}

export interface SavedMissions {
  save(actor: Actor, missionId: string): Promise<SaveResult>;
  remove(actor: Actor, missionId: string): Promise<boolean>;
  list(actor: Actor): Promise<readonly SavedMissionView[]>;
  isSaved(actor: Actor, missionId: string): Promise<boolean>;
  /** Missions enregistrées encore ouvertes. */
  countOpen(actor: Actor): Promise<number>;
}

export const savedMissions = (db: Db): SavedMissions => ({
  async save(actor, missionId) {
    if (!Uuid.safeParse(missionId).success) return "absent";
    const open = await db.jobPost.count({ where: { id: missionId, status: "open", ...LISTED_MISSION } });
    if (open === 0) return "absent";
    if ((await db.savedMission.count({ where: { userId: actor.userId } })) >= MAX_SAVED_MISSIONS) return "limit";
    try {
      await db.savedMission.create({ data: { userId: actor.userId, jobPostId: missionId } });
      return "saved";
    } catch (error) {
      if (isUniqueViolation(error)) return "already";
      throw error;
    }
  },

  async remove(actor, missionId) {
    if (!Uuid.safeParse(missionId).success) return false;
    const { count } = await db.savedMission.deleteMany({ where: { userId: actor.userId, jobPostId: missionId } });
    return count === 1;
  },

  async list(actor) {
    const rows = await db.savedMission.findMany({
      where: { userId: actor.userId },
      orderBy: [{ createdAt: "desc" }, { jobPostId: "desc" }],
      take: MAX_SAVED_MISSIONS,
      select: {
        createdAt: true,
        jobPost: { select: { id: true, title: true, status: true, workMode: true, city: true, organisation: { select: { name: true } } } },
      },
    });
    return rows.map((row) => ({
      missionId: row.jobPost.id,
      title: row.jobPost.title,
      organisationName: row.jobPost.organisation.name,
      status: row.jobPost.status,
      workMode: row.jobPost.workMode,
      city: row.jobPost.city,
      savedAt: row.createdAt,
    }));
  },

  async isSaved(actor, missionId) {
    if (!Uuid.safeParse(missionId).success) return false;
    return (await db.savedMission.count({ where: { userId: actor.userId, jobPostId: missionId } })) === 1;
  },

  async countOpen(actor) {
    return db.savedMission.count({ where: { userId: actor.userId, jobPost: { status: "open", ...LISTED_MISSION } } });
  },
});
