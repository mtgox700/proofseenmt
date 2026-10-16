import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appNotifications } from "../src/app-notifications";
import { gdpr } from "../src/gdpr";
import { messaging } from "../src/messaging";
import { MAX_PUSH_SUBSCRIPTIONS, pushEndpoint, pushSubscriptions } from "../src/push-subscriptions";
import { MAX_PUSH_ATTEMPTS, PUSH_STALE_MS, pushQueue } from "../src/push-queue";
import { retention } from "../src/retention";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Notifications poussées (C20), contre un vrai Postgres (PGlite) : abonnements et leurs garde-fous (services connus
 * seulement, dix appareils, un appareil à un seul compte), file d'envoi (rien pour un compte suspendu, rien de lu,
 * jamais le texte d'un message), appareils disparus, conservation et RGPD.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
let device = 0;

/** L'abonnement d'un appareil neuf, tel que le rend `PushSubscription.toJSON()` dans Chrome. */
const browserSubscription = (endpoint?: string) => {
  device += 1;
  return { endpoint: endpoint ?? `https://fcm.googleapis.com/fcm/send/device-${device}`, expirationTime: null, keys: { p256dh: P256DH, auth: AUTH } };
};

const subscribe = async (userId: string, endpoint?: string) => {
  const input = browserSubscription(endpoint);
  expect(await pushSubscriptions(t.db).subscribe({ userId }, input, "Chrome · Android")).toBe("subscribed");
  return input.endpoint;
};

const suspend = (userId: string) => t.db.user.update({ where: { id: userId }, data: { suspendedAt: new Date(), suspensionReason: "Spam répété" } });

/** Une entreprise qui contacte un freelance : le freelance reçoit une notification « contact ». */
const contact = async (body = "Bonjour, une mission data ?") => {
  const owner = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, owner);
  const freelance = await createUser(t.db);
  const profileId = await createProfile(t.db, freelance);
  return { owner, freelance, send: () => messaging(t.db).contact({ userId: owner }, organisationId, profileId, body) };
};

const NOW = () => new Date(Date.now() + 1_000);

describe("adresse d'envoi", () => {
  it("n'accepte que les services de notifications des navigateurs, en https", () => {
    expect(pushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(pushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).not.toBeNull();
    expect(pushEndpoint("https://web.push.apple.com/QGx")).not.toBeNull();
    expect(pushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).not.toBeNull();
    for (const refused of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/push",
      "https://evil.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/x",
      "https://user:pw@fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/fcm/send/abc",
      "https://notify.windows.com/x",
      "https://fcm.googleapis.com/",
      "pas une adresse",
    ]) {
      expect(pushEndpoint(refused), refused).toBeNull();
    }
  });
});

