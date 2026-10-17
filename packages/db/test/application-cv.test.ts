import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applicationDetails } from "../src/application-detail";
import { applications } from "../src/applications";
import { gdpr } from "../src/gdpr";
import { missions, type MissionInput } from "../src/missions";
import { storedFiles, type NewStoredFile } from "../src/stored-files";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * CV joint à une candidature (C21) : lu par son propriétaire et par les membres de l'entreprise destinataire, tant que
 * la candidature n'est pas retirée ; jamais par une autre entreprise, un autre freelance, un compte suspendu, ni pour
 * une mission masquée. Remplacer son CV garde celui déjà envoyé ; le supprimer le retire des candidatures.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-17T10:00:00Z");

const MISSION: MissionInput = { title: "Data engineer", description: "Plateforme de données.", skills: ["Spark"], durationMonths: 3, city: "Lyon", workMode: "remote" };

const cvFile = (): NewStoredFile => ({ id: randomUUID(), kind: "cv", contentType: "application/pdf", size: 1000, sha256: "d".repeat(64) });

const openMission = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const draft = await missions(t.db).create({ userId: recruiter }, org, MISSION);
  if (draft === null) throw new Error("mission non créée");
  await missions(t.db).publish({ userId: recruiter }, draft.id, NOW);
  return { id: draft.id, recruiter, org };
};

const freelancerWithCv = async () => {
  const userId = await createUser(t.db);
  await createProfile(t.db, userId);
  const cv = cvFile();
  expect(await storedFiles(t.db).record({ userId }, cv)).toBe("recorded");
  return { userId, actor: { userId }, cvId: cv.id };
};

const applyWithCv = async () => {
  const mission = await openMission();
  const dev = await freelancerWithCv();
  const applied = await applications(t.db).apply(dev.actor, mission.id, "Bonjour", NOW, [], dev.cvId);
  if (applied.kind !== "applied") throw new Error(`candidature refusée : ${applied.kind}`);
  return { mission, dev, applicationId: applied.applicationId };
};

const audience = async (fileId: string, userId: string) => (await storedFiles(t.db).readable(fileId, { userId }))?.audience ?? null;

describe("CV joint : joindre", () => {
  it("joint un CV du candidat ; refuse le fichier d'un autre, une photo, un identifiant inconnu", async () => {
    const { dev, applicationId } = await applyWithCv();
    expect((await t.db.application.findUniqueOrThrow({ where: { id: applicationId }, select: { cvFileId: true } })).cvFileId).toBe(dev.cvId);

    const mission = await openMission();
    const thief = await freelancerWithCv();
    expect(await applications(t.db).apply(thief.actor, mission.id, "Bonjour", NOW, [], dev.cvId)).toEqual({ kind: "cv_absent" });
    const photo = { ...cvFile(), kind: "photo" as const, contentType: "image/webp" as const, width: 400, height: 400 };
    await storedFiles(t.db).record(thief.actor, photo);
    expect(await applications(t.db).apply(thief.actor, mission.id, "Bonjour", NOW, [], photo.id)).toEqual({ kind: "cv_absent" });
    expect(await applications(t.db).apply(thief.actor, mission.id, "Bonjour", NOW, [], "../../etc/passwd")).toEqual({ kind: "cv_absent" });
    expect(await t.db.application.count({ where: { jobPostId: mission.id } })).toBe(0);
    // Sans CV, la candidature passe comme avant.
    expect((await applications(t.db).apply(thief.actor, mission.id, "Bonjour", NOW)).kind).toBe("applied");
  });

  it("la base refuse un CV qui n'est pas celui du candidat, et tout remplacement du CV joint", async () => {
    const { applicationId } = await applyWithCv();
    const other = await freelancerWithCv();
    const otherProfile = await t.db.freelanceProfile.findUniqueOrThrow({ where: { userId: other.userId }, select: { id: true } });
    const second = await openMission();
    const stranger = await freelancerWithCv();
    await expect(t.db.application.create({ data: { jobPostId: second.id, profileId: otherProfile.id, coverNote: "x", cvFileId: stranger.cvId } })).rejects.toThrow();
    await expect(t.db.application.update({ where: { id: applicationId }, data: { cvFileId: other.cvId } })).rejects.toThrow();
    // Le retirer reste possible : c'est ce que fait la suppression du fichier.
    await t.db.application.update({ where: { id: applicationId }, data: { cvFileId: null } });
  });
});

