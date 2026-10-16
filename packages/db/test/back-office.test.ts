import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accountNotices } from "../src/account-notices";
import type { Operator } from "../src/back-office";
import { feedback } from "../src/feedback";
import { feedbackTriage } from "../src/feedback-triage";
import { moderation } from "../src/moderation";
import { operatorLog } from "../src/operator-log";
import { operatorStats } from "../src/operator-stats";
import { profiles } from "../src/profiles";
import { retention } from "../src/retention";
import { userDesk } from "../src/user-desk";
import { users } from "../src/users";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Le journal des opérateurs et les décisions sur les comptes (C19) : chaque action laisse sa trace dans la même
 * transaction, la trace ne se modifie ni ne s'efface, et un compte suspendu le sait.
 */

let t: TestDatabase;
let operator: Operator;

beforeAll(async () => {
  t = await openTestDatabase();
  operator = { role: "operator", userId: await createUser(t.db) };
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-16T10:00:00Z");
const REASON = "Annonce trompeuse signalée";
let drawn = 0;
const nextReference = (): string => `FR-BO${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}ZQ`;

const published = async () => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create({ userId }, { headline: "Dev", summary: "Résumé.", city: "Lyon", workMode: "remote", skills: ["Go"] }, nextReference);
  if (created === null) throw new Error("profil non créé");
  await profiles(t.db).setVisibility({ userId }, "pseudonymous");
  return { userId, id: created.id, reference: created.reference };
};

describe("capacité d'opérateur", () => {
  it("aucun dépôt du back-office ne s'ouvre sans rôle d'opérateur", () => {
    const fake = { role: "company", userId: operator.userId } as unknown as Operator;
    expect(() => moderation(t.db, fake)).toThrow(/opérateur/);
    expect(() => userDesk(t.db, fake)).toThrow(/opérateur/);
    expect(() => operatorLog(t.db, { role: "operator", userId: "pas-un-uuid" })).toThrow(/opérateur/);
  });
});

describe("journal des opérateurs", () => {
  it("écrit l'action, son motif et l'opérateur, dans la même transaction que l'action", async () => {
    const p = await published();
    expect(await moderation(t.db, operator).hide("profile", p.reference, REASON, NOW)).toBe("done");
    const { items } = await operatorLog(t.db, operator).list({ targetId: p.id });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ action: "profile_hidden", targetType: "profile", reason: REASON, operatorUserId: operator.userId, metadata: { label: p.reference } });
    // Un second masquage ne change rien et n'écrit rien.
    expect(await moderation(t.db, operator).hide("profile", p.reference, REASON, NOW)).toBe("unchanged");
    expect((await operatorLog(t.db, operator).list({ targetId: p.id })).items).toHaveLength(1);
  });

  it("filtre par action et par période", async () => {
    const p = await published();
    await moderation(t.db, operator).hide("profile", p.reference, REASON, NOW);
    await moderation(t.db, operator).restore("profile", p.reference, "Erreur corrigée", new Date(NOW.getTime() + 60_000));
    const restored = await operatorLog(t.db, operator).list({ targetId: p.id, action: "profile_restored" });
    expect(restored.items.map((i) => i.reason)).toEqual(["Erreur corrigée"]);
    const before = await operatorLog(t.db, operator).list({ targetId: p.id, to: new Date(NOW.getTime() + 1) });
    expect(before.items.map((i) => i.action)).toEqual(["profile_hidden"]);
  });

  it("refuse toute modification et toute suppression, et un vidage de la table", async () => {
    const p = await published();
    await moderation(t.db, operator).hide("profile", p.reference, REASON, NOW);
    const row = await t.db.operatorAction.findFirstOrThrow({ where: { targetId: p.id } });
    await expect(t.db.operatorAction.update({ where: { id: row.id }, data: { reason: "Réécrit après coup" } })).rejects.toThrow(/ajout seul/);
    await expect(t.db.operatorAction.delete({ where: { id: row.id } })).rejects.toThrow(/ajout seul/);
    await expect(t.db.$executeRawUnsafe(`TRUNCATE "OperatorAction"`)).rejects.toThrow(/immuable/);
    expect(await t.db.operatorAction.count({ where: { id: row.id } })).toBe(1);
  });

  it("exige un motif pour toute décision qui touche quelqu'un, jusque dans la base", async () => {
    const p = await published();
    await expect(moderation(t.db, operator).hide("profile", p.reference, " ", NOW)).rejects.toThrow();
    await expect(
      t.db.operatorAction.create({ data: { operatorUserId: operator.userId, action: "user_suspended", targetType: "user", targetId: p.userId, reason: null } }),
    ).rejects.toThrow(/OperatorAction_reason_chk/);
  });

  it("garde le journal cinq ans, puis la purge l'emporte", async () => {
    const old = new Date(NOW);
    old.setUTCFullYear(old.getUTCFullYear() - 6);
    const p = await published();
    await t.db.operatorAction.create({ data: { operatorUserId: operator.userId, action: "profile_hidden", targetType: "profile", targetId: p.id, reason: REASON, createdAt: old } });
    const report = await retention(t.db).purge(new Date());
    expect(report.operatorActions).toBeGreaterThanOrEqual(1);
    expect(await t.db.operatorAction.count({ where: { targetId: p.id } })).toBe(0);
  });

  it("survit à l'effacement du compte visé : aucune clé étrangère ne l'emporte", async () => {
    const p = await published();
    await userDesk(t.db, operator).suspend(p.userId, REASON, NOW);
    await t.db.user.delete({ where: { id: p.userId } });
    expect(await t.db.operatorAction.count({ where: { targetId: p.userId } })).toBe(1);
  });
});

