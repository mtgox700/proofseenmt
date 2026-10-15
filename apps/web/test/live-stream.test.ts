import type { ConversationParties, LiveCounts, LiveSignal } from "@proofseen/db";
import { describe, expect, it, vi } from "vitest";
import { createLiveHub, type LiveOut, type LiveSource } from "../src/lib/live/hub";
import { openLiveStream, SSE_HEADERS } from "../src/lib/live/sse";

/*
 * The live hub and its Server-Sent Events stream, with a fake listener in place of Postgres: who receives which event,
 * the caps, the frames on the wire, the heartbeat, and the clean-up when the browser leaves.
 */

const FREELANCE = "00000000-0000-4000-8000-000000000001";
const OWNER = "00000000-0000-4000-8000-000000000002";
const COLLEAGUE = "00000000-0000-4000-8000-000000000003";
const STRANGER = "00000000-0000-4000-8000-000000000004";
const THREAD = "00000000-0000-4000-8000-0000000000aa";

interface FakeSource extends LiveSource {
  emit(signal: LiveSignal): void;
  reconnect(): void;
  readonly starts: number;
}

const fakeSource = (): FakeSource => {
  let handlers: Parameters<LiveSource["start"]>[0] | null = null;
  let starts = 0;
  return {
    start(h) {
      handlers = h;
      starts += 1;
    },
    emit(signal) {
      handlers?.onSignal(signal);
    },
    reconnect() {
      handlers?.onReconnect();
    },
    get starts() {
      return starts;
    },
  };
};

const PARTIES: ConversationParties = { freelanceUserId: FREELANCE, memberUserIds: [OWNER, COLLEAGUE] };

const audience = {
  async parties(conversationId: string) {
    return conversationId === THREAD ? PARTIES : null;
  },
  async counts(userId: string): Promise<LiveCounts> {
    return { messages: userId === FREELANCE ? 3 : 1, notifications: 2 };
  },
};

const setup = (overrides: { maxPerUser?: number; maxTotal?: number } = {}) => {
  const source = fakeSource();
  const hub = createLiveHub(source, audience, { maxPerUser: overrides.maxPerUser ?? 5, maxTotal: overrides.maxTotal ?? 100, countsDelayMs: 0, log: () => undefined });
  const inboxes = new Map<string, LiveOut[]>();
  const listen = (userId: string) => {
    const received: LiveOut[] = [];
    inboxes.set(userId, received);
    const unsubscribe = hub.subscribe(userId, { send: (event) => received.push(event) });
    if (unsubscribe === "too_many") throw new Error("too many");
    return { received, unsubscribe };
  };
  return { source, hub, listen };
};

