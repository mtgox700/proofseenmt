import { z } from "zod";
import { appNotifications } from "./app-notifications";
import type { Db } from "./client";
import { readState } from "./read-state";

/*
 * Événements en direct (C15) : ce que la base signale sur le canal `proofseen_live` (déclencheurs de la migration
 * `20261016090000_live_messaging`), et ce qu'il faut relire pour savoir qui doit l'apprendre.
 *
 * Le signal ne porte que des identifiants, et il n'est jamais cru sur parole : un signal mal formé est ignoré, et les
 * destinataires d'un message sont relus dans la base au moment de le diffuser. Quelqu'un qui a quitté l'entreprise
 * entre-temps n'apprend donc plus rien de ses fils.
 */

export const LIVE_CHANNEL = "proofseen_live";

export const LiveSignalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("message"), conversationId: z.uuid(), senderUserId: z.uuid().nullable() }),
  z.object({ kind: z.literal("read"), conversationId: z.uuid(), userId: z.uuid(), readAt: z.iso.datetime({ offset: true }) }),
  z.object({ kind: z.literal("notification"), userId: z.uuid() }),
]);

export type LiveSignal = z.infer<typeof LiveSignalSchema>;

/** Un signal reçu de la base ; `null` pour tout ce qui n'en est pas un. */
export const parseLiveSignal = (raw: string | undefined): LiveSignal | null => {
  if (raw === undefined || raw.length > 4096) return null;
  try {
    const parsed = LiveSignalSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** Les parties d'un fil : le freelance, et les membres de l'entreprise. */
export interface ConversationParties {
  readonly freelanceUserId: string;
  readonly memberUserIds: readonly string[];
}

/** Ce que montrent l'en-tête et la cloche. */
export interface LiveCounts {
  readonly messages: number;
  readonly notifications: number;
}

export interface LiveAudience {
  /** Les parties d'un fil, relues maintenant ; `null` s'il n'existe plus. */
  parties(conversationId: string): Promise<ConversationParties | null>;
  counts(userId: string): Promise<LiveCounts>;
}

const Uuid = z.uuid();

export const liveAudience = (db: Db): LiveAudience => ({
  async parties(conversationId) {
    if (!Uuid.safeParse(conversationId).success) return null;
    const row = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { profile: { select: { userId: true } }, organisation: { select: { members: { select: { userId: true } } } } },
    });
    return row === null ? null : { freelanceUserId: row.profile.userId, memberUserIds: row.organisation.members.map((m) => m.userId) };
  },

  async counts(userId) {
    if (!Uuid.safeParse(userId).success) return { messages: 0, notifications: 0 };
    const actor = { userId };
    const [messages, notifications] = await Promise.all([readState(db).unreadTotal(actor), appNotifications(db).unreadCount(actor)]);
    return { messages, notifications };
  },
});
