import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { messaging } from "../src/messaging";
import { RETENTION, retention } from "../src/retention";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2027-06-01T00:00:00Z");
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * 86_400_000);

describe("durées de conservation", () => {
  it("purge ce qui a dépassé sa durée, et garde ce qui est juste en deçà", async () => {
    const user = await createUser(t.db);
    const oldNotif = await t.db.notification.create({ data: { userId: user, kind: "message_received", payload: {}, createdAt: daysAgo(RETENTION.notificationsDays + 1), sentAt: daysAgo(RETENTION.notificationsDays) }, select: { id: true } });
    const freshNotif = await t.db.notification.create({ data: { userId: user, kind: "message_received", payload: {}, createdAt: daysAgo(RETENTION.notificationsDays - 1) }, select: { id: true } });
    const waiting = await t.db.notification.create({ data: { userId: user, kind: "message_received", payload: {}, createdAt: daysAgo(RETENTION.notificationsDays + 30) }, select: { id: true } });
    const abandoned = await t.db.notification.create({ data: { userId: user, kind: "message_received", payload: {}, createdAt: daysAgo(RETENTION.unsentNotificationsDays + 1) }, select: { id: true } });
    await t.db.stripeEvent.createMany({ data: [
      { id: "evt_retention_old", type: "payment_intent.succeeded", receivedAt: daysAgo(RETENTION.stripeEventsDays + 1) },
      { id: "evt_retention_fresh", type: "payment_intent.succeeded", receivedAt: daysAgo(RETENTION.stripeEventsDays - 1) },
    ] });
    const consentAt = daysAgo(RETENTION.auditRequestsDays + 2);
    await t.db.auditRequest.createMany({ data: [
      { reference: "FR-RTQLD", displayName: "Ancien", email: "ancien@test.fr", urls: ["https://ancien.dev"], lang: "fr", consentAt, createdAt: daysAgo(RETENTION.auditRequestsDays + 1) },
      { reference: "FR-RTNEW", displayName: "Récent", email: "recent@test.fr", urls: ["https://recent.dev"], lang: "fr", consentAt, createdAt: daysAgo(RETENTION.auditRequestsDays - 1) },
    ] });

    const report = await retention(t.db).purge(NOW);

    expect(report.notifications).toBeGreaterThanOrEqual(1);
    expect(await t.db.notification.count({ where: { id: oldNotif.id } })).toBe(0);
    expect(await t.db.notification.count({ where: { id: freshNotif.id } })).toBe(1);
    // Jamais envoyée faute de transport : elle attend encore, puis part au bout d'un an.
    expect(await t.db.notification.count({ where: { id: waiting.id } })).toBe(1);
    expect(await t.db.notification.count({ where: { id: abandoned.id } })).toBe(0);
    expect(await t.db.stripeEvent.findMany({ where: { id: { startsWith: "evt_retention_" } }, select: { id: true } })).toEqual([{ id: "evt_retention_fresh" }]);
    expect(await t.db.auditRequest.findMany({ where: { reference: { in: ["FR-RTQLD", "FR-RTNEW"] } }, select: { reference: true } })).toEqual([{ reference: "FR-RTNEW" }]);
  });

  it("supprime une prise de contact restée sans réponse un an, garde le refus sans ses messages, jamais une conversation acceptée", async () => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const silent = await createProfile(t.db, await createUser(t.db));
    const talking = await createProfile(t.db, await createUser(t.db));
    const refusing = await createProfile(t.db, await createUser(t.db));
    const refusedLongAgo = await createProfile(t.db, await createUser(t.db));
    const opened = await Promise.all([silent, talking, refusing, refusedLongAgo].map((p) => messaging(t.db).contact({ userId: recruiter }, org, p, "Bonjour, êtes-vous disponible ?")));
    const [pending, accepted, declined, declinedOld] = opened.map((o) => {
      if (o.kind !== "opened") throw new Error("fil non ouvert");
      return o.conversation.id;
    });
    if (pending === undefined || accepted === undefined || declined === undefined || declinedOld === undefined) throw new Error("fils manquants");
    const stale = daysAgo(RETENTION.unansweredConversationsDays + 1);
    await t.db.conversation.update({ where: { id: pending }, data: { lastMessageAt: stale } });
    await t.db.conversation.update({ where: { id: accepted }, data: { status: "accepted", decidedAt: stale, lastMessageAt: stale } });
    // Refusé hier après treize mois sans réponse : le refus vient d'être décidé, rien ne part encore.
    await t.db.conversation.update({ where: { id: declined }, data: { status: "declined", decidedAt: daysAgo(1), lastMessageAt: stale } });
    await t.db.conversation.update({ where: { id: declinedOld }, data: { status: "declined", decidedAt: stale, lastMessageAt: stale } });

    await retention(t.db).purge(NOW);

    expect(await t.db.conversation.count({ where: { id: pending } })).toBe(0);
    expect(await t.db.message.count({ where: { conversationId: pending } })).toBe(0);
    expect(await t.db.conversation.count({ where: { id: accepted } })).toBe(1);
    expect(await t.db.message.count({ where: { conversationId: declined } })).toBe(1);
    expect(await t.db.conversation.findUniqueOrThrow({ where: { id: declinedOld }, select: { status: true } })).toEqual({ status: "declined" });
    expect(await t.db.message.count({ where: { conversationId: declinedOld } })).toBe(0);
  });

  it("ne touche à aucun contrat, paiement ni facture", async () => {
    const before = await Promise.all([t.db.contract.count(), t.db.payment.count(), t.db.invoice.count()]);
    await retention(t.db).purge(new Date("2099-01-01T00:00:00Z"));
    expect(await Promise.all([t.db.contract.count(), t.db.payment.count(), t.db.invoice.count()])).toEqual(before);
  });
});