/** Lets pending deliveries run; positive expectations wait with `eventually`, so a loaded machine does not fail them. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const eventually = (check: () => void) => vi.waitFor(check, { timeout: 5_000, interval: 10 });

describe("live hub", () => {
  it("delivers a message only to the parties of its conversation, never to a stranger", async () => {
    const { source, listen } = setup();
    const freelance = listen(FREELANCE);
    const owner = listen(OWNER);
    const stranger = listen(STRANGER);
    source.emit({ kind: "message", conversationId: THREAD, senderUserId: OWNER });
    await eventually(() => {
      expect(freelance.received).toContainEqual({ type: "message", conversationId: THREAD, mine: false });
      expect(freelance.received).toContainEqual({ type: "counts", messages: 3, notifications: 2 });
    });
    await settle();
    expect(owner.received).toEqual([{ type: "message", conversationId: THREAD, mine: true }]);
    expect(stranger.received).toEqual([]);
  });

  it("ignores a conversation that no longer exists", async () => {
    const { source, listen } = setup();
    const freelance = listen(FREELANCE);
    source.emit({ kind: "message", conversationId: "00000000-0000-4000-8000-0000000000bb", senderUserId: OWNER });
    await settle();
    expect(freelance.received).toEqual([]);
  });

  it("tells the other side about a read, not a colleague, and refreshes the reader's counters", async () => {
    const { source, listen } = setup();
    const owner = listen(OWNER);
    const colleague = listen(COLLEAGUE);
    const freelance = listen(FREELANCE);
    source.emit({ kind: "read", conversationId: THREAD, userId: FREELANCE, readAt: "2026-10-16T09:00:00.000+00:00" });
    await eventually(() => expect(freelance.received).toHaveLength(1));
    await settle();
    expect(owner.received).toEqual([{ type: "read", conversationId: THREAD, readAt: "2026-10-16T09:00:00.000+00:00" }]);
    expect(colleague.received).toEqual([{ type: "read", conversationId: THREAD, readAt: "2026-10-16T09:00:00.000+00:00" }]);
    expect(freelance.received).toEqual([{ type: "counts", messages: 3, notifications: 2 }]);

    const before = freelance.received.length;
    source.emit({ kind: "read", conversationId: THREAD, userId: OWNER, readAt: "2026-10-16T09:01:00.000+00:00" });
    await eventually(() => expect(freelance.received.length).toBeGreaterThan(before));
    await settle();
    expect(colleague.received.filter((e) => e.type === "read")).toHaveLength(1);
  });

  it("does not repeat a read from someone who is no longer a party", async () => {
    const { source, listen } = setup();
    const owner = listen(OWNER);
    source.emit({ kind: "read", conversationId: THREAD, userId: STRANGER, readAt: "2026-10-16T09:00:00.000+00:00" });
    await settle();
    expect(owner.received).toEqual([]);
  });

  it("refreshes the counters of the person a notification is for, and nobody else", async () => {
    const { source, listen } = setup();
    const freelance = listen(FREELANCE);
    const owner = listen(OWNER);
    source.emit({ kind: "notification", userId: FREELANCE });
    await eventually(() => expect(freelance.received).toHaveLength(1));
    await settle();
    expect(freelance.received).toEqual([{ type: "counts", messages: 3, notifications: 2 }]);
    expect(owner.received).toEqual([]);
  });

  it("asks every screen to re-read after the listener reconnected", async () => {
    const { source, listen } = setup();
    const owner = listen(OWNER);
    source.reconnect();
    await eventually(() => expect(owner.received[0]).toEqual({ type: "resync" }));
  });

  it("starts the listener once, with the first subscriber, and caps streams per person and in all", () => {
    const { source, hub, listen } = setup({ maxPerUser: 2, maxTotal: 3 });
    expect(source.starts).toBe(0);
    const first = listen(OWNER);
    listen(OWNER);
    expect(source.starts).toBe(1);
    expect(hub.subscribe(OWNER, { send: () => undefined })).toBe("too_many");
    listen(FREELANCE);
    expect(hub.subscribe(COLLEAGUE, { send: () => undefined })).toBe("too_many");
    first.unsubscribe();
    first.unsubscribe();
    expect(hub.size(OWNER)).toBe(1);
    expect(hub.size()).toBe(2);
  });
});

const readFrames = async (reader: ReadableStreamDefaultReader<Uint8Array>, until: (text: string) => boolean): Promise<string> => {
  const decoder = new TextDecoder();
  let text = "";
  while (!until(text)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text;
};

describe("live stream (Server-Sent Events)", () => {
  const OPTIONS = { heartbeatMs: 30, maxLifetimeMs: 60_000, retryMs: 5_000, log: () => undefined };

  it("answers an event stream that must not be cached nor buffered, then the counters", async () => {
    const { hub } = setup();
    const abort = new AbortController();
    const response = openLiveStream(hub, FREELANCE, abort.signal, async () => ({ messages: 4, notifications: 1 }), OPTIONS);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(SSE_HEADERS["content-type"]);
    expect(response.headers.get("cache-control")).toContain("no-cache");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const text = await readFrames(reader, (t) => t.includes('"type":"counts"'));
    expect(text.startsWith("retry: 5000\n\n")).toBe(true);
    expect(text).toContain('data: {"type":"counts","messages":4,"notifications":1}\n\n');
    abort.abort();
  });

  it("writes the person's events, sends a heartbeat, and lets go when the browser leaves", async () => {
    const { hub, source } = setup();
    const abort = new AbortController();
    const response = openLiveStream(hub, OWNER, abort.signal, async () => ({ messages: 0, notifications: 0 }), OPTIONS);
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    expect(hub.size(OWNER)).toBe(1);
    source.emit({ kind: "message", conversationId: THREAD, senderUserId: FREELANCE });
    const text = await readFrames(reader, (t) => t.includes('"type":"message"') && t.includes(": ping"));
    expect(text).toContain(`data: {"type":"message","conversationId":"${THREAD}","mine":false}`);
    abort.abort();
    expect(hub.size(OWNER)).toBe(0);
    expect(hub.size()).toBe(0);
  });

  it("refuses a stream past the cap with 429", () => {
    const { hub } = setup({ maxPerUser: 1 });
    const abort = new AbortController();
    openLiveStream(hub, OWNER, abort.signal, async () => ({ messages: 0, notifications: 0 }), OPTIONS);
    const refused = openLiveStream(hub, OWNER, new AbortController().signal, async () => ({ messages: 0, notifications: 0 }), OPTIONS);
    expect(refused.status).toBe(429);
    abort.abort();
    expect(hub.size(OWNER)).toBe(0);
  });

  it("ends by itself after its lifetime, so the session is checked again on reconnection", async () => {
    const { hub } = setup();
    const response = openLiveStream(hub, OWNER, new AbortController().signal, async () => ({ messages: 0, notifications: 0 }), { ...OPTIONS, maxLifetimeMs: 20 });
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    await readFrames(reader, () => false);
    expect(hub.size(OWNER)).toBe(0);
  });
});
