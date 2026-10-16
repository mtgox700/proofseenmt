import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appNotifications } from "../src/app-notifications";
import { gdpr } from "../src/gdpr";
import { inbox } from "../src/inbox";
import { liveAudience, parseLiveSignal } from "../src/live";
import { messageDigests, parisDayStart, type DueDigest } from "../src/message-digest";
import { messaging } from "../src/messaging";
import { notifications } from "../src/notifications";
import { readState } from "../src/read-state";
import { retention } from "../src/retention";
import { storedFiles } from "../src/stored-files";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Messagerie vivante (C15), contre un vrai Postgres (PGlite) : non-lus et repères de lecture, pièces jointes et leur
 * accès, destinataires des événements en direct, centre de notifications. Le filtre des coordonnées reste appliqué.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

/** Une entreprise (deux membres) et un freelance, dans un fil accepté où l'entreprise a écrit le premier message. */
const thread = async (accept = true) => {
  const owner = await createUser(t.db);
  const colleague = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, owner);
  await t.db.membership.create({ data: { organisationId, userId: colleague, role: "member" } });
  const freelance = await createUser(t.db);
  const profileId = await createProfile(t.db, freelance);
  const opened = await messaging(t.db).contact({ userId: owner }, organisationId, profileId, "Bonjour, une mission data ?");
  if (opened.kind !== "opened") throw new Error(opened.kind);
  const id = opened.conversation.id;
  if (accept) await messaging(t.db).decide({ userId: freelance }, id, "accepted", new Date());
  return { owner, colleague, freelance, organisationId, profileId, id };
};

const post = async (userId: string, conversationId: string, body: string) => {
  const sent = await messaging(t.db).post({ userId }, conversationId, body);
  if (sent.kind !== "sent") throw new Error(sent.kind);
  return sent.message;
};

/** Une pièce jointe déposée par `userId`, pas encore rattachée à un message. */
const upload = async (userId: string, contentType: "application/pdf" | "image/webp" = "application/pdf"): Promise<string> => {
  const id = randomUUID();
  const result = await storedFiles(t.db).record({ userId }, { id, kind: "message_attachment", contentType, size: 1_000, sha256: "a".repeat(64) });
  if (result !== "recorded") throw new Error(result);
  return id;
};

describe("non-lus et repères de lecture", () => {
  it("compte les messages de l'autre côté, par fil et en tout, jusqu'à la lecture", async () => {
    const c = await thread();
    expect(await readState(t.db).unreadTotal({ userId: c.freelance })).toBe(1);
    expect(await readState(t.db).unreadTotal({ userId: c.owner })).toBe(0);
    await post(c.owner, c.id, "Relance 1");
    await post(c.owner, c.id, "Relance 2");
    const [row] = await inbox(t.db).threads({ userId: c.freelance });
    expect(row).toMatchObject({ id: c.id, unread: 3 });
    expect(await readState(t.db).markRead({ userId: c.freelance }, c.id)).toBe(true);
    expect(await readState(t.db).unreadTotal({ userId: c.freelance })).toBe(0);
    // Déjà à jour : le repère ne bouge pas, et il ne recule jamais.
    expect(await readState(t.db).markRead({ userId: c.freelance }, c.id)).toBe(false);
  });

  it("donne à chaque membre de l'entreprise son propre repère", async () => {
    const c = await thread();
    await post(c.freelance, c.id, "Avec plaisir");
    expect(await readState(t.db).unreadTotal({ userId: c.owner })).toBe(1);
    expect(await readState(t.db).unreadTotal({ userId: c.colleague })).toBe(1);
    await readState(t.db).markRead({ userId: c.owner }, c.id);
    expect(await readState(t.db).unreadTotal({ userId: c.owner })).toBe(0);
    expect(await readState(t.db).unreadTotal({ userId: c.colleague })).toBe(1);
  });

  it("dit « lu » quand l'autre côté a lu, pas quand un collègue a lu", async () => {
    const c = await thread();
    const last = await post(c.owner, c.id, "Vous êtes disponible lundi ?");
    await readState(t.db).markRead({ userId: c.colleague }, c.id);
    expect(await readState(t.db).otherSideReadAt({ userId: c.owner }, c.id)).toBeNull();
    await readState(t.db).markRead({ userId: c.freelance }, c.id);
    const read = await readState(t.db).otherSideReadAt({ userId: c.owner }, c.id);
    expect(read?.getTime()).toBeGreaterThanOrEqual(last.createdAt.getTime());
    // Côté freelance, n'importe quel membre de l'entreprise est l'autre côté.
    expect(await readState(t.db).otherSideReadAt({ userId: c.freelance }, c.id)).not.toBeNull();
  });

  it("ne pose aucun repère pour un tiers, et ne lui dit rien", async () => {
    const c = await thread();
    const stranger = await createUser(t.db);
    expect(await readState(t.db).markRead({ userId: stranger }, c.id)).toBe(false);
    expect(await t.db.conversationRead.count({ where: { userId: stranger } })).toBe(0);
    expect(await readState(t.db).otherSideReadAt({ userId: stranger }, c.id)).toBeNull();
    expect(await readState(t.db).unreadTotal({ userId: stranger })).toBe(0);
    expect(await readState(t.db).markRead({ userId: c.owner }, "pas-un-uuid")).toBe(false);
  });
});