describe("abonnements", () => {
  it("refuse une adresse inconnue ou des clés invalides, et abonne un appareil une seule fois", async () => {
    const userId = await createUser(t.db);
    const subs = pushSubscriptions(t.db);
    expect(await subs.subscribe({ userId }, { ...browserSubscription(), endpoint: "https://10.0.0.1/push" }, null)).toBe("invalid");
    expect(await subs.subscribe({ userId }, { ...browserSubscription(), keys: { p256dh: "court", auth: AUTH } }, null)).toBe("invalid");
    expect(await subs.subscribe({ userId }, { endpoint: "https://fcm.googleapis.com/fcm/send/x" }, null)).toBe("invalid");
    expect(await subs.subscribe({ userId }, "n'importe quoi", null)).toBe("invalid");
    const endpoint = await subscribe(userId);
    await subscribe(userId, endpoint);
    expect(await subs.count({ userId })).toBe(1);
    const [row] = await t.db.pushSubscription.findMany({ where: { userId } });
    expect(row).toMatchObject({ endpoint, userAgent: "Chrome · Android", failures: 0, lastSuccessAt: null });
  });

  it("garde dix appareils au plus : le onzième remplace celui qui a servi le moins récemment", async () => {
    const userId = await createUser(t.db);
    const endpoints: string[] = [];
    for (let i = 0; i < MAX_PUSH_SUBSCRIPTIONS; i += 1) endpoints.push(await subscribe(userId));
    const [used, idle] = endpoints;
    if (used === undefined || idle === undefined) throw new Error("abonnements absents");
    // Le premier vient de recevoir une notification ; le deuxième, abonné hier, n'a jamais rien reçu : c'est lui qui part.
    await t.db.pushSubscription.update({ where: { endpoint: used }, data: { lastSuccessAt: new Date() } });
    await t.db.pushSubscription.update({ where: { endpoint: idle }, data: { createdAt: new Date(Date.now() - 86_400_000) } });
    const eleventh = await subscribe(userId);
    const kept = (await t.db.pushSubscription.findMany({ where: { userId }, select: { endpoint: true } })).map((r) => r.endpoint);
    expect(kept).toHaveLength(MAX_PUSH_SUBSCRIPTIONS);
    expect(kept).toContain(eleventh);
    expect(kept).toContain(used);
    expect(kept).not.toContain(idle);
  });

  it("refuse en base un onzième appareil écrit sans passer par le dépôt", async () => {
    const userId = await createUser(t.db);
    for (let i = 0; i < MAX_PUSH_SUBSCRIPTIONS; i += 1) await subscribe(userId);
    await expect(t.db.pushSubscription.create({ data: { userId, endpoint: "https://fcm.googleapis.com/fcm/send/onze", p256dh: P256DH, auth: AUTH } })).rejects.toThrow(/dix appareils/);
  });

  it("refuse en base une adresse qui n'est pas en https", async () => {
    const userId = await createUser(t.db);
    await expect(t.db.pushSubscription.create({ data: { userId, endpoint: "http://fcm.googleapis.com/x", p256dh: P256DH, auth: AUTH } })).rejects.toThrow();
  });

  it("donne l'appareil au dernier compte qui s'y abonne", async () => {
    const first = await createUser(t.db);
    const second = await createUser(t.db);
    const endpoint = await subscribe(first);
    await subscribe(second, endpoint);
    expect(await pushSubscriptions(t.db).count({ userId: first })).toBe(0);
    expect(await pushSubscriptions(t.db).count({ userId: second })).toBe(1);
  });

  it("ne désabonne que l'appareil de la personne", async () => {
    const owner = await createUser(t.db);
    const stranger = await createUser(t.db);
    const endpoint = await subscribe(owner);
    expect(await pushSubscriptions(t.db).unsubscribe({ userId: stranger }, { endpoint })).toBe(false);
    expect(await pushSubscriptions(t.db).unsubscribe({ userId: owner }, { endpoint: "https://10.0.0.1/x" })).toBe(false);
    expect(await pushSubscriptions(t.db).count({ userId: owner })).toBe(1);
    expect(await pushSubscriptions(t.db).unsubscribe({ userId: owner }, { endpoint })).toBe(true);
    expect(await pushSubscriptions(t.db).count({ userId: owner })).toBe(0);
  });

  it("refuse l'abonnement d'un compte suspendu", async () => {
    const userId = await createUser(t.db);
    await suspend(userId);
    expect(await pushSubscriptions(t.db).subscribe({ userId }, browserSubscription(), null)).toBe("suspended");
  });
});

