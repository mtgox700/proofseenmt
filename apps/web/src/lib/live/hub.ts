import type { ConversationParties, LiveCounts, LiveSignal } from "@proofseen/db";

/*
 * In-memory fan-out of live events to the connected browsers of this container.
 *
 * One listener per process receives every signal from Postgres (LISTEN/NOTIFY); the hub decides who learns what. A
 * signal only carries ids, and the people concerned are re-read from the database when it arrives: a message reaches
 * the current parties of its conversation and nobody else, whoever is connected. What a browser receives is never the
 * message itself — only "something changed here" and its own counters; it then reads through the usual
 * access-controlled routes.
 *
 * The listener starts with the first subscriber. Streams are capped per person (tabs) and per container.
 *
 * After the listener reconnects, every screen re-reads, each after its own random delay below `resyncJitterMs`, so a
 * database restart is not followed by every open tab querying at the same instant (wave-3 review, L7). A suspended
 * account loses its open streams at once (L12): the browser reconnects, and the stream route refuses it.
 */

export type LiveOut =
  | { readonly type: "counts"; readonly messages: number; readonly notifications: number }
  | { readonly type: "message"; readonly conversationId: string; readonly mine: boolean }
  | { readonly type: "read"; readonly conversationId: string; readonly readAt: string }
  | { readonly type: "resync" };

export interface LiveSink {
  send(event: LiveOut): void;
  /** Ends the stream from the server side (account suspended). */
  close?(): void;
}

export interface LiveSource {
  start(handlers: { onSignal(signal: LiveSignal): void; onReconnect(): void }): void;
}

export interface LiveAudienceLike {
  parties(conversationId: string): Promise<ConversationParties | null>;
  counts(userId: string): Promise<LiveCounts>;
}

export interface HubOptions {
  readonly maxPerUser: number;
  readonly maxTotal: number;
  /** Counter refreshes for one person are grouped over this delay: ten messages in a burst cost one query. */
  readonly countsDelayMs: number;
  /** Re-reads after a reconnection are spread over this delay. */
  readonly resyncJitterMs: number;
  /** Injected in tests; `Math.random` by default. */
  readonly random?: () => number;
  readonly log: (message: string, error?: unknown) => void;
}

export interface LiveHub {
  /** Registers a browser stream; returns its unsubscribe function, or `"too_many"` past a cap. */
  subscribe(userId: string, sink: LiveSink): (() => void) | "too_many";
  /** Open streams of one person, or of the whole container. */
  size(userId?: string): number;
  /** Delivers one database signal to whoever it concerns. Exposed for tests; the source calls it in production. */
  dispatch(signal: LiveSignal): Promise<void>;
}

export const createLiveHub = (source: LiveSource, audience: LiveAudienceLike, options: HubOptions): LiveHub => {
  const sinks = new Map<string, Set<LiveSink>>();
  const pendingCounts = new Set<string>();
  let started = false;
  let total = 0;

  const sendTo = (userId: string, event: LiveOut): void => {
    for (const sink of sinks.get(userId) ?? []) {
      try {
        sink.send(event);
      } catch (error) {
        options.log("live hub: send failed", error);
      }
    }
  };

  const refreshCounts = (userId: string): void => {
    if (!sinks.has(userId) || pendingCounts.has(userId)) return;
    pendingCounts.add(userId);
    setTimeout(() => {
      pendingCounts.delete(userId);
      if (!sinks.has(userId)) return;
      audience
        .counts(userId)
        .then((counts) => sendTo(userId, { type: "counts", messages: counts.messages, notifications: counts.notifications }))
        .catch((error: unknown) => options.log("live hub: counts failed", error));
    }, options.countsDelayMs);
  };

  const random = options.random ?? Math.random;

  /** Closes every open stream of one person; each stream unsubscribes itself as it closes. */
  const drop = (userId: string): void => {
    for (const sink of [...(sinks.get(userId) ?? [])]) {
      try {
        sink.close?.();
      } catch (error) {
        options.log("live hub: close failed", error);
      }
    }
  };

  const dispatch = async (signal: LiveSignal): Promise<void> => {
    if (signal.kind === "notification") {
      refreshCounts(signal.userId);
      return;
    }
    if (signal.kind === "suspended") {
      drop(signal.userId);
      return;
    }
    const parties = await audience.parties(signal.conversationId);
    if (parties === null) return;
    const everyone = [parties.freelanceUserId, ...parties.memberUserIds];
    if (signal.kind === "message") {
      for (const userId of everyone) {
        if (!sinks.has(userId)) continue;
        sendTo(userId, { type: "message", conversationId: signal.conversationId, mine: userId === signal.senderUserId });
        if (userId !== signal.senderUserId) refreshCounts(userId);
      }
      return;
    }
    // A read: the reader's own tabs update their counters; the other side learns « read » (a colleague does not).
    const reader = signal.userId;
    if (!everyone.includes(reader)) return;
    refreshCounts(reader);
    const otherSide = reader === parties.freelanceUserId ? parties.memberUserIds : [parties.freelanceUserId];
    for (const userId of otherSide) sendTo(userId, { type: "read", conversationId: signal.conversationId, readAt: signal.readAt });
  };

  const start = (): void => {
    if (started) return;
    started = true;
    source.start({
      onSignal: (signal) => {
        dispatch(signal).catch((error: unknown) => options.log("live hub: dispatch failed", error));
      },
      onReconnect: () => {
        // Signals may have been lost while the connection was down: every screen re-reads, not all at once.
        for (const userId of [...sinks.keys()]) {
          const timer = setTimeout(() => {
            sendTo(userId, { type: "resync" });
            refreshCounts(userId);
          }, Math.floor(random() * options.resyncJitterMs));
          timer.unref?.();
        }
      },
    });
  };

  return {
    subscribe(userId, sink) {
      const mine = sinks.get(userId) ?? new Set<LiveSink>();
      if (mine.size >= options.maxPerUser || total >= options.maxTotal) return "too_many";
      mine.add(sink);
      sinks.set(userId, mine);
      total += 1;
      start();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        total -= 1;
        mine.delete(sink);
        if (mine.size === 0) sinks.delete(userId);
      };
    },
    size(userId) {
      return userId === undefined ? total : (sinks.get(userId)?.size ?? 0);
    },
    dispatch,
  };
};
