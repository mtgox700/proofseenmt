import { z } from "zod";
import type { Db } from "./client";
import { inbox } from "./inbox";
import type { Actor } from "./messaging";

/*
 * Résumé quotidien des messages non lus, par e-mail (C15). Désactivé par défaut : la personne le demande.
 *
 * Un seul par jour et par personne : la prise en charge pose `lastRunAt` sous verrou (`FOR UPDATE SKIP LOCKED`), donc
 * deux passages simultanés de la tâche planifiée ne prennent jamais la même personne, et une personne prise aujourd'hui
 * ne l'est plus avant demain, qu'elle ait eu des non-lus ou non. Le jour est celui de Paris : le résumé part le matin,
 * à partir de `DIGEST_HOUR_PARIS`, pas au milieu de la nuit.
 *
 * Le résumé ne dit que des comptes et qui écrit (le nom de l'entreprise, ou la référence du freelance) : jamais le texte
 * d'un message.
 */

export const DIGEST_HOUR_PARIS = 8;
const PARIS = "Europe/Paris";
const MAX_THREADS_IN_DIGEST = 10;

export interface DigestThread {
  readonly conversationId: string;
  /** Nom de l'entreprise pour un freelance, référence publique du freelance pour une entreprise. */
  readonly counterpart: string;
  readonly unread: number;
}

export interface DueDigest {
  readonly userId: string;
  readonly to: { readonly email: string; readonly lang: "fr" | "en"; readonly displayName: string };
  readonly unread: number;
  readonly threads: readonly DigestThread[];
}

export interface MessageDigests {
  enabled(actor: Actor): Promise<boolean>;
  set(actor: Actor, on: boolean): Promise<void>;
  /**
   * Prend en charge les résumés du jour encore à faire ; rend ceux qui ont des non-lus à dire. Les autres sont
   * comptés comme faits pour aujourd'hui.
   */
  claimDue(now: Date, limit: number): Promise<readonly DueDigest[]>;
}

const ClaimedRow = z.object({ userId: z.string(), email: z.string(), lang: z.string(), displayName: z.string() });

const parisParts = (now: Date): { year: number; month: number; day: number; hour: number } => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
};

/** Minuit à Paris, le jour de `now`, en instant UTC. */
export const parisDayStart = (now: Date): Date => {
  const { year, month, day, hour } = parisParts(now);
  // L'écart avec UTC à cet instant (une ou deux heures), retrouvé à partir de l'heure locale lue.
  const offsetHours = (hour - now.getUTCHours() + 24) % 24;
  return new Date(Date.UTC(year, month - 1, day) - offsetHours * 3_600_000);
};

export const messageDigests = (db: Db): MessageDigests => ({
  async enabled(actor) {
    return (await db.messageDigest.count({ where: { userId: actor.userId } })) === 1;
  },

  async set(actor, on) {
    if (on) {
      await db.messageDigest.upsert({ where: { userId: actor.userId }, create: { userId: actor.userId }, update: {} });
      return;
    }
    await db.messageDigest.deleteMany({ where: { userId: actor.userId } });
  },

  async claimDue(now, limit) {
    if (parisParts(now).hour < DIGEST_HOUR_PARIS) return [];
    const dayStart = parisDayStart(now);
    const rows = await db.$queryRaw<unknown[]>`
      WITH picked AS (
        SELECT "userId" FROM "MessageDigest"
        WHERE "lastRunAt" IS NULL OR "lastRunAt" < ${dayStart}
        ORDER BY "userId"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "MessageDigest" d SET "lastRunAt" = ${now}
      FROM picked, "User" u
      WHERE d."userId" = picked."userId" AND u."id" = d."userId"
      RETURNING d."userId"::text AS "userId", u."email", u."lang", u."displayName"`;
    const due: DueDigest[] = [];
    for (const raw of rows) {
      const row = ClaimedRow.parse(raw);
      const threads = (await inbox(db).threads({ userId: row.userId })).filter((thread) => thread.unread > 0);
      if (threads.length === 0) continue;
      due.push({
        userId: row.userId,
        to: { email: row.email, lang: row.lang === "en" ? "en" : "fr", displayName: row.displayName },
        unread: threads.reduce((sum, thread) => sum + thread.unread, 0),
        threads: threads.slice(0, MAX_THREADS_IN_DIGEST).map((thread) => ({
          conversationId: thread.id,
          counterpart: thread.counterpart.kind === "organisation" ? thread.counterpart.name : thread.counterpart.reference,
          unread: thread.unread,
        })),
      });
    }
    return due;
  },
});