describe("pièces jointes", () => {
  it("dit, avant toute lecture de fichier, si l'acteur peut joindre des fichiers à ce fil (revue vague 3, M3)", async () => {
    const accepted = await thread();
    const pending = await thread(false);
    const stranger = await createUser(t.db);
    expect(await messaging(t.db).canAttach({ userId: accepted.freelance }, accepted.id)).toBe(true);
    expect(await messaging(t.db).canAttach({ userId: accepted.colleague }, accepted.id)).toBe(true);
    expect(await messaging(t.db).canAttach({ userId: pending.owner }, pending.id)).toBe(false);
    expect(await messaging(t.db).canAttach({ userId: stranger }, accepted.id)).toBe(false);
    expect(await messaging(t.db).canAttach({ userId: accepted.owner }, "pas-un-uuid")).toBe(false);
  });

  it("se rattachent au message de leur auteur et ne sont lues que par les parties du fil", async () => {
    const c = await thread();
    const file = await upload(c.freelance);
    // Avant l'envoi : son auteur seul.
    expect(await storedFiles(t.db).readable(file, { userId: c.owner })).toBeNull();
    const sent = await messaging(t.db).post({ userId: c.freelance }, c.id, "Mon devis", { ids: [file], containContact: false });
    expect(sent.kind).toBe("sent");
    if (sent.kind === "sent") expect(sent.message.attachments).toEqual([{ id: file, contentType: "application/pdf" }]);
    expect((await storedFiles(t.db).readable(file, { userId: c.freelance }))?.audience).toBe("owner");
    expect((await storedFiles(t.db).readable(file, { userId: c.owner }))?.audience).toBe("participant");
    expect((await storedFiles(t.db).readable(file, { userId: c.colleague }))?.audience).toBe("participant");
    expect(await storedFiles(t.db).readable(file, { userId: await createUser(t.db) })).toBeNull();
    expect(await storedFiles(t.db).readable(file, null)).toBeNull();
  });

  it("refuse la pièce jointe d'un autre, une pièce déjà envoyée, plus de trois, et avant l'accord du freelance", async () => {
    const c = await thread();
    const theirs = await upload(c.owner);
    expect(await messaging(t.db).post({ userId: c.freelance }, c.id, "Volée", { ids: [theirs], containContact: false })).toEqual({ kind: "attachments" });
    expect(await t.db.message.count({ where: { conversationId: c.id, body: "Volée" } })).toBe(0);

    const mine = await upload(c.freelance);
    await messaging(t.db).post({ userId: c.freelance }, c.id, "Une fois", { ids: [mine], containContact: false });
    expect(await messaging(t.db).post({ userId: c.freelance }, c.id, "Deux fois", { ids: [mine], containContact: false })).toEqual({ kind: "attachments" });

    const four = await Promise.all([1, 2, 3, 4].map(() => upload(c.freelance)));
    expect(await messaging(t.db).post({ userId: c.freelance }, c.id, "Trop", { ids: four, containContact: false })).toEqual({ kind: "attachments" });

    const waiting = await thread(false);
    const early = await upload(waiting.freelance);
    expect(await messaging(t.db).post({ userId: waiting.freelance }, waiting.id, "Mon CV", { ids: [early], containContact: false })).toEqual({ kind: "attachments" });
  });

  it("garde le filtre des coordonnées, dans le texte comme dans une pièce jointe", async () => {
    const c = await thread();
    expect(await messaging(t.db).post({ userId: c.freelance }, c.id, "Appelez-moi au 06 12 34 56 78")).toEqual({ kind: "contact_details" });
    const file = await upload(c.freelance);
    expect(await messaging(t.db).post({ userId: c.freelance }, c.id, "Voici mon CV", { ids: [file], containContact: true })).toEqual({ kind: "contact_details" });
    expect(await t.db.storedFile.findUniqueOrThrow({ where: { id: file }, select: { messageId: true } })).toEqual({ messageId: null });
  });

  it("refuse en base de rattacher un fichier au message d'un autre", async () => {
    const c = await thread();
    const message = await post(c.owner, c.id, "Message de l'entreprise");
    const file = await upload(c.freelance);
    await expect(t.db.storedFile.update({ where: { id: file }, data: { messageId: message.id } })).rejects.toThrow();
  });

  it("purge les pièces jointes restées sans message, jamais celles envoyées", async () => {
    const c = await thread();
    const orphan = await upload(c.freelance);
    const sent = await upload(c.freelance);
    await messaging(t.db).post({ userId: c.freelance }, c.id, "Envoyée", { ids: [sent], containContact: false });
    const purged = await storedFiles(t.db).purgeOrphanAttachments(new Date(Date.now() + 60_000));
    expect(purged).toContain(orphan);
    expect(purged).not.toContain(sent);
    expect(await t.db.storedFile.count({ where: { id: sent } })).toBe(1);
  });
});

