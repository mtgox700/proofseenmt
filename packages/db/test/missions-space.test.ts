import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applicationDetails } from "../src/application-detail";
import { applications } from "../src/applications";
import { companyFollows } from "../src/company-follows";
import { companyPages, companySlug } from "../src/company-pages";
import { gdpr } from "../src/gdpr";
import { MAX_INVITATIONS_RECEIVED_PER_WEEK, missionInvitations } from "../src/mission-invitations";
import { companyResponse, missions, type MissionInput } from "../src/missions";
import { MAX_SAVED_MISSIONS, savedMissions } from "../src/saved-missions";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const MISSION: MissionInput = {
  title: "Architecte cloud",
  description: "Migration vers un cloud souverain.",
  skills: ["Terraform"],
  durationMonths: 6,
  dailyRateMinCents: 60_000,
  dailyRateMaxCents: 75_000,
  city: "Lyon",
  workMode: "hybrid",
};

const NOW = new Date("2026-10-15T10:00:00Z");

const company = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  return { recruiter, org };
};

const freelance = async (visibility: "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId, visibility);
  const { reference } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { reference: true } });
  return { userId, profileId, reference };
};

const openMission = async (input: Partial<MissionInput> = {}) => {
  const { recruiter, org } = await company();
  const draft = await missions(t.db).create({ userId: recruiter }, org, { ...MISSION, ...input });
  if (draft === null) throw new Error("mission non créée");
  await missions(t.db).publish({ userId: recruiter }, draft.id, NOW);
  return { id: draft.id, recruiter, org };
};

const notificationsOf = (userId: string, kind: "application_read" | "mission_invitation" | "company_mission") => t.db.notification.count({ where: { userId, kind } });

describe("questions de l'entreprise : une réponse par question", () => {
  it("exige les réponses, refuse les coordonnées, et les montre à l'entreprise", async () => {
    const m = await openMission({ questions: ["Votre expérience Terraform ?", "Disponible quand ?"] });
    const dev = await freelance();
    expect(await applications(t.db).apply({ userId: dev.userId }, m.id, "Bonjour", NOW)).toEqual({ kind: "answers_required" });
    expect(await applications(t.db).apply({ userId: dev.userId }, m.id, "Bonjour", NOW, ["Cinq ans"])).toEqual({ kind: "answers_required" });
    expect(await applications(t.db).apply({ userId: dev.userId }, m.id, "Bonjour", NOW, ["Cinq ans", ""])).toEqual({ kind: "answers_required" });
    expect(await applications(t.db).apply({ userId: dev.userId }, m.id, "Bonjour", NOW, ["Cinq ans", "Écrivez-moi à moi@exemple.fr"])).toEqual({ kind: "contact_details" });
    const applied = await applications(t.db).apply({ userId: dev.userId }, m.id, "Bonjour", NOW, ["Cinq ans", "Lundi"]);
    expect(applied.kind).toBe("applied");
    if (applied.kind !== "applied") return;
    const detail = await applicationDetails(t.db).open({ userId: m.recruiter }, applied.applicationId, NOW);
    expect(detail?.answers).toEqual([
      { question: "Votre expérience Terraform ?", answer: "Cinq ans" },
      { question: "Disponible quand ?", answer: "Lundi" },
    ]);
    // Une réponse ne se réécrit pas, même hors du code.
    await expect(t.db.application.update({ where: { id: applied.applicationId }, data: { answers: ["Autre", "Autre"] } })).rejects.toThrow();
  });

  it("refuse plus de trois questions, ou une question qui porte des coordonnées", async () => {
    const { recruiter, org } = await company();
    await expect(missions(t.db).create({ userId: recruiter }, org, { ...MISSION, questions: ["a", "b", "c", "d"] })).rejects.toThrow();
    await expect(missions(t.db).create({ userId: recruiter }, org, { ...MISSION, questions: ["Appelez le 06 12 34 56 78"] })).rejects.toThrow();
  });
});