describe("modération : la personne est prévenue et voit le motif", () => {
  it("e-mail mis en file et avis dans son espace, levé au rétablissement", async () => {
    const p = await published();
    await moderation(t.db, operator).hide("profile", p.reference, REASON, NOW);
    const mail = await t.db.notification.findFirstOrThrow({ where: { userId: p.userId, kind: "account_notice" } });
    expect(mail.payload).toMatchObject({ notice: "profile_hidden", reason: REASON });
    const standing = await accountNotices(t.db).standing({ userId: p.userId });
    expect(standing.notices).toEqual([{ target: "profile", id: p.id, label: p.reference, reason: REASON, moderatedAt: NOW }]);
    // Personne d'autre ne voit l'avis.
    expect((await accountNotices(t.db).standing({ userId: operator.userId })).notices).toEqual([]);
    await moderation(t.db, operator).restore("profile", p.reference, "Motif levé", NOW);
    expect((await accountNotices(t.db).standing({ userId: p.userId })).notices).toEqual([]);
  });

  it("une cible inconnue ou mal écrite est absente, sans trace", async () => {
    const before = await t.db.operatorAction.count();
    expect(await moderation(t.db, operator).hide("profile", "FR-ZZZZZ", REASON, NOW)).toBe("absent");
    expect(await moderation(t.db, operator).hide("mission", "pas-un-id", REASON, NOW)).toBe("absent");
    expect(await moderation(t.db, operator).hide("company", "Pas Une Adresse!", REASON, NOW)).toBe("absent");
    expect(await t.db.operatorAction.count()).toBe(before);
  });

  it("une entreprise masquée avec ses missions : journal, e-mail aux administrateurs, avis, liste (revue vague 3, M5)", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    expect(await moderation(t.db, operator).hide("organisation", org, REASON, NOW)).toBe("done");
    expect(await t.db.operatorAction.findFirstOrThrow({ where: { targetId: org, action: "organisation_hidden" } })).toMatchObject({ targetType: "organisation", reason: REASON });
    const mail = await t.db.notification.findFirstOrThrow({ where: { userId: owner, kind: "account_notice" }, orderBy: { createdAt: "desc" } });
    expect(mail.payload).toMatchObject({ notice: "organisation_hidden", reason: REASON });
    expect((await accountNotices(t.db).standing({ userId: owner })).notices).toEqual([expect.objectContaining({ target: "organisation", id: org, reason: REASON })]);
    expect((await moderation(t.db, operator).hidden()).find((h) => h.id === org)).toMatchObject({ target: "organisation", key: org, reason: REASON });
    expect(await moderation(t.db, operator).hide("organisation", "00000000-0000-4000-8000-000000000000", REASON, NOW)).toBe("absent");
    expect(await moderation(t.db, operator).restore("organisation", org, "Masque levé", NOW)).toBe("done");
    expect(await t.db.operatorAction.count({ where: { targetId: org, action: "organisation_restored" } })).toBe(1);
    expect((await accountNotices(t.db).standing({ userId: owner })).notices).toEqual([]);
  });

  it("liste ce qui est masqué, avec ce qu'il faut pour le rétablir", async () => {
    const p = await published();
    await moderation(t.db, operator).hide("profile", p.reference, REASON, NOW);
    const hidden = await moderation(t.db, operator).hidden();
    expect(hidden.find((h) => h.id === p.id)).toMatchObject({ target: "profile", key: p.reference, reason: REASON });
  });
});

