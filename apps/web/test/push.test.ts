import type { Actor, PendingPush, PushQueue, PushSubscriptions } from "@proofseen/db";
import { describe, expect, it, vi } from "vitest";
import { sendPushes } from "../src/data/push-delivery";
import { liveEn } from "../src/i18n/market/live-en";
import { liveFr } from "../src/i18n/market/live-fr";
import { deviceLabel } from "../src/lib/push/device-label";
import { pushMessage } from "../src/lib/push/payload";
import type { PushOutcome, PushSender, PushTarget } from "../src/lib/push/sender";
import { subscribeDevice, unsubscribeDevice, type PushCaller, type PushRouteDeps } from "../src/lib/push/subscribe-route";
import { vapidFromEnv, vapidMisconfigured } from "../src/lib/push/vapid";
import { base64UrlBytes } from "../src/lib/pwa/base64url";

/*
 * Push notifications on the server side (C20), without network: what a push says, the delivery loop against a fake
 * push service (an expired device is dropped), the checks of the subscription route, and the VAPID configuration.
 */

const THREAD = "0198f0aa-1234-7abc-8def-0123456789ab";
const USER = "0198f0aa-0000-7abc-8def-000000000001";

const pending = (n: number, overrides: Partial<PendingPush> = {}): PendingPush => ({
  id: `delivery-${n}`,
  attempts: 0,
  subscription: { id: `sub-${n}`, endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, p256dh: "p", auth: "a" },
  notification: { id: `notif-${n}`, kind: "message_received", payload: { conversationId: THREAD } },
  lang: "fr",
  ...overrides,
});

describe("what a push says", () => {
  it("is the sentence of the notification centre and the link it opens, in the person's language", () => {
    expect(pushMessage(pending(1))).toEqual({ title: "Proofseen", body: liveFr.notifications.kinds.message_received, url: `/fr/app/messages/${THREAD}`, tag: `thread-${THREAD}`, lang: "fr" });
    const en = pushMessage(pending(2, { lang: "en", notification: { id: "n2", kind: "application_status", payload: { status: "hired", applicationId: "x" } } }));
    expect(en).toMatchObject({ body: liveEn.notifications.statuses.hired, url: "/en/app/missions", tag: "notification-n2" });
  });

  it("carries nothing but the generic sentence, a path and a tag: no message, name or amount", () => {
    for (const kind of ["contact_received", "message_received", "application_received", "contract_update", "mission_invitation", "measurement_done"] as const) {
      const message = pushMessage(pending(3, { notification: { id: "n3", kind, payload: { conversationId: THREAD, contractId: THREAD, missionId: THREAD } } }));
      expect(Object.keys(message).sort()).toEqual(["body", "lang", "tag", "title", "url"]);
      expect(Object.values(liveFr.notifications.kinds)).toContain(message.body);
      expect(message.url.startsWith("/fr/")).toBe(true);
    }
  });
});

interface FakeQueue extends PushQueue {
  readonly delivered: string[];
  readonly gone: string[];
  readonly failed: string[];
}

const fakeQueue = (batches: readonly (readonly PendingPush[])[]): FakeQueue => {
  const waiting = [...batches];
  const delivered: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];
  return {
    delivered,
    gone,
    failed,
    async claim() {
      return waiting.shift() ?? [];
    },
    async markDelivered(push) {
      delivered.push(push.id);
    },
    async markGone(push) {
      gone.push(push.subscription.id);
    },
    async markFailed(push) {
      failed.push(push.id);
    },
  };
};