describe("candidature lue : une date, une fois, jamais le nom du lecteur", () => {
  it("date la première ouverture par un membre, prévient le freelance une fois, et ne bouge plus", async () => {
    const m = await openMission();
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: m.org, userId: colleague, role: "member" } });
    const dev = await freelance();
    const applied = await applications(t.db).apply({ userId: dev.userId }, m.id, "Bonjour", NOW);
    if (applied.kind !== "applied") throw new Error("candidature refusée");
    const outsider = await createUser(t.db);

    expect(await applicationDetails(t.db).open({ userId: outsider }, applied.applicationId, NOW)).toBeNull();
    expect(await applicationDetails(t.db).open({ userId: dev.userId }, applied.applicationId, NOW)).toBeNull();
    expect((await applications(t.db).listMine({ userId: dev.userId }))[0]?.readAt).toBeNull();

    const first = new Date("2026-10-16T08:00:00Z");
    const before = await t.db.application.findUniqueOrThrow({ where: { id: applied.applicationId }, select: { updatedAt: true } });
    expect((await applicationDetails(t.db).open({ userId: m.recruiter }, applied.applicationId, first))?.readAt).toEqual(first);
    expect((await applicationDetails(t.db).open({ userId: colleague }, applied.applicationId, new Date("2026-10-17T08:00:00Z")))?.readAt).toEqual(first);

    const row = await t.db.application.findUniqueOrThrow({ where: { id: applied.applicationId }, select: { readAt: true, readByUserId: true, updatedAt: true } });
    expect(row).toMatchObject({ readAt: first, readByUserId: m.recruiter });
    // Lire n'est pas décider : le délai de réponse publié de l'entreprise ne bouge pas.
    expect(row.updatedAt).toEqual(before.updatedAt);
    expect(await notificationsOf(dev.userId, "application_read")).toBe(1);

    const mine = await applications(t.db).listMine({ userId: dev.userId });
    expect(mine[0]?.readAt).toEqual(first);
    expect(Object.keys(mine[0] ?? {})).not.toContain("readByUserId");
    expect((await applications(t.db).listForMission({ userId: m.recruiter }, m.id))?.[0]?.readAt).toEqual(first);

    // Le déclencheur garde la première date, même si le code l'oubliait.
    await expect(t.db.application.update({ where: { id: applied.applicationId }, data: { readAt: new Date() } })).rejects.toThrow();
    await expect(t.db.application.update({ where: { id: applied.applicationId }, data: { readByUserId: colleague } })).rejects.toThrow();
  });

  it("ne date pas une candidature retirée, et n'entre pas dans le délai de réponse", async () => {
    const m = await openMission();
    const dev = await freelance();
    const applied = await applications(t.db).apply({ userId: dev.userId }, m.id, "Bonjour", NOW);
    if (applied.kind !== "applied") throw new Error("candidature refusée");
    await applications(t.db).withdraw({ userId: dev.userId }, applied.applicationId);
    expect(await applicationDetails(t.db).open({ userId: m.recruiter }, applied.applicationId, NOW)).toBeNull();
    expect(await companyResponse(t.db, m.org, NOW)).toBeNull();
  });
});

