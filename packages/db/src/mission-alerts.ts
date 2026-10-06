import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";
import { missions, MissionSearchSchema } from "./missions";
import { notifications } from "./notifications";

/*
 * Alertes de missions : une recherche enregistrée, rejouée périodiquement. Chaque passage ne regarde que les missions
 * publiées depuis le passage précédent, et en fait une seule notification : une alerte n'envoie jamais deux fois la
 * même mission, ni un e-mail par mission.
 */

/** Au-delà, une personne ne surveille plus des missions, elle aspire le site. */
export const MAX_ALERTS_PER_USER = 10;
/** Missions citées au plus dans une même notification. */
const MAX_MATCHES = 10;
const SCAN_BATCH = 200;

const Uuid = z.uuid();

export const AlertFiltersSchema = z.object({
  workModes: z.array(z.enum(["onsite", "hybrid", "remote"])).max(3).default([]),
  city: z.string().trim().min(1).max(120).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  minDailyRateCents: z.number().int().min(0).max(10_000_000).optional(),
  maxDurationMonths: z.number().int().min(1).max(600).optional(),
});

export type AlertFilters = z.input<typeof AlertFiltersSchema>;

export interface AlertRecord {
  readonly id: string;
  readonly filters: z.output<typeof AlertFiltersSchema>;
  readonly createdAt: Date;
}

export type CreateAlertResult = { readonly kind: "created"; readonly alert: AlertRecord } | { readonly kind: "limit" };

export interface MissionAlerts {
  create(actor: Actor, filters: AlertFilters, now: Date): Promise<CreateAlertResult>;
  list(actor: Actor): Promise<readonly AlertRecord[]>;
  remove(actor: Actor, alertId: string): Promise<boolean>;
  /** Rejoue les alertes les plus anciennement vérifiées ; rend le nombre de notifications mises en file. */
  scan(now: Date): Promise<number>;
}

const toRecord = (row: { id: string; filters: Prisma.JsonValue; createdAt: Date }): AlertRecord => ({
  id: row.id,
  filters: AlertFiltersSchema.parse(row.filters),
  createdAt: row.createdAt,
});

export const missionAlerts = (db: Db): MissionAlerts => ({
  async create(actor, raw, now) {
    const filters = AlertFiltersSchema.parse(raw);
    if ((await db.missionAlert.count({ where: { userId: actor.userId } })) >= MAX_ALERTS_PER_USER) return { kind: "limit" };
    // La première vérification part de la création : une alerte neuve ne renvoie pas tout le stock existant.
    const row = await db.missionAlert.create({
      data: { userId: actor.userId, filters: filters as Prisma.InputJsonObject, lastCheckedAt: now },
      select: { id: true, filters: true, createdAt: true },
    });
    return { kind: "created", alert: toRecord(row) };
  },

  async list(actor) {
    const rows = await db.missionAlert.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "asc" }, select: { id: true, filters: true, createdAt: true } });
    return rows.map(toRecord);
  },

  async remove(actor, alertId) {
    if (!Uuid.safeParse(alertId).success) return false;
    const { count } = await db.missionAlert.deleteMany({ where: { id: alertId, userId: actor.userId } });
    return count === 1;
  },

  async scan(now) {
    const due = await db.missionAlert.findMany({ orderBy: { lastCheckedAt: "asc" }, take: SCAN_BATCH, select: { id: true, userId: true, filters: true, lastCheckedAt: true } });
    let queued = 0;
    for (const alert of due) {
      const parsed = AlertFiltersSchema.safeParse(alert.filters);
      if (!parsed.success) {
        // Des filtres devenus illisibles (vocabulaire changé) ne bloquent pas les autres alertes ; celle-ci est sautée.
        await db.missionAlert.update({ where: { id: alert.id }, data: { lastCheckedAt: now } });
        continue;
      }
      const search = MissionSearchSchema.parse({ ...parsed.data, publishedAfter: alert.lastCheckedAt, sort: "recent", pageSize: MAX_MATCHES });
      // Seulement ce qui est publié avant l'heure de ce passage : le passage suivant repart de là, sans trou ni doublon.
      const items = (await missions(db).search(search)).items.filter((m) => m.publishedAt !== null && m.publishedAt <= now);
      queued += await db.$transaction(async (tx) => {
        await tx.missionAlert.update({ where: { id: alert.id }, data: { lastCheckedAt: now } });
        if (items.length === 0) return 0;
        return notifications(db).enqueue(tx, [alert.userId], "mission_match", { alertId: alert.id, missionIds: items.map((m) => m.id) });
      });
    }
    return queued;
  },
});
