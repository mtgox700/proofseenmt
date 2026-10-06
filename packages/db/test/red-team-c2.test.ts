import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applications } from "../src/applications";
import { containsContact } from "../src/contact-detection";
import { MAX_PENDING_PER_PROFILE, messaging } from "../src/messaging";
import { missions, type MissionInput } from "../src/missions";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Chaque attaque réussie par la red team du sprint C2 (2026-10-06), rejouée. Un test par scénario : s'il repasse un
 * jour, la faille est revenue.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const MISSION: MissionInput = { title: "Data engineer", description: "Pipeline Spark.", workMode: "remote", skills: ["Spark"] };

const setup = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  return { recruiter, org, freelanceUser, profile };
};

const openMission = async (recruiter: string, org: string): Promise<string> => {
  const id = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
  await missions(t.db).publish({ userId: recruiter }, id, new Date());
  return id;
};

describe("consentement : aucun chemin vers un devis sans l'accord du freelance", () => {
  it("refuse un devis dans un fil en attente, décliné, ou créé déjà accepté", async () => {
    const s = await setup();
    const contact = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, une mission data ?");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    const quote = (status: "sent" | "accepted") =>
      t.db.quote.create({ data: { conversationId: contact.conversation.id, dailyRateCents: 60_000, days: 5, totalCents: 300_000, currency: "EUR", status } });

    await expect(quote("sent")).rejects.toThrow(/pas acceptée/);
    await messaging(t.db).decide({ userId: s.freelanceUser }, contact.conversation.id, "accepted", new Date());
    await expect(quote("accepted")).rejects.toThrow(/brouillon ou envoyé/);
    await expect(quote("sent")).resolves.toBeDefined();
  });

  it("refuse qu'une entreprise crée un fil direct déjà accepté", async () => {
    const s = await setup();
    await expect(
      t.db.conversation.create({ data: { organisationId: s.org, profileId: s.profile, direct: true, status: "accepted", decidedAt: new Date() } }),
    ).rejects.toThrow(/naît en attente/);
  });
});