describe("suspension d'un compte", () => {
  it("se lit à la connexion, motif compris, et se lève", async () => {
    const userId = await createUser(t.db);
    const row = await t.db.user.findUniqueOrThrow({ where: { id: userId } });
    const identity = { clerkId: row.clerkId, email: row.email, displayName: row.displayName };
    expect((await users(t.db).ensure(identity)).suspension).toBeNull();
    expect(await userDesk(t.db, operator).suspend(userId, REASON, NOW)).toBe("done");
    expect((await users(t.db).ensure(identity)).suspension).toEqual({ at: NOW, reason: REASON });
    expect((await accountNotices(t.db).standing({ userId })).suspended).toEqual({ at: NOW, reason: REASON });
    expect(await userDesk(t.db, operator).suspend(userId, REASON, NOW)).toBe("unchanged");
    expect(await userDesk(t.db, operator).restore(userId, "Recours accepté", NOW)).toBe("done");
    expect((await users(t.db).ensure(identity)).suspension).toBeNull();
  });

  it("un opérateur ne se suspend pas lui-même", async () => {
    expect(await userDesk(t.db, operator).suspend(operator.userId, REASON, NOW)).toBe("self");
  });
});

describe("comptes vus par l'opérateur", () => {
  it("cherche par adresse ou par référence, et résume sans jamais montrer un message", async () => {
    const p = await published();
    const email = (await t.db.user.findUniqueOrThrow({ where: { id: p.userId }, select: { email: true } })).email;
    expect((await userDesk(t.db, operator).search(email)).map((u) => u.id)).toEqual([p.userId]);
    expect((await userDesk(t.db, operator).search(p.reference.toLowerCase())).map((u) => u.id)).toEqual([p.userId]);
    expect(await userDesk(t.db, operator).search("x")).toEqual([]);
    const summary = await userDesk(t.db, operator).summary(p.userId);
    expect(summary?.profile?.reference).toBe(p.reference);
    expect(summary?.counts.messagesSent).toBe(0);
    expect(JSON.stringify(summary)).not.toMatch(/body/);
    expect(await userDesk(t.db, operator).summary("pas-un-id")).toBeNull();
  });

  it("l'export RGPD pour une demande de support est journalisé avec la demande", async () => {
    const p = await published();
    const exported = await userDesk(t.db, operator).exportFor(p.userId, "Demande d'accès reçue le 16/10", NOW);
    expect(exported?.freelanceProfile).not.toBeNull();
    expect((await operatorLog(t.db, operator).list({ targetId: p.userId, action: "user_exported" })).items).toHaveLength(1);
    expect(await userDesk(t.db, operator).exportFor("01890000-0000-7000-8000-000000000000", "Demande inconnue", NOW)).toBeNull();
  });
});

describe("retours de la bêta", () => {
  it("se classent avec une note, et le classement est journalisé", async () => {
    const { id } = await feedback(t.db).submit(null, { kind: "bug", side: "visitor", body: "Le bouton ne répond pas." });
    const desk = feedbackTriage(t.db, operator);
    expect((await desk.list({ status: "new" })).items.map((i) => i.id)).toContain(id);
    expect(await desk.triage(id, { status: "planned", note: "Pour la semaine prochaine" }, NOW)).toBe("done");
    const planned = (await desk.list({ status: "planned" })).items.find((i) => i.id === id);
    expect(planned).toMatchObject({ status: "planned", triageNote: "Pour la semaine prochaine", appealUserId: null });
    expect((await operatorLog(t.db, operator).list({ targetId: id })).items[0]?.metadata).toEqual({ status: "planned", noted: true });
    expect(await desk.triage("01890000-0000-7000-8000-000000000000", { status: "done", note: "" }, NOW)).toBe("absent");
  });
});

describe("chiffres de l'opérateur", () => {
  it("lit la dépense des mesures dans le registre et la profondeur de la file", async () => {
    await t.db.measurementSpend.create({ data: { requestId: "01890000-0000-7000-8000-000000000001", attempt: 1, reservedCents: 40, actualCents: 25, startedAt: NOW, settledAt: NOW } });
    const seen = await operatorStats(t.db, operator).measurements(new Date(NOW.getTime() + 3_600_000));
    expect(seen.spentTodayCents).toBe(25);
    expect(seen.spentMonthCents).toBe(25);
    expect(seen.queued).toBe(0);
    const funnel = await operatorStats(t.db, operator).funnel({});
    expect(funnel.freelance.profiles).toBeGreaterThan(0);
  });
});