const fakeSender = (answer: (target: PushTarget) => PushOutcome | Error) => {
  const sent: { target: PushTarget; payload: unknown }[] = [];
  const sender: PushSender = {
    async send(target, payload) {
      sent.push({ target, payload: JSON.parse(payload) as unknown });
      const outcome = answer(target);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return { sender, sent };
};

describe("delivery loop", () => {
  it("records each outcome: delivered, expired device dropped, failure retried later", async () => {
    const queue = fakeQueue([[pending(1), pending(2), pending(3), pending(4)]]);
    const { sender, sent } = fakeSender((target) => {
      if (target.endpoint.endsWith("/2")) return { kind: "gone" };
      if (target.endpoint.endsWith("/3")) return { kind: "failed", error: "http_500" };
      if (target.endpoint.endsWith("/4")) return new Error("socket hang up");
      return { kind: "sent" };
    });
    const report = await sendPushes({ queue, sender, now: () => new Date() });
    expect(report).toEqual({ sent: 1, gone: 1, failed: 2 });
    expect(queue.delivered).toEqual(["delivery-1"]);
    expect(queue.gone).toEqual(["sub-2"]);
    expect(queue.failed).toEqual(["delivery-3", "delivery-4"]);
    expect(sent[0]?.payload).toEqual(pushMessage(pending(1)));
  });

  it("stops at the batch cap and when the queue is empty", async () => {
    const many = Array.from({ length: 3 }, (_, b) => Array.from({ length: 2 }, (_, i) => pending(b * 10 + i)));
    const capped = fakeQueue(many);
    const { sender } = fakeSender(() => ({ kind: "sent" }));
    expect(await sendPushes({ queue: capped, sender, now: () => new Date(), batch: 2, maxBatches: 2 })).toEqual({ sent: 4, gone: 0, failed: 0 });
    const empty = fakeQueue([]);
    const claim = vi.spyOn(empty, "claim");
    expect(await sendPushes({ queue: empty, sender, now: () => new Date() })).toEqual({ sent: 0, gone: 0, failed: 0 });
    expect(claim).toHaveBeenCalledTimes(1);
  });
});

const SUBSCRIPTION = { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "p", auth: "a" } };

const request = (body: unknown = SUBSCRIPTION) => new Request("https://proofseen.com/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const deps = (overrides: Partial<PushRouteDeps> & { readonly result?: Awaited<ReturnType<PushSubscriptions["subscribe"]>> } = {}) => {
  const subscribe = vi.fn(async (_actor: Actor, _input: unknown, _label: string | null) => overrides.result ?? "subscribed");
  const unsubscribe = vi.fn(async () => true);
  const base: PushRouteDeps = {
    configured: true,
    sameOrigin: () => true,
    caller: async (): Promise<PushCaller> => ({ kind: "actor", actor: { userId: USER } }),
    throttled: async () => false,
    body: async (r) => (await r.json()) as unknown,
    subscriptions: () => ({ subscribe, unsubscribe }),
    deviceLabel: "Chrome · Android",
  };
  return { deps: { ...base, ...overrides }, subscribe, unsubscribe };
};

describe("subscription route", () => {
  it("subscribes the signed-in person's device, with its short label", async () => {
    const d = deps();
    expect(await subscribeDevice(request(), d.deps)).toEqual({ kind: "ok", data: { subscribed: true } });
    expect(d.subscribe).toHaveBeenCalledWith({ userId: USER }, SUBSCRIPTION, "Chrome · Android");
  });

  it("refuses before touching the database: push off, other origin, signed out, throttled, no JSON", async () => {
    const signedOut = new Response(null, { status: 401 });
    const cases: [Partial<PushRouteDeps>, unknown][] = [
      [{ configured: false }, { kind: "error", error: "non-configuré" }],
      [{ sameOrigin: () => false }, { kind: "error", error: "origine refusée" }],
      [{ caller: async () => ({ kind: "refused", response: signedOut }) }, { kind: "refused", response: signedOut }],
      [{ throttled: async () => true }, { kind: "error", error: "trop de demandes" }],
      [{ body: async () => null }, { kind: "error", error: "requête invalide" }],
    ];
    for (const [overrides, expected] of cases) {
      const d = deps(overrides);
      expect(await subscribeDevice(request(), d.deps)).toEqual(expected);
      expect(d.subscribe).not.toHaveBeenCalled();
    }
  });

  it("answers what the repository decided: invalid subscription, suspended account", async () => {
    expect(await subscribeDevice(request(), deps({ result: "invalid" }).deps)).toEqual({ kind: "error", error: "requête invalide" });
    expect(await subscribeDevice(request(), deps({ result: "suspended" }).deps)).toEqual({ kind: "error", error: "compte suspendu" });
    expect(await subscribeDevice(request(), deps({ result: "absent" }).deps)).toEqual({ kind: "error", error: "requête invalide" });
  });

  it("unsubscribes even with push switched off, with the same answer either way", async () => {
    const d = deps({ configured: false });
    d.unsubscribe.mockResolvedValueOnce(false);
    expect(await unsubscribeDevice(request({ endpoint: SUBSCRIPTION.endpoint }), d.deps)).toEqual({ kind: "ok", data: { subscribed: false } });
    expect(d.unsubscribe).toHaveBeenCalledWith({ userId: USER }, { endpoint: SUBSCRIPTION.endpoint });
    expect(await unsubscribeDevice(request(), deps({ sameOrigin: () => false }).deps)).toEqual({ kind: "error", error: "origine refusée" });
  });
});

describe("device label", () => {
  it("keeps a browser and a system, never the whole header", () => {
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36")).toBe("Chrome · Android");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari · iOS");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0")).toBe("Edge · Windows");
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Firefox · macOS");
    expect(deviceLabel("curl/8.0")).toBeNull();
    expect(deviceLabel(null)).toBeNull();
  });
});

describe("VAPID configuration", () => {
  const PUBLIC = `B${"x".repeat(86)}`;
  const PRIVATE = "y".repeat(43);

  it("needs all three variables, well formed", () => {
    const env = { PROOFSEEN_VAPID_PUBLIC_KEY: PUBLIC, PROOFSEEN_VAPID_PRIVATE_KEY: PRIVATE, PROOFSEEN_VAPID_SUBJECT: "mailto:contact@proofseen.com" };
    expect(vapidFromEnv(env)).toEqual({ publicKey: PUBLIC, privateKey: PRIVATE, subject: "mailto:contact@proofseen.com" });
    expect(vapidFromEnv({ ...env, PROOFSEEN_VAPID_SUBJECT: "https://proofseen.com" })).not.toBeNull();
    expect(vapidFromEnv({})).toBeNull();
    expect(vapidMisconfigured({})).toBe(false);
    for (const broken of [{ PROOFSEEN_VAPID_SUBJECT: "contact@proofseen.com" }, { PROOFSEEN_VAPID_PRIVATE_KEY: "short" }, { PROOFSEEN_VAPID_PUBLIC_KEY: undefined }]) {
      expect(vapidFromEnv({ ...env, ...broken })).toBeNull();
      expect(vapidMisconfigured({ ...env, ...broken })).toBe(true);
    }
  });

  it("hands the public key to the browser as bytes", () => {
    const bytes = base64UrlBytes("AQIDBP-_");
    expect(bytes === null ? null : [...bytes]).toEqual([1, 2, 3, 4, 255, 191]);
    expect(base64UrlBytes("not base64!")).toBeNull();
    expect(base64UrlBytes(`B${"A".repeat(86)}`)?.length).toBe(65);
  });
});