describe("invitations à postuler : plafonnées, et rien n'est révélé", () => {
  it("invite un freelance publié par sa référence, une fois, et le prévient", async () => {
    const m = await openMission();
    const dev = await freelance();
    const hidden = await freelance("private");
    const outsider = await createUser(t.db);

    expect(await missionInvitations(t.db).invite({ userId: outsider }, m.id, dev.reference, NOW)).toEqual({ kind: "absent" });
    expect(await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, hidden.reference, NOW)).toEqual({ kind: "unknown_profile" });
    expect(await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, "pas-une-ref", NOW)).toEqual({ kind: "unknown_profile" });

    const sent = await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, dev.reference.toLowerCase(), NOW);
    expect(sent.kind).toBe("invited");
    expect(await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, dev.reference, NOW)).toEqual({ kind: "already_invited" });
    expect(await notificationsOf(dev.userId, "mission_invitation")).toBe(1);

    expect(await missionInvitations(t.db).countPending({ userId: dev.userId })).toBe(1);
    expect(await missionInvitations(t.db).listMine({ userId: dev.userId })).toMatchObject([{ applied: false, mission: { id: m.id } }]);
    expect(await missionInvitations(t.db).listForMission({ userId: m.recruiter }, m.id)).toMatchObject([{ reference: dev.reference, applied: false }]);
    expect(await missionInvitations(t.db).listForMission({ userId: outsider }, m.id)).toBeNull();

    // Postuler répond à l'invitation ; l'écarter la retire de la liste, sans que l'entreprise le sache.
    await applications(t.db).apply({ userId: dev.userId }, m.id, "Merci de l'invitation", NOW);
    expect(await missionInvitations(t.db).countPending({ userId: dev.userId })).toBe(0);
    const invitationId = sent.kind === "invited" ? sent.invitationId : "";
    expect(await missionInvitations(t.db).dismiss({ userId: outsider }, invitationId, NOW)).toBe(false);
    expect(await missionInvitations(t.db).dismiss({ userId: dev.userId }, invitationId, NOW)).toBe(true);
    expect(await missionInvitations(t.db).listMine({ userId: dev.userId })).toEqual([]);
    expect(await missionInvitations(t.db).listForMission({ userId: m.recruiter }, m.id)).toMatchObject([{ reference: dev.reference, applied: true }]);

    const other = await freelance();
    await applications(t.db).apply({ userId: other.userId }, m.id, "Déjà là", NOW);
    expect(await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, other.reference, NOW)).toEqual({ kind: "already_applied" });
  });

  it(`plafonne les invitations reçues par un freelance à ${MAX_INVITATIONS_RECEIVED_PER_WEEK} par semaine`, async () => {
    const dev = await freelance();
    for (let i = 0; i < MAX_INVITATIONS_RECEIVED_PER_WEEK; i += 1) {
      const m = await openMission({ title: `Mission ${i}` });
      expect((await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, dev.reference, NOW)).kind).toBe("invited");
    }
    const last = await openMission();
    expect(await missionInvitations(t.db).invite({ userId: last.recruiter }, last.id, dev.reference, NOW)).toEqual({ kind: "limit" });
    // Une semaine plus tard, la fenêtre est passée.
    expect((await missionInvitations(t.db).invite({ userId: last.recruiter }, last.id, dev.reference, new Date(NOW.getTime() + 8 * 86_400_000))).kind).toBe("invited");
  });

  it("refuse d'inviter un membre de sa propre entreprise ou sur une mission fermée", async () => {
    const m = await openMission();
    const insider = await freelance();
    await t.db.membership.create({ data: { organisationId: m.org, userId: insider.userId, role: "member" } });
    expect(await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, insider.reference, NOW)).toEqual({ kind: "unknown_profile" });
    await missions(t.db).close({ userId: m.recruiter }, m.id, NOW);
    expect(await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, (await freelance()).reference, NOW)).toEqual({ kind: "absent" });
  });
});