describe("file d'envoi", () => {
  it("met en file une poussée par appareil, sans le texte du message", async () => {
    const c = await contact("Bonjour, une mission data confidentielle ?");
    const endpoint = await subscribe(c.freelance);
    const second = await subscribe(c.freelance);
    expect((await c.send()).kind).toBe("opened");
    // L'auteur du premier message n'a pas d'appareil abonné : rien pour lui.
    expect(await t.db.pushDelivery.count({ where: { subscription: { userId: c.owner } } })).toBe(0);
    const claimed = (await pushQueue(t.db).claim(50, NOW())).filter((p) => [endpoint, second].includes(p.subscription.endpoint));
    expect(claimed).toHaveLength(2);
    for (const push of claimed) {
      expect(push.notification.kind).toBe("contact_received");
      expect(push.lang).toBe("fr");
      expect(JSON.stringify(push)).not.toContain("confidentielle");
      expect(Object.keys(push.notification.payload).every((key) => ["conversationId", "status"].includes(key))).toBe(true);
    }
    // Pris en charge : un second passage ne reprend pas les mêmes lignes pendant le bail.
    expect((await pushQueue(t.db).claim(50, NOW())).filter((p) => p.subscription.endpoint === endpoint)).toHaveLength(0);
  });

  it("ne pousse rien vers un compte suspendu, ni avant ni après la mise en file", async () => {
    const before = await contact();
    await subscribe(before.freelance);
    await suspend(before.freelance);
    await before.send();
    expect(await t.db.pushDelivery.count({ where: { subscription: { userId: before.freelance } } })).toBe(0);

    const after = await contact();
    await subscribe(after.freelance);
    await after.send();
    expect(await t.db.pushDelivery.count({ where: { subscription: { userId: after.freelance } } })).toBe(1);
    await suspend(after.freelance);
    const endpoints = (await t.db.pushSubscription.findMany({ where: { userId: after.freelance }, select: { endpoint: true } })).map((r) => r.endpoint);
    const claimed = await pushQueue(t.db).claim(500, NOW());
    expect(claimed.some((p) => endpoints.includes(p.subscription.endpoint))).toBe(false);
    expect(await t.db.pushDelivery.count({ where: { subscription: { userId: after.freelance } } })).toBe(0);
  });

  it("retire une notification déjà lue dans l'application", async () => {
    const c = await contact();
    await subscribe(c.freelance);
    await c.send();
    const [notification] = await appNotifications(t.db).list({ userId: c.freelance });
    if (notification === undefined) throw new Error("notification absente");
    await appNotifications(t.db).markRead({ userId: c.freelance }, notification.id);
    const claimed = await pushQueue(t.db).claim(50, NOW());
    expect(claimed.some((p) => p.notification.id === notification.id)).toBe(false);
    expect(await t.db.pushDelivery.count({ where: { notificationId: notification.id } })).toBe(0);
  });

  it("note la réussite, supprime un appareil disparu, réessaie puis abandonne", async () => {
    const queue = pushQueue(t.db);
    const ok = await contact();
    const okEndpoint = await subscribe(ok.freelance);
    const gone = await contact();
    const goneEndpoint = await subscribe(gone.freelance);
    const flaky = await contact();
    const flakyEndpoint = await subscribe(flaky.freelance);
    await Promise.all([ok.send(), gone.send(), flaky.send()]);

    let now = NOW();
    const first = await queue.claim(100, now);
    const find = (endpoint: string) => {
      const push = first.find((p) => p.subscription.endpoint === endpoint);
      if (push === undefined) throw new Error(`rien pour ${endpoint}`);
      return push;
    };
    await queue.markDelivered(find(okEndpoint), now);
    await queue.markGone(find(goneEndpoint));
    expect(await t.db.pushSubscription.findUnique({ where: { endpoint: okEndpoint }, select: { lastSuccessAt: true, failures: true } })).toEqual({ lastSuccessAt: now, failures: 0 });
    expect(await t.db.pushSubscription.count({ where: { endpoint: goneEndpoint } })).toBe(0);
    expect(await t.db.pushDelivery.count({ where: { subscription: { endpoint: okEndpoint } } })).toBe(0);

    let push = find(flakyEndpoint);
    for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt += 1) {
      await queue.markFailed(push, now);
      now = new Date(now.getTime() + 60 * 60_000);
      const again = (await queue.claim(100, now)).find((p) => p.subscription.endpoint === flakyEndpoint);
      if (attempt < MAX_PUSH_ATTEMPTS) {
        if (again === undefined) throw new Error(`pas de nouvel essai après l'échec ${attempt}`);
        expect(again.attempts).toBe(attempt);
        push = again;
      } else {
        expect(again).toBeUndefined();
      }
    }
    expect(await t.db.pushSubscription.findUnique({ where: { endpoint: flakyEndpoint }, select: { failures: true } })).toEqual({ failures: MAX_PUSH_ATTEMPTS });
  });

  it("abandonne une poussée qui attend depuis plus d'un jour", async () => {
    const c = await contact();
    await subscribe(c.freelance);
    await c.send();
    const later = new Date(Date.now() + PUSH_STALE_MS + 60_000);
    expect((await pushQueue(t.db).claim(500, later)).some((p) => p.lang === "fr" && p.notification.kind === "contact_received")).toBe(false);
    expect(await t.db.pushDelivery.count({ where: { subscription: { userId: c.freelance } } })).toBe(0);
  });
});

describe("conservation et RGPD", () => {
  it("purge un appareil resté 90 jours sans rien recevoir", async () => {
    const userId = await createUser(t.db);
    const idle = await subscribe(userId);
    const fresh = await subscribe(userId);
    const old = new Date(Date.now() - 91 * 86_400_000);
    await t.db.pushSubscription.update({ where: { endpoint: idle }, data: { createdAt: old, lastSuccessAt: old } });
    await t.db.pushSubscription.update({ where: { endpoint: fresh }, data: { createdAt: old, lastSuccessAt: new Date() } });
    const report = await retention(t.db).purge(new Date());
    expect(report.pushSubscriptions).toBeGreaterThanOrEqual(1);
    const kept = (await t.db.pushSubscription.findMany({ where: { userId }, select: { endpoint: true } })).map((r) => r.endpoint);
    expect(kept).toEqual([fresh]);
  });

  it("exporte le service de chaque appareil, jamais son adresse ni ses clés, et l'efface avec le compte", async () => {
    const userId = await createUser(t.db);
    const endpoint = await subscribe(userId, "https://updates.push.services.mozilla.com/wpush/v2/secret-token");
    const exported = await gdpr(t.db).exportUser(userId, new Date());
    const text = JSON.stringify(exported);
    expect(text).toContain("updates.push.services.mozilla.com");
    expect(text).not.toContain("secret-token");
    expect(text).not.toContain(AUTH);
    expect(await gdpr(t.db).eraseUser(userId)).toBe("erased");
    expect(await t.db.pushSubscription.count({ where: { endpoint } })).toBe(0);
  });
});
