import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applications } from "../src/applications";
import { messaging } from "../src/messaging";
import { missionAlerts, MAX_ALERTS_PER_USER } from "../src/mission-alerts";
import { missions, type MissionInput } from "../src/missions";
import { MAX_ATTEMPTS, notifications } from "../src/notifications";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const MISSION: MissionInput = { title: "Data engineer", description: "Pipeline Spark.", workMode: "remote", skills: ["Spark"] };

const pending = (userId: string) => t.db.notification.findMany({ where: { userId, sentAt: null }, select: { kind: true, payload: true }, orderBy: { createdAt: "asc" } });

/** Vide la file : chaque test part d'une file sans reste des précédents. */
const drain = async () => {
  await t.db.notification.updateMany({ where: { sentAt: null }, data: { sentAt: new Date() } });
};

const setup = async () => {
  const recruiter = await createUser(t.db);
  const colleague = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  await t.db.membership.create({ data: { organisationId: org, userId: colleague, role: "member" } });
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  return { recruiter, colleague, org, freelanceUser, profile };
};

describe("ce qui part en file, et ce qui n'y part pas", () => {
  it("prévient le freelance d'une prise de contact, sans jamais recopier le message", async () => {
    const s = await setup();
    await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Message confidentiel du premier contact");
    const queued = await pending(s.freelanceUser);
    expect(queued.map((n) => n.kind)).toEqual(["contact_received"]);
    expect(JSON.stringify(queued)).not.toContain("confidentiel");
  });

  it("fait un seul e-mail pour dix messages d'affilée, puis recommence une fois celui-ci envoyé", async () => {
    const s = await setup();
    const contact = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    const id = contact.conversation.id;
    await messaging(t.db).decide({ userId: s.freelanceUser }, id, "accepted", new Date());
    for (let i = 0; i < 10; i += 1) await messaging(t.db).post({ userId: s.recruiter }, id, `Relance ${i}`);
    expect((await pending(s.freelanceUser)).filter((n) => n.kind === "message_received")).toHaveLength(1);

    await drain();
    await messaging(t.db).post({ userId: s.recruiter }, id, "Encore un");
    expect((await pending(s.freelanceUser)).map((n) => n.kind)).toEqual(["message_received"]);
    // L'auteur n'est jamais prévenu de son propre message ; tous les membres de l'entreprise le sont d'une réponse.
    await messaging(t.db).post({ userId: s.freelanceUser }, id, "Réponse");
    expect((await pending(s.recruiter)).map((n) => n.kind)).toEqual(["message_received"]);
    expect((await pending(s.colleague)).map((n) => n.kind)).toEqual(["message_received"]);
    expect((await pending(s.freelanceUser)).filter((n) => n.kind === "message_received")).toHaveLength(1);
  });

  it("prévient l'entreprise d'une candidature, puis le freelance de la décision, jamais de son propre retrait", async () => {
    const s = await setup();
    const mission = (await missions(t.db).create({ userId: s.recruiter }, s.org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: s.recruiter }, mission, new Date());
    const applied = await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Bonjour", new Date());
    if (applied.kind !== "applied") throw new Error(applied.kind);
    expect((await pending(s.recruiter)).map((n) => n.kind)).toEqual(["application_received"]);
    expect((await pending(s.colleague)).map((n) => n.kind)).toEqual(["application_received"]);

    await applications(t.db).decide({ userId: s.recruiter }, applied.applicationId, "shortlisted");
    expect((await pending(s.freelanceUser)).map((n) => n.payload)).toEqual([{ applicationId: applied.applicationId, status: "shortlisted" }]);
    await drain();
    await applications(t.db).withdraw({ userId: s.freelanceUser }, applied.applicationId);
    expect(await pending(s.freelanceUser)).toEqual([]);
  });

  it("respecte une préférence coupée", async () => {
    const s = await setup();
    await notifications(t.db).setPreference({ userId: s.freelanceUser }, "contact_received", false);
    expect((await notifications(t.db).preferences({ userId: s.freelanceUser })).contact_received).toBe(false);
    await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour");
    expect(await pending(s.freelanceUser)).toEqual([]);
  });
});