describe("missions enregistrées : une liste privée", () => {
  it("enregistre une mission ouverte une fois, la garde clôturée, la retire", async () => {
    const m = await openMission();
    const dev = await freelance();
    const other = await freelance();
    expect(await savedMissions(t.db).save({ userId: dev.userId }, m.id)).toBe("saved");
    expect(await savedMissions(t.db).save({ userId: dev.userId }, m.id)).toBe("already");
    expect(await savedMissions(t.db).isSaved({ userId: dev.userId }, m.id)).toBe(true);
    expect(await savedMissions(t.db).isSaved({ userId: other.userId }, m.id)).toBe(false);
    expect(await savedMissions(t.db).list({ userId: other.userId })).toEqual([]);
    expect(await savedMissions(t.db).countOpen({ userId: dev.userId })).toBe(1);

    await missions(t.db).close({ userId: m.recruiter }, m.id, NOW);
    expect(await savedMissions(t.db).list({ userId: dev.userId })).toMatchObject([{ missionId: m.id, status: "closed" }]);
    expect(await savedMissions(t.db).countOpen({ userId: dev.userId })).toBe(0);
    expect(await savedMissions(t.db).save({ userId: other.userId }, m.id)).toBe("absent");
    expect(await savedMissions(t.db).remove({ userId: other.userId }, m.id)).toBe(false);
    expect(await savedMissions(t.db).remove({ userId: dev.userId }, m.id)).toBe(true);
  });

  it(`plafonne à ${MAX_SAVED_MISSIONS} missions`, async () => {
    const dev = await freelance();
    const m = await openMission();
    // Le plafond se remplit directement en base : deux cents brouillons d'une entreprise, enregistrés d'un coup.
    const { org } = await company();
    await t.db.jobPost.createMany({ data: Array.from({ length: MAX_SAVED_MISSIONS }, (_, i) => ({ organisationId: org, title: `Remplissage ${i}`, description: "x", currency: "EUR", workMode: "remote" as const })) });
    const filler = await t.db.jobPost.findMany({ where: { organisationId: org }, select: { id: true } });
    await t.db.savedMission.createMany({ data: filler.map((row) => ({ userId: dev.userId, jobPostId: row.id })) });
    expect(await savedMissions(t.db).save({ userId: dev.userId }, m.id)).toBe("limit");
  });
});

describe("pages d'entreprise : seulement sur son choix", () => {
  it("n'existe pas sans activation, s'active par un administrateur, se retire", async () => {
    const m = await openMission();
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: m.org, userId: member, role: "member" } });

    expect(await companyPages(t.db).listForSitemap()).toEqual([]);
    expect(await companyPages(t.db).page("acme")).toBeNull();
    expect((await companyPages(t.db).settings({ userId: member }, m.org))?.canEdit).toBe(false);
    expect(await companyPages(t.db).publish({ userId: member }, m.org, { publicName: "Acme" }, NOW)).toEqual({ kind: "forbidden" });

    const saved = await companyPages(t.db).publish({ userId: m.recruiter }, m.org, { publicName: "Acmé Studio", description: "Studio produit.", website: "acme.example", city: "Lyon" }, NOW);
    expect(saved).toEqual({ kind: "saved", slug: "acme-studio" });
    const page = await companyPages(t.db).page("acme-studio", NOW);
    expect(page).toMatchObject({ name: "Acmé Studio", website: "https://acme.example", city: "Lyon", registryActiveCheckedAt: null, missions: [{ id: m.id }] });
    expect(await companyPages(t.db).listForSitemap()).toMatchObject([{ slug: "acme-studio" }]);
    expect((await missions(t.db).findPublic(m.id))?.organisationSlug).toBe("acme-studio");

    // Une autre entreprise du même nom obtient une autre adresse.
    const other = await company();
    expect(await companyPages(t.db).publish({ userId: other.recruiter }, other.org, { publicName: "Acmé Studio" }, NOW)).toEqual({ kind: "saved", slug: "acme-studio-2" });

    expect(await companyPages(t.db).unpublish({ userId: member }, m.org)).toBe(false);
    expect(await companyPages(t.db).unpublish({ userId: m.recruiter }, m.org)).toBe(true);
    expect(await companyPages(t.db).page("acme-studio")).toBeNull();
    expect((await missions(t.db).findPublic(m.id))?.organisationSlug).toBeNull();
    // Republier garde l'adresse.
    expect(await companyPages(t.db).publish({ userId: m.recruiter }, m.org, { publicName: "Acme Nouveau Nom" }, NOW)).toEqual({ kind: "saved", slug: "acme-studio" });
  });

  it("refuse les coordonnées et un site qui n'est pas en https", async () => {
    const { recruiter, org } = await company();
    await expect(companyPages(t.db).publish({ userId: recruiter }, org, { publicName: "Acme", description: "Appelez le 06 12 34 56 78" }, NOW)).rejects.toThrow();
    await expect(companyPages(t.db).publish({ userId: recruiter }, org, { publicName: "Acme", website: "http://acme.example" }, NOW)).rejects.toThrow();
    await expect(companyPages(t.db).publish({ userId: recruiter }, org, { publicName: "Acme", website: "javascript:alert(1)" }, NOW)).rejects.toThrow();
    expect(companySlug("Société Générale & Fils")).toBe("societe-generale-fils");
    expect(companySlug("***")).toBe("entreprise");
  });
});