describe("CV joint : qui le lit", () => {
  it("le propriétaire et les membres de l'entreprise destinataire ; personne d'autre", async () => {
    const { mission, dev } = await applyWithCv();
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: mission.org, userId: colleague } });
    const otherCompany = await openMission();
    const otherFreelancer = await freelancerWithCv();

    expect(await audience(dev.cvId, dev.userId)).toBe("owner");
    expect(await audience(dev.cvId, mission.recruiter)).toBe("recipient");
    expect(await audience(dev.cvId, colleague)).toBe("recipient");
    expect(await audience(dev.cvId, otherCompany.recruiter)).toBeNull();
    expect(await audience(dev.cvId, otherFreelancer.userId)).toBeNull();
    expect(await storedFiles(t.db).readable(dev.cvId, null)).toBeNull();
  });

  it("un CV seulement déposé au profil, jamais joint, n'est lu que par son propriétaire", async () => {
    const mission = await openMission();
    const dev = await freelancerWithCv();
    expect((await applications(t.db).apply(dev.actor, mission.id, "Bonjour", NOW)).kind).toBe("applied");
    expect(await audience(dev.cvId, mission.recruiter)).toBeNull();
  });

  it("ferme l'accès au retrait de la candidature", async () => {
    const { mission, dev, applicationId } = await applyWithCv();
    expect(await applications(t.db).withdraw(dev.actor, applicationId)).toBe(true);
    expect(await audience(dev.cvId, mission.recruiter)).toBeNull();
    expect(await audience(dev.cvId, dev.userId)).toBe("owner");
    expect(await applicationDetails(t.db).open({ userId: mission.recruiter }, applicationId, NOW)).toBeNull();
  });

  it("ferme l'accès à un membre suspendu, pour une mission masquée, une entreprise ou un candidat suspendus", async () => {
    const memberCase = await applyWithCv();
    const suspended = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: memberCase.mission.org, userId: suspended } });
    await t.db.user.update({ where: { id: suspended }, data: { suspendedAt: NOW, suspensionReason: "Abus signalé" } });
    expect(await audience(memberCase.dev.cvId, suspended)).toBeNull();
    expect(await audience(memberCase.dev.cvId, memberCase.mission.recruiter)).toBe("recipient");

    const moderated = await applyWithCv();
    await t.db.jobPost.update({ where: { id: moderated.mission.id }, data: { moderatedAt: NOW, moderationReason: "Mission trompeuse" } });
    expect(await audience(moderated.dev.cvId, moderated.mission.recruiter)).toBeNull();
    expect((await applicationDetails(t.db).open({ userId: moderated.mission.recruiter }, moderated.applicationId, NOW))?.cvFileId).toBeNull();

    const hidden = await applyWithCv();
    await t.db.organisation.update({ where: { id: hidden.mission.org }, data: { suspendedAt: NOW, suspensionReason: "Entreprise fictive" } });
    expect(await audience(hidden.dev.cvId, hidden.mission.recruiter)).toBeNull();

    const banned = await applyWithCv();
    await t.db.user.update({ where: { id: banned.dev.userId }, data: { suspendedAt: NOW, suspensionReason: "Faux profil" } });
    expect(await audience(banned.dev.cvId, banned.mission.recruiter)).toBeNull();
  });

  it("la page de la candidature donne le CV à l'entreprise destinataire seulement", async () => {
    const { mission, dev, applicationId } = await applyWithCv();
    expect((await applicationDetails(t.db).open({ userId: mission.recruiter }, applicationId, NOW))?.cvFileId).toBe(dev.cvId);
    const outsider = await openMission();
    expect(await applicationDetails(t.db).open({ userId: outsider.recruiter }, applicationId, NOW)).toBeNull();
  });
});

describe("CV joint : remplacer, supprimer, RGPD", () => {
  it("remplacer le CV du profil garde celui envoyé à l'entreprise ; un retrait le libère ensuite", async () => {
    const { mission, dev, applicationId } = await applyWithCv();
    const loose = cvFile();
    const fresh = cvFile();
    await storedFiles(t.db).record(dev.actor, loose);
    await storedFiles(t.db).record(dev.actor, fresh);
    expect(await storedFiles(t.db).pruneCvs(dev.actor, fresh.id)).toEqual([loose.id]);
    expect(await audience(dev.cvId, mission.recruiter)).toBe("recipient");
    expect((await storedFiles(t.db).latest(dev.actor, "cv"))?.id).toBe(fresh.id);

    await applications(t.db).withdraw(dev.actor, applicationId);
    // Sans clé, le plus récent reste : c'est le CV du profil.
    expect(await storedFiles(t.db).pruneCvs(dev.actor)).toEqual([dev.cvId]);
    expect(await t.db.storedFile.count({ where: { ownerId: dev.userId, kind: "cv" } })).toBe(1);
    expect((await t.db.application.findUniqueOrThrow({ where: { id: applicationId }, select: { cvFileId: true } })).cvFileId).toBeNull();
  });

  it("supprimer son CV le retire des candidatures ; personne ne le lit plus", async () => {
    const { mission, dev, applicationId } = await applyWithCv();
    expect(await storedFiles(t.db).removeKind(dev.actor, "cv")).toEqual([dev.cvId]);
    expect(await audience(dev.cvId, mission.recruiter)).toBeNull();
    expect((await applicationDetails(t.db).open({ userId: mission.recruiter }, applicationId, NOW))?.cvFileId).toBeNull();
  });

  it("l'export liste le CV joint ; l'effacement du compte emporte le fichier et la candidature", async () => {
    const { mission, dev, applicationId } = await applyWithCv();
    const exported = await gdpr(t.db).exportUser(dev.userId, NOW);
    expect(JSON.stringify(exported?.freelanceProfile)).toContain(`"cvFileId":"${dev.cvId}"`);
    expect(JSON.stringify(exported?.files)).toContain(dev.cvId);
    expect(await gdpr(t.db).eraseUser(dev.userId)).toBe("erased");
    expect(await t.db.storedFile.count({ where: { id: dev.cvId } })).toBe(0);
    expect(await t.db.application.count({ where: { id: applicationId } })).toBe(0);
    expect(await storedFiles(t.db).readable(dev.cvId, { userId: mission.recruiter })).toBeNull();
  });
});
