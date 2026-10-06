import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applications } from "../src/applications";
import { billing } from "../src/billing";
import { NO_CONTACT } from "../src/contact-detection";
import { MAX_CONTACTS_PER_ORGANISATION_PER_DAY, messaging } from "../src/messaging";
import { missions, type MissionInput } from "../src/missions";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Chaque contournement trouvé par la red team du sprint C6 (2026-10-06), rejoué. Un test par scénario : s'il repasse un
 * jour, le contournement est revenu.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const MISSION: MissionInput = { title: "Data engineer", description: "Pipeline Spark.", workMode: "remote", skills: ["Spark"] };
const SNAPSHOT = { legalName: "Test", country: "FR" };

const setup = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  return { recruiter, org, freelanceUser, profile };
};

const rejectsContact = async (promise: Promise<unknown>): Promise<void> => {
  await expect(promise).rejects.toThrow(NO_CONTACT);
};

describe("coordonnées dans les champs publics", () => {
  it("refuse une adresse dans le résumé, le titre, la ville ou une compétence du profil", async () => {
    const s = await setup();
    const base = { headline: "Data engineer", summary: "Spark et Kafka.", city: "Lyon", workMode: "remote" as const, skills: ["Spark"] };
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, summary: "écrivez à jean@outlook.fr" }));
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, headline: "Dev 06 12 34 56 78" }));
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, city: "Lyon linktr.ee/jean" }));
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, skills: ["Spark", "whats app"] }));
    expect(await profiles(t.db).update({ userId: s.freelanceUser }, base)).not.toBeNull();
  });

  it("ne publie jamais un nom affiché qui est une adresse e-mail : la page montre la référence", async () => {
    const s = await setup();
    const row = await t.db.freelanceProfile.update({ where: { id: s.profile }, data: { visibility: "named" }, select: { slug: true } });
    await t.db.user.update({ where: { id: s.freelanceUser }, data: { displayName: "jean.dupont@gmail.com" } });
    expect(await publicProfiles(t.db).page(row.slug ?? "")).toMatchObject({ visibility: "named", displayName: null });
    await t.db.user.update({ where: { id: s.freelanceUser }, data: { displayName: "Jean Dupont" } });
    expect(await publicProfiles(t.db).page(row.slug ?? "")).toMatchObject({ displayName: "Jean Dupont" });
  });

  it("refuse des coordonnées dans le nom d'une entreprise, la ville ou les compétences d'une mission", async () => {
    const s = await setup();
    const address = { line1: "1 rue de la Paix", postalCode: "75002", city: "Paris", country: "FR" };
    await rejectsContact(billing(t.db).setOrganisationIdentity({ userId: s.recruiter }, s.org, { legalName: "ACME rh@acme.fr", address }));
    await rejectsContact(missions(t.db).create({ userId: s.recruiter }, s.org, { ...MISSION, workMode: "onsite", city: "Paris 0612345678" }));
    await rejectsContact(missions(t.db).create({ userId: s.recruiter }, s.org, { ...MISSION, skills: ["Spark", "cutt.ly/x"] }));
  });
});

describe("coordonnées dans les échanges, avant tout contrat", () => {
  it("refuse une note de candidature qui contient des coordonnées, sans créer de candidature", async () => {
    const s = await setup();
    const mission = (await missions(t.db).create({ userId: s.recruiter }, s.org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: s.recruiter }, mission, new Date());
    expect(await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Dispo, appelez-moi au 06 12 34 56 78", new Date())).toEqual({ kind: "contact_details" });
    expect(await t.db.application.count({ where: { jobPostId: mission } })).toBe(0);
    expect(await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Disponible dès lundi.", new Date())).toMatchObject({ kind: "applied" });
  });

  it("refuse des coordonnées dans un fil accepté tant qu'aucun contrat n'est signé, les laisse passer après", async () => {
    const s = await setup();
    const opened = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, êtes-vous disponible ?");
    if (opened.kind !== "opened") throw new Error("fil non ouvert");
    const id = opened.conversation.id;
    await messaging(t.db).decide({ userId: s.freelanceUser }, id, "accepted", new Date());

    expect(await messaging(t.db).post({ userId: s.freelanceUser }, id, "Écrivez-moi à jean@outlook.fr")).toEqual({ kind: "contact_details" });
    expect(await messaging(t.db).post({ userId: s.recruiter }, id, "Appelez le 06 12 34 56 78")).toEqual({ kind: "contact_details" });

    await t.db.contract.create({
      data: {
        organisationId: s.org, profileId: s.profile, dailyRateCents: 50000, days: 2, totalCents: 100000, currency: "EUR",
        sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT, startsOn: new Date("2026-12-01"), status: "active",
        acceptedByFreelanceAt: new Date(), acceptedByOrgAt: new Date(),
      },
    });
    expect(await messaging(t.db).post({ userId: s.freelanceUser }, id, "Écrivez-moi à jean@outlook.fr")).toMatchObject({ kind: "sent", message: { containsContact: true } });
  });

  it("refuse une nouvelle prise de contact après un refus du freelance", async () => {
    const s = await setup();
    const opened = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, êtes-vous disponible ?");
    if (opened.kind !== "opened") throw new Error("fil non ouvert");
    await messaging(t.db).decide({ userId: s.freelanceUser }, opened.conversation.id, "declined", new Date());
    const again = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Et maintenant ?");
    expect(again).toMatchObject({ kind: "existing", conversation: { id: opened.conversation.id } });
    expect(await messaging(t.db).post({ userId: s.recruiter }, opened.conversation.id, "Vraiment ?")).toEqual({ kind: "closed" });
  });

  it(`plafonne une entreprise à ${MAX_CONTACTS_PER_ORGANISATION_PER_DAY} prises de contact par jour`, async () => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    for (let i = 0; i < MAX_CONTACTS_PER_ORGANISATION_PER_DAY; i += 1) {
      const target = await createProfile(t.db, await createUser(t.db));
      expect(await messaging(t.db).contact({ userId: recruiter }, org, target, "Bonjour, êtes-vous disponible ?")).toMatchObject({ kind: "opened" });
    }
    const oneMore = await createProfile(t.db, await createUser(t.db));
    expect(await messaging(t.db).contact({ userId: recruiter }, org, oneMore, "Bonjour, êtes-vous disponible ?")).toEqual({ kind: "limit" });
  }, 120_000);
});