describe("contournement de la commission", () => {
  it("refuse un premier message qui contient des coordonnées", async () => {
    const s = await setup();
    expect(await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Appelez-moi au 0612-34-56-78")).toEqual({ kind: "contact_details" });
    expect(await t.db.conversation.count({ where: { profileId: s.profile } })).toBe(0);
  });

  it("refuse des coordonnées dans une mission publique", async () => {
    const s = await setup();
    await expect(missions(t.db).create({ userId: s.recruiter }, s.org, { ...MISSION, description: "Postulez sur jobs@acme.fr" })).rejects.toThrow(/coordonnées/);
  });

  it.each([
    "0612-34-56-78",
    "06/12/34/56/78",
    "06, 12, 34, 56, 78",
    "john at proton dot me",
    "jean (a) proton.me",
    "j o h n @ p r o t o n . m e",
    "mon site jean.ch",
    "insta : jean.dev",
    "écris-moi sur l1nk3d1n",
    "tg: @jean",
  ])("repère « %s »", (text) => {
    expect(containsContact(text)).toBe(true);
  });

  it.each(["réunion le 2026-10-05", "démarrage le 12/11/2026", "un signal fort côté produit", "Node.js et Vue.js"])("laisse passer « %s »", (text) => {
    expect(containsContact(text)).toBe(false);
  });
});

describe("harcèlement par les candidatures", () => {
  it("ferme le fil quand le freelance retire sa candidature, et quand l'entreprise la décline", async () => {
    const s = await setup();
    const mission = await openMission(s.recruiter, s.org);
    const withdrawn = await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Bonjour", new Date());
    if (withdrawn.kind !== "applied") throw new Error(withdrawn.kind);
    await applications(t.db).withdraw({ userId: s.freelanceUser }, withdrawn.applicationId);
    expect(await messaging(t.db).post({ userId: s.recruiter }, withdrawn.conversationId, "Pourquoi ?")).toEqual({ kind: "closed" });

    const other = await createUser(t.db);
    await createProfile(t.db, other);
    const declined = await applications(t.db).apply({ userId: other }, mission, "Bonjour", new Date());
    if (declined.kind !== "applied") throw new Error(declined.kind);
    await applications(t.db).decide({ userId: s.recruiter }, declined.applicationId, "declined");
    expect(await messaging(t.db).post({ userId: other }, declined.conversationId, "Vraiment ?")).toEqual({ kind: "closed" });
  });

  it("laisse l'une ou l'autre partie fermer un fil accepté, définitivement", async () => {
    const s = await setup();
    const mission = await openMission(s.recruiter, s.org);
    const applied = await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Bonjour", new Date());
    if (applied.kind !== "applied") throw new Error(applied.kind);
    expect(await messaging(t.db).close({ userId: await createUser(t.db) }, applied.conversationId)).toBe(false);
    expect(await messaging(t.db).close({ userId: s.recruiter }, applied.conversationId)).toBe(true);
    expect(await messaging(t.db).post({ userId: s.freelanceUser }, applied.conversationId, "Encore moi")).toEqual({ kind: "closed" });
    await expect(t.db.conversation.update({ where: { id: applied.conversationId }, data: { status: "accepted" } })).rejects.toThrow(/définitive/);
  });

  it("plafonne les demandes en attente chez un même freelance", async () => {
    const freelanceUser = await createUser(t.db);
    const profile = await createProfile(t.db, freelanceUser);
    for (let i = 0; i < MAX_PENDING_PER_PROFILE; i += 1) {
      const recruiter = await createUser(t.db);
      const result = await messaging(t.db).contact({ userId: recruiter }, await createOrganisation(t.db, recruiter), profile, "Bonjour");
      expect(result.kind).toBe("opened");
    }
    const late = await createUser(t.db);
    expect(await messaging(t.db).contact({ userId: late }, await createOrganisation(t.db, late), profile, "Bonjour")).toEqual({ kind: "limit" });
  });
});

describe("exposition et auto-transaction", () => {
  it("refuse la candidature d'un profil privé", async () => {
    const s = await setup();
    const mission = await openMission(s.recruiter, s.org);
    const hidden = await createUser(t.db);
    await createProfile(t.db, hidden, "private");
    expect(await applications(t.db).apply({ userId: hidden }, mission, "Bonjour", new Date())).toEqual({ kind: "profile_private" });
  });

  it("refuse qu'un membre postule aux missions de sa propre entreprise ou contacte son propre profil", async () => {
    const insider = await createUser(t.db);
    const org = await createOrganisation(t.db, insider);
    const ownProfile = await createProfile(t.db, insider);
    const mission = await openMission(insider, org);
    expect(await applications(t.db).apply({ userId: insider }, mission, "Je m'embauche", new Date())).toEqual({ kind: "absent" });
    expect(await messaging(t.db).contact({ userId: insider }, org, ownProfile, "Bonjour moi")).toEqual({ kind: "absent" });
    await expect(t.db.application.create({ data: { jobPostId: mission, profileId: ownProfile, coverNote: "x" } })).rejects.toThrow(/membre de cette entreprise/);
  });
});

describe("appât et changement", () => {
  it("verrouille une mission dès la première candidature", async () => {
    const s = await setup();
    const mission = await openMission(s.recruiter, s.org);
    await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Bonjour", new Date());
    expect(await missions(t.db).update({ userId: s.recruiter }, mission, { ...MISSION, dailyRateMaxCents: 10_000 })).toEqual({ kind: "locked" });
  });
});

describe("recherche", () => {
  it("ne traite pas « % » ni « _ » comme des jokers dans le filtre ville", async () => {
    const s = await setup();
    const id = (await missions(t.db).create({ userId: s.recruiter }, s.org, { ...MISSION, workMode: "onsite", city: "Paris" }))?.id ?? "";
    await missions(t.db).publish({ userId: s.recruiter }, id, new Date());
    expect((await missions(t.db).search({ city: "paris" })).items.map((m) => m.id)).toContain(id);
    expect((await missions(t.db).search({ city: "%" })).items).toEqual([]);
    expect((await missions(t.db).search({ city: "p_ris" })).items).toEqual([]);
  });
});