describe("événements en direct", () => {
  it("relit les parties d'un fil : le freelance et les membres actuels de l'entreprise", async () => {
    const c = await thread();
    const parties = await liveAudience(t.db).parties(c.id);
    expect(parties?.freelanceUserId).toBe(c.freelance);
    expect([...(parties?.memberUserIds ?? [])].sort()).toEqual([c.owner, c.colleague].sort());
    await t.db.membership.delete({ where: { organisationId_userId: { organisationId: c.organisationId, userId: c.colleague } } });
    expect((await liveAudience(t.db).parties(c.id))?.memberUserIds).toEqual([c.owner]);
    expect(await liveAudience(t.db).parties(randomUUID())).toBeNull();
  });

  it("signale chaque message sur le canal, sans son texte", async () => {
    const c = await thread();
    const received: string[] = [];
    const unlisten = await t.pg.listen("proofseen_live", (payload) => received.push(payload));
    await post(c.owner, c.id, "Texte confidentiel");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await unlisten();
    const signals = received.map((raw) => parseLiveSignal(raw));
    expect(signals).toContainEqual({ kind: "message", conversationId: c.id, senderUserId: c.owner });
    expect(received.join("")).not.toContain("confidentiel");
  });

  it("ignore un signal mal formé", () => {
    expect(parseLiveSignal("pas du json")).toBeNull();
    expect(parseLiveSignal(JSON.stringify({ kind: "message", conversationId: "x" }))).toBeNull();
    expect(parseLiveSignal(undefined)).toBeNull();
  });

  it("compte les non-lus et les notifications d'une personne", async () => {
    const c = await thread();
    expect(await liveAudience(t.db).counts(c.freelance)).toEqual({ messages: 1, notifications: 1 });
  });
});