describe("entreprises suivies : prévenu à chaque publication", () => {
  it("suit une entreprise publique, jamais la sienne, et reçoit ses nouvelles missions", async () => {
    const { recruiter, org } = await company();
    const dev = await freelance();
    expect(await companyFollows(t.db).follow({ userId: dev.userId }, "suivie-sa")).toBe("absent");
    await companyPages(t.db).publish({ userId: recruiter }, org, { publicName: "Suivie SA" }, NOW);
    expect(await companyFollows(t.db).follow({ userId: recruiter }, "suivie-sa")).toBe("absent");
    expect(await companyFollows(t.db).follow({ userId: dev.userId }, "suivie-sa")).toBe("followed");
    expect(await companyFollows(t.db).follow({ userId: dev.userId }, "suivie-sa")).toBe("already");
    expect(await companyFollows(t.db).lookup({ userId: dev.userId }, "suivie-sa")).toMatchObject({ name: "Suivie SA", following: true, member: false });

    const draft = await missions(t.db).create({ userId: recruiter }, org, MISSION);
    await missions(t.db).publish({ userId: recruiter }, draft?.id ?? "", NOW);
    expect(await notificationsOf(dev.userId, "company_mission")).toBe(1);
    expect(await notificationsOf(recruiter, "company_mission")).toBe(0);
    expect(await companyFollows(t.db).listMine({ userId: dev.userId })).toMatchObject([{ name: "Suivie SA", slug: "suivie-sa", openMissions: 1 }]);

    // Page retirée : plus de notification, l'entreprise reste dans la liste sans lien.
    await companyPages(t.db).unpublish({ userId: recruiter }, org);
    const second = await missions(t.db).create({ userId: recruiter }, org, MISSION);
    await missions(t.db).publish({ userId: recruiter }, second?.id ?? "", NOW);
    expect(await notificationsOf(dev.userId, "company_mission")).toBe(1);
    expect((await companyFollows(t.db).listMine({ userId: dev.userId }))[0]?.slug).toBeNull();
    expect(await companyFollows(t.db).unfollow({ userId: dev.userId }, org)).toBe(true);
  });
});

describe("RGPD : l'espace missions dans l'export et l'effacement", () => {
  it("exporte les marque-pages, suivis et invitations, et les efface avec le compte", async () => {
    const m = await openMission();
    const dev = await freelance();
    await savedMissions(t.db).save({ userId: dev.userId }, m.id);
    await missionInvitations(t.db).invite({ userId: m.recruiter }, m.id, dev.reference, NOW);
    const exported = await gdpr(t.db).exportUser(dev.userId, NOW);
    expect(exported?.missionsSpace).toMatchObject({ savedMissions: [{ jobPostId: m.id }], invitationsReceived: [{ jobPostId: m.id }] });
    expect(await gdpr(t.db).eraseUser(dev.userId)).toBe("erased");
    expect(await t.db.savedMission.count({ where: { userId: dev.userId } })).toBe(0);
    expect(await t.db.missionInvitation.count({ where: { jobPostId: m.id } })).toBe(0);
  });
});
