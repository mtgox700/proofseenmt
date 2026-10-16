import type { LiveCounts } from "@proofseen/db";
import type { LiveHub, LiveOut } from "./hub";

/*
 * One Server-Sent Events stream: a browser tab subscribed to the hub for one person.
 *
 * The first frame tells the browser how long to wait before reconnecting, the second carries the current counters. A
 * comment line every `heartbeatMs` keeps proxies from closing an idle connection. The stream ends by itself after
 * `maxLifetimeMs`: the browser reconnects, which re-checks the session, so a signed-out person stops receiving events
 * within that delay. Everything is released when the browser goes away (abort) or the stream is cancelled.
 *
 * Headers: no caching and no transformation (Next.js compression would buffer the stream otherwise), and
 * `X-Accel-Buffering: no` for any proxy in front.
 */

export const SSE_HEADERS: Readonly<Record<string, string>> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  "x-accel-buffering": "no",
  "x-content-type-options": "nosniff",
};

export interface StreamOptions {
  readonly heartbeatMs: number;
  readonly maxLifetimeMs: number;
  /** Delay the browser waits before reconnecting after a drop. */
  readonly retryMs: number;
  /**
   * Each stream adds a random part below this to `retryMs` (wave-3 review, L7): after a restart, the browsers come
   * back spread over that window instead of all at once.
   */
  readonly retryJitterMs?: number;
  readonly log: (message: string, error?: unknown) => void;
}

export const sseFrame = (event: LiveOut): string => `data: ${JSON.stringify(event)}\n\n`;

const TOO_MANY = (): Response => new Response("Too many live streams", { status: 429, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "60" } });

/** The streaming response for `userId`, or a 429 when the person or the container already has too many streams. */
export const openLiveStream = (hub: LiveHub, userId: string, signal: AbortSignal, initialCounts: () => Promise<LiveCounts>, options: StreamOptions): Response => {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lifetime: ReturnType<typeof setTimeout> | null = null;
  const backlog: string[] = [];

  const close = (): void => {
    if (closed) return;
    closed = true;
    if (heartbeat !== null) clearInterval(heartbeat);
    if (lifetime !== null) clearTimeout(lifetime);
    if (typeof unsubscribe === "function") unsubscribe();
    signal.removeEventListener("abort", close);
    try {
      controller?.close();
    } catch {
      // Already closed by the runtime: nothing left to release.
    }
  };

  const write = (chunk: string): void => {
    if (closed) return;
    if (controller === null) {
      backlog.push(chunk);
      return;
    }
    try {
      controller.enqueue(encoder.encode(chunk));
    } catch {
      close();
    }
  };

  const unsubscribe = hub.subscribe(userId, { send: (event) => write(sseFrame(event)), close: () => close() });
  if (unsubscribe === "too_many") return TOO_MANY();
  if (signal.aborted) {
    // The browser left before the stream opened: 204 also tells an EventSource not to reconnect.
    unsubscribe();
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  signal.addEventListener("abort", close, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      write(`retry: ${options.retryMs + Math.floor(Math.random() * (options.retryJitterMs ?? 0))}\n\n`);
      for (const chunk of backlog.splice(0)) write(chunk);
      initialCounts()
        .then((counts) => write(sseFrame({ type: "counts", messages: counts.messages, notifications: counts.notifications })))
        .catch((error: unknown) => options.log("live stream: initial counts failed", error));
      heartbeat = setInterval(() => write(": ping\n\n"), options.heartbeatMs);
      lifetime = setTimeout(close, options.maxLifetimeMs);
    },
    cancel() {
      close();
    },
  });
  return new Response(stream, { status: 200, headers: SSE_HEADERS });
};
