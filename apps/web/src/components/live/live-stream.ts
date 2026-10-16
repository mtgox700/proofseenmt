import { z } from "zod";

/*
 * The browser side of the live stream: one EventSource per tab, shared by every component that listens (the header
 * counters, the open thread, the inbox). Opened with the first listener, closed shortly after the last one leaves.
 *
 * The browser reconnects by itself after a drop (the server sets the delay). When the server refuses the stream
 * (signed out, too many tabs, throttled), the EventSource gives up; it is tried again after a minute and a random part
 * of another (wave-3 review, L7), so that refused tabs do not all come back at the same instant, while someone still
 * listens. Without EventSource, nothing happens: every page still works by reloading.
 */

const LiveEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("counts"), messages: z.number().int().min(0), notifications: z.number().int().min(0) }),
  z.object({ type: z.literal("message"), conversationId: z.string(), mine: z.boolean() }),
  z.object({ type: z.literal("read"), conversationId: z.string(), readAt: z.string() }),
  z.object({ type: z.literal("resync") }),
]);

export type LiveEvent = z.infer<typeof LiveEventSchema>;
export type LiveListener = (event: LiveEvent) => void;

const STREAM_URL = "/api/messages/stream";
const REOPEN_AFTER_REFUSAL_MS = 60_000;
const REOPEN_JITTER_MS = 60_000;
const CLOSE_DELAY_MS = 1_000;

const listeners = new Set<LiveListener>();
let source: EventSource | null = null;
let reopenTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let lastCounts: LiveEvent | null = null;

const deliver = (raw: string): void => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const event = LiveEventSchema.safeParse(parsed);
  if (!event.success) return;
  if (event.data.type === "counts") lastCounts = event.data;
  for (const listener of [...listeners]) listener(event.data);
};

const open = (): void => {
  if (source !== null || reopenTimer !== null || typeof EventSource === "undefined") return;
  const next = new EventSource(STREAM_URL);
  source = next;
  next.onmessage = (message: MessageEvent<string>) => deliver(message.data);
  // A reconnection may have missed events: listeners re-read. The first opening has nothing to catch up on.
  let openedBefore = false;
  next.onopen = () => {
    if (openedBefore) deliver(JSON.stringify({ type: "resync" }));
    openedBefore = true;
  };
  next.onerror = () => {
    if (next.readyState !== EventSource.CLOSED) return;
    next.close();
    if (source === next) source = null;
    if (listeners.size > 0) {
      reopenTimer = setTimeout(() => {
        reopenTimer = null;
        if (listeners.size > 0) open();
      }, REOPEN_AFTER_REFUSAL_MS + Math.floor(Math.random() * REOPEN_JITTER_MS));
    }
  };
};

const close = (): void => {
  source?.close();
  source = null;
  if (reopenTimer !== null) clearTimeout(reopenTimer);
  reopenTimer = null;
};

/** Listens to live events until the returned function is called. */
export const subscribeLive = (listener: LiveListener): (() => void) => {
  listeners.add(listener);
  if (closeTimer !== null) clearTimeout(closeTimer);
  closeTimer = null;
  open();
  // A component mounted after the counters arrived gets them at once instead of waiting for the next change.
  if (lastCounts !== null) listener(lastCounts);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || closeTimer !== null) return;
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (listeners.size === 0) close();
    }, CLOSE_DELAY_MS);
  };
};