describe("e-mails d'un compte suspendu (revue vague 3, L12)", () => {
  it("les e-mails de messages sont abandonnés, l'avis de suspension part", async () => {
    const c = await thread();
    const now = new Date();
    await t.db.user.update({ where: { id: c.freelance }, data: { suspendedAt: now, suspensionReason: "Fraude avérée" } });
    await t.db.notification.create({ data: { userId: c.freelance, kind: "account_notice", payload: { notice: "account_suspended", reason: "Fraude avérée", subject: "" } } });
    const pending = await t.db.notification.findMany({ where: { userId: c.freelance, sentAt: null }, select: { id: true, kind: true } });
    expect(pending.some((n) => n.kind !== "account_notice")).toBe(true);
    const claimed = (await notifications(t.db).claim(1000, new Date(now.getTime() + 60 * 60_000))).filter((n) => pending.some((p) => p.id === n.id));
    expect(claimed.map((n) => n.kind)).toEqual(["account_notice"]);
    const dropped = await t.db.notification.findMany({ where: { userId: c.freelance, kind: { not: "account_notice" } }, select: { lastError: true, sentAt: true } });
    expect(dropped.every((n) => n.lastError === "account_suspended" && n.sentAt === null)).toBe(true);
  });

  it("le signal de suspension se lit, celui d'un identifiant mal formé non", () => {
    const userId = randomUUID();
    expect(parseLiveSignal(JSON.stringify({ kind: "suspended", userId }))).toEqual({ kind: "suspended", userId });
    expect(parseLiveSignal(JSON.stringify({ kind: "suspended", userId: "x" }))).toBeNull();
  });
});

