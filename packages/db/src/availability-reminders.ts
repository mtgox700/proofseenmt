import { availabilityReminderBefore, availabilityRemindersEndBefore } from "./availability";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import { notifications } from "./notifications";
import { PUBLISHED_PROFILE } from "./profile-search-ids";

/*
 * Rappel de reconfirmer la disponibilité (C23), envoyé par la tâche planifiée : notification dans l'application (et
 * sur les appareils abonnés), et e-mail par la file d'envoi si la personne ne l'a pas coupé.
 *
 * Au plus un rappel par profil et par fenêtre de 14 jours : la date du dernier rappel est posée dans la même
 * transaction que sa mise en file, par une mise à jour conditionnelle. Deux exécutions simultanées ne rappellent donc
 * jamais deux fois ; une exécution qui échoue n'a rien posé et le rappel repart à la suivante. Un lot borné par
 * exécution, les disponibilités les plus anciennes d'abord : la tâche reste courte, le reste attend la prochaine.
 *
 * Seuls les profils publiés sont rappelés (la disponibilité n'est affichée que là), et jamais une disponibilité
 * déclarée « indisponible » : il n'y a rien à reconfirmer qui attire un contact. Trois rappels au plus depuis la
 * dernière confirmation (AVAILABILITY_MAX_REMINDERS), puis plus rien.
 */

/** Profils rappelés au plus par exécution de la tâche planifiée (toutes les 5 minutes en production). */
export const AVAILABILITY_REMINDER_BATCH = 100;

export interface AvailabilityReminders {
  /** Met en file les rappels dus à `now`, au plus `limit`. Rend le nombre de profils rappelés. */
  remindDue(now: Date, limit?: number): Promise<number>;
}

/** Une disponibilité à reconfirmer, sans rappel dans la fenêtre de 14 jours, et dont les trois rappels ne sont pas passés. */
export const reminderDueWhere = (now: Date): Prisma.FreelanceProfileWhereInput => {
  const before = availabilityReminderBefore(now);
  return {
    availability: { not: "unavailable" },
    availabilityAt: { lte: before, gt: availabilityRemindersEndBefore(now) },
    OR: [{ availabilityRemindedAt: null }, { availabilityRemindedAt: { lte: before } }],
  };
};

export const availabilityReminders = (db: Db): AvailabilityReminders => ({
  async remindDue(now, limit = AVAILABILITY_REMINDER_BATCH) {
    const take = Math.max(0, Math.min(Math.trunc(limit), AVAILABILITY_REMINDER_BATCH));
    if (take === 0) return 0;
    const due = await db.freelanceProfile.findMany({
      where: { ...PUBLISHED_PROFILE, ...reminderDueWhere(now) },
      orderBy: [{ availabilityAt: "asc" }, { id: "asc" }],
      take,
      select: { id: true, userId: true },
    });
    let reminded = 0;
    for (const row of due) {
      const sent = await db.$transaction(async (tx) => {
        // Relu sous condition : une confirmation ou un autre rappel entre la lecture et l'écriture l'emporte.
        const { count } = await tx.freelanceProfile.updateMany({ where: { id: row.id, ...reminderDueWhere(now) }, data: { availabilityRemindedAt: now } });
        if (count === 0) return false;
        await notifications(db).enqueue(tx, [row.userId], "availability_reminder", {});
        return true;
      });
      if (sent) reminded += 1;
    }
    return reminded;
  },
});