describe("envoi : un bail par lot, des réessais espacés, un abandon", () => {
  it("ne donne jamais la même notification à deux processus, la rend à l'expiration du bail, et abandonne après le dernier échec", async () => {
    await drain();
    const s = await setup();
    await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour");
    const now = new Date();

    const first = await notifications(t.db).claim(10, now);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: "contact_received", attempts: 0, to: { lang: "fr" } });
    expect(first[0]?.to.email).toContain("@test.fr");
    expect(await notifications(t.db).claim(10, now)).toEqual([]);
    const afterLease = new Date(now.getTime() + 6 * 60_000);
    expect(await notifications(t.db).claim(10, afterLease)).toHaveLength(1);

    const id = first[0]?.id ?? "";
    let clock = afterLease;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await notifications(t.db).markFailed(id, attempt, "ProviderRejected", clock);
      clock = new Date(clock.getTime() + 3 * 60 * 60_000);
    }
    expect(await notifications(t.db).claim(10, clock)).toEqual([]);
    const row = await t.db.notification.findUniqueOrThrow({ where: { id }, select: { attempts: true, lastError: true, sentAt: true } });
    expect(row).toEqual({ attempts: MAX_ATTEMPTS, lastError: "ProviderRejected", sentAt: null });
  });

  it("n'envoie plus ce qui est marqué envoyé", async () => {
    await drain();
    const s = await setup();
    await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour");
    const [claimed] = await notifications(t.db).claim(10, new Date());
    await notifications(t.db).markSent(claimed?.id ?? "", new Date());
    expect(await notifications(t.db).claim(10, new Date(Date.now() + 60 * 60_000))).toEqual([]);
  });
});

describe("alertes de missions", () => {
  it("signale seulement les nouvelles missions qui correspondent, une seule fois", async () => {
    await drain();
    const s = await setup();
    const created = new Date(Date.now() - 60_000);
    const alert = await missionAlerts(t.db).create({ userId: s.freelanceUser }, { skills: ["Kotlin"], workModes: ["remote"] }, created);
    if (alert.kind !== "created") throw new Error(alert.kind);

    const publish = async (skills: string[]) => {
      const id = (await missions(t.db).create({ userId: s.recruiter }, s.org, { ...MISSION, skills }))?.id ?? "";
      await missions(t.db).publish({ userId: s.recruiter }, id, new Date());
      return id;
    };
    const kotlin = await publish(["Kotlin"]);
    await publish(["Python"]);

    await missionAlerts(t.db).scan(new Date());
    const matches = (await pending(s.freelanceUser)).filter((n) => n.kind === "mission_match");
    expect(matches.map((n) => n.payload)).toEqual([{ alertId: alert.alert.id, missionIds: [kotlin] }]);

    await missionAlerts(t.db).scan(new Date());
    expect((await pending(s.freelanceUser)).filter((n) => n.kind === "mission_match")).toHaveLength(1);
  });

  it("plafonne le nombre d'alertes et ne laisse supprimer que les siennes", async () => {
    const me = await createUser(t.db);
    const other = await createUser(t.db);
    for (let i = 0; i < MAX_ALERTS_PER_USER; i += 1) await missionAlerts(t.db).create({ userId: me }, { skills: [`s${i}`] }, new Date());
    expect(await missionAlerts(t.db).create({ userId: me }, {}, new Date())).toEqual({ kind: "limit" });
    const [first] = await missionAlerts(t.db).list({ userId: me });
    expect(await missionAlerts(t.db).remove({ userId: other }, first?.id ?? "")).toBe(false);
    expect(await missionAlerts(t.db).remove({ userId: me }, first?.id ?? "")).toBe(true);
  });
});