describe("résumé quotidien par e-mail", () => {
  it("est désactivé par défaut, part le matin, une fois par jour, seulement avec des non-lus", async () => {
    const c = await thread();
    const digests = messageDigests(t.db);
    const mineOnly = (due: readonly DueDigest[]) => due.filter((d) => d.userId === c.freelance || d.userId === c.owner);
    expect(await digests.enabled({ userId: c.freelance })).toBe(false);
    await digests.set({ userId: c.freelance }, true);
    await digests.set({ userId: c.owner }, true);
    expect(await digests.claimDue(new Date("2026-11-20T06:00:00Z"), 100)).toEqual([]);

    const due = mineOnly(await digests.claimDue(new Date("2026-11-20T08:30:00Z"), 100));
    // L'entreprise n'a rien à lire : rien ne part pour elle, mais son résumé du jour est fait.
    expect(due.map((d) => d.userId)).toEqual([c.freelance]);
    expect(due[0]).toMatchObject({ unread: 1, threads: [{ conversationId: c.id, counterpart: "Acme", unread: 1 }] });
    expect(JSON.stringify(due)).not.toContain("mission data");

    expect(mineOnly(await digests.claimDue(new Date("2026-11-20T15:00:00Z"), 100))).toEqual([]);
    expect(mineOnly(await digests.claimDue(new Date("2026-11-21T08:30:00Z"), 100)).map((d) => d.userId)).toEqual([c.freelance]);
    await digests.set({ userId: c.freelance }, false);
    expect(await digests.enabled({ userId: c.freelance })).toBe(false);
  });

  it("ne part pas pour un compte suspendu (revue vague 3, L12)", async () => {
    const c = await thread();
    const digests = messageDigests(t.db);
    await digests.set({ userId: c.freelance }, true);
    await t.db.user.update({ where: { id: c.freelance }, data: { suspendedAt: new Date(), suspensionReason: "Fraude avérée" } });
    expect((await digests.claimDue(new Date("2026-11-22T08:30:00Z"), 1000)).map((d) => d.userId)).not.toContain(c.freelance);
  });

  it("prend le jour de Paris, heure d'hiver comme heure d'été", () => {
    expect(parisDayStart(new Date("2026-11-20T23:30:00Z")).toISOString()).toBe("2026-11-20T23:00:00.000Z");
    expect(parisDayStart(new Date("2026-07-01T10:00:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });
});

describe("centre de notifications", () => {
  it("écrit une notification dans l'application même si l'e-mail de ce type est coupé", async () => {
    const owner = await createUser(t.db);
    const organisationId = await createOrganisation(t.db, owner);
    const freelance = await createUser(t.db);
    const profileId = await createProfile(t.db, freelance);
    await notifications(t.db).setPreference({ userId: freelance }, "contact_received", false);
    const opened = await messaging(t.db).contact({ userId: owner }, organisationId, profileId, "Bonjour, texte privé");
    if (opened.kind !== "opened") throw new Error(opened.kind);
    const list = await appNotifications(t.db).list({ userId: freelance });
    expect(list.map((n) => [n.kind, n.payload])).toEqual([["contact_received", { conversationId: opened.conversation.id }]]);
    expect(JSON.stringify(list)).not.toContain("privé");
    expect(await t.db.notification.count({ where: { userId: freelance } })).toBe(0);
  });

  it("fait une seule notification non lue par fil, et la lit avec le fil", async () => {
    const c = await thread();
    await readState(t.db).markRead({ userId: c.freelance }, c.id);
    for (let i = 0; i < 3; i += 1) await post(c.owner, c.id, `Relance ${i}`);
    const unread = async () => (await appNotifications(t.db).list({ userId: c.freelance })).filter((n) => n.readAt === null);
    expect((await unread()).filter((n) => n.kind === "message_received")).toHaveLength(1);
    await readState(t.db).markRead({ userId: c.freelance }, c.id);
    expect(await unread()).toEqual([]);
  });

  it("ne laisse marquer lues que ses propres notifications", async () => {
    const c = await thread();
    const [mine] = await appNotifications(t.db).list({ userId: c.freelance });
    if (mine === undefined) throw new Error("aucune notification");
    expect(await appNotifications(t.db).get({ userId: c.owner }, mine.id)).toBeNull();
    expect(await appNotifications(t.db).markRead({ userId: c.owner }, mine.id)).toBe(false);
    expect(await appNotifications(t.db).unreadCount({ userId: c.freelance })).toBe(1);
    expect(await appNotifications(t.db).markRead({ userId: c.freelance }, mine.id)).toBe(true);
    expect(await appNotifications(t.db).unreadCount({ userId: c.freelance })).toBe(0);
    await post(c.owner, c.id, "Nouveau");
    expect(await appNotifications(t.db).markAllRead({ userId: c.freelance })).toBe(1);
  });

  it("purge les notifications lues après 90 jours, les non lues après un an", async () => {
    const userId = await createUser(t.db);
    const now = new Date("2027-06-01T08:00:00Z");
    const day = 86_400_000;
    const at = (days: number) => new Date(now.getTime() - days * day);
    await t.db.appNotification.createMany({
      data: [
        { userId, kind: "measurement_done", payload: {}, createdAt: at(120), readAt: at(100) },
        { userId, kind: "measurement_done", payload: {}, createdAt: at(120), readAt: at(10) },
        { userId, kind: "measurement_done", payload: {}, createdAt: at(200) },
        { userId, kind: "measurement_done", payload: {}, createdAt: at(400) },
      ],
    });
    const report = await retention(t.db).purge(now);
    expect(report.appNotifications).toBeGreaterThanOrEqual(2);
    expect(await t.db.appNotification.count({ where: { userId } })).toBe(2);
  });

  it("rend repères, notifications et résumé dans l'export, et les efface avec le compte", async () => {
    const c = await thread();
    await readState(t.db).markRead({ userId: c.freelance }, c.id);
    await t.db.messageDigest.create({ data: { userId: c.freelance } });
    const exported = (await gdpr(t.db).exportUser(c.freelance, new Date()))?.liveMessaging as { reads: unknown[]; appNotifications: unknown[]; dailyDigest: unknown };
    expect(exported.reads).toHaveLength(1);
    expect(exported.appNotifications.length).toBeGreaterThan(0);
    expect(exported.dailyDigest).not.toBeNull();
    expect(await gdpr(t.db).eraseUser(c.freelance)).toBe("erased");
    expect(await t.db.conversationRead.count({ where: { userId: c.freelance } })).toBe(0);
    expect(await t.db.appNotification.count({ where: { userId: c.freelance } })).toBe(0);
    expect(await t.db.messageDigest.count({ where: { userId: c.freelance } })).toBe(0);
  });
});
