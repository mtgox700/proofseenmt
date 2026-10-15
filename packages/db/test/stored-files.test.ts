import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { draftFromCandidate, draftItemKey } from "../src/cv-draft";
import { importDrafts } from "../src/import-drafts";
import { profileSections } from "../src/profile-sections";
import { FILE_QUOTA, storedFiles, type NewStoredFile } from "../src/stored-files";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Fichiers déposés : quota par compte, lecture réservée selon l'usage (photo et image de portfolio publiques sur un
 * profil nominatif seulement, CV au seul propriétaire). Brouillon d'import d'un CV : rien n'entre au
 * profil sans acceptation, élément par élément.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const file = (kind: NewStoredFile["kind"], size = 1000): NewStoredFile => ({
  id: randomUUID(),
  kind,
  contentType: kind === "cv" ? "application/pdf" : "image/webp",
  size,
  sha256: "b".repeat(64),
  ...(kind === "cv" ? {} : { width: 400, height: 400 }),
});

const freelancer = async (visibility: "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId, visibility);
  return { userId, profileId, actor: { userId } };
};

describe("fichiers déposés : enregistrement", () => {
  it("refuse un type qui ne correspond pas à l'usage, une taille hors bornes, une empreinte fausse", async () => {
    const { actor } = await freelancer();
    expect(await storedFiles(t.db).record(actor, { ...file("cv"), contentType: "image/png" })).toBe("invalid");
    expect(await storedFiles(t.db).record(actor, { ...file("photo"), contentType: "application/pdf" })).toBe("invalid");
    expect(await storedFiles(t.db).record(actor, file("photo", 3 * 1024 * 1024))).toBe("invalid");
    expect(await storedFiles(t.db).record(actor, { ...file("photo"), sha256: "x" })).toBe("invalid");
    expect(await storedFiles(t.db).record(actor, { ...file("photo"), contentType: "image/svg+xml" as "image/png" })).toBe("invalid");
    expect(await storedFiles(t.db).record(actor, file("cv", 4 * 1024 * 1024))).toBe("recorded");
  });

  it("tient le quota de fichiers et d'octets du compte", async () => {
    const { actor } = await freelancer();
    for (let i = 0; i < FILE_QUOTA.maxFiles; i += 1) expect(await storedFiles(t.db).record(actor, file("portfolio_image", 10))).toBe("recorded");
    expect(await storedFiles(t.db).record(actor, file("portfolio_image", 10))).toBe("quota");

    const heavy = await freelancer();
    for (let i = 0; i < 8; i += 1) expect(await storedFiles(t.db).record(heavy.actor, file("cv", 5 * 1024 * 1024))).toBe("recorded");
    expect(await storedFiles(t.db).record(heavy.actor, file("cv", 1024 * 1024))).toBe("quota");
  });
});

describe("fichiers déposés : qui lit quoi", () => {
  it("une photo n'est publique que sur un profil nominatif ; un CV n'est lu que par son propriétaire", async () => {
    const { actor, profileId } = await freelancer();
    const stranger = { userId: await createUser(t.db) };
    const photo = file("photo");
    const cv = file("cv");
    await storedFiles(t.db).record(actor, photo);
    await storedFiles(t.db).record(actor, cv);
    await profileSections(t.db).setPhoto(actor, photo.id);

    expect(await storedFiles(t.db).readable(photo.id, null)).toBeNull();
    expect((await storedFiles(t.db).readable(photo.id, actor))?.audience).toBe("owner");
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "named" } });
    expect((await storedFiles(t.db).readable(photo.id, null))?.audience).toBe("public");
    expect((await storedFiles(t.db).readable(photo.id, stranger))?.audience).toBe("public");

    expect(await storedFiles(t.db).readable(cv.id, null)).toBeNull();
    expect(await storedFiles(t.db).readable(cv.id, stranger)).toBeNull();
    expect((await storedFiles(t.db).readable(cv.id, actor))?.audience).toBe("owner");
    expect(await storedFiles(t.db).readable("../../etc/passwd", actor)).toBeNull();
    expect(await storedFiles(t.db).readable(randomUUID(), actor)).toBeNull();
  });

  it("l'image d'une réalisation n'est publique que sur un profil nominatif, et suit son retrait", async () => {
    const { actor, profileId } = await freelancer();
    const image = file("portfolio_image");
    await storedFiles(t.db).record(actor, image);
    expect(await storedFiles(t.db).readable(image.id, null)).toBeNull();
    const added = await profileSections(t.db).addPortfolioItem(actor, { title: "Démo", url: "https://demo.example.com" }, image.id);
    if (added.kind !== "added") throw new Error("non ajoutée");
    // Profil pseudonyme : une capture d'écran peut porter un nom, un logo, un visage. Seul le propriétaire la lit.
    expect(await storedFiles(t.db).readable(image.id, null)).toBeNull();
    expect((await storedFiles(t.db).readable(image.id, actor))?.audience).toBe("owner");
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "named" } });
    expect((await storedFiles(t.db).readable(image.id, null))?.audience).toBe("public");
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "private", slug: null } });
    expect(await storedFiles(t.db).readable(image.id, null)).toBeNull();
    // Retirer la réalisation supprime son image et rend l'identifiant à effacer du disque.
    expect(await profileSections(t.db).remove(actor, "portfolio", added.id)).toEqual({ removed: true, fileIds: [image.id] });
    expect(await t.db.storedFile.count({ where: { id: image.id } })).toBe(0);
  });

  it("on ne pose comme photo ou image que son propre fichier, de cet usage", async () => {
    const owner = await freelancer();
    const thief = await freelancer();
    const photo = file("photo");
    const cv = file("cv");
    await storedFiles(t.db).record(owner.actor, photo);
    await storedFiles(t.db).record(thief.actor, cv);
    expect(await profileSections(t.db).setPhoto(thief.actor, photo.id)).toEqual({ kind: "absent" });
    expect(await profileSections(t.db).setPhoto(thief.actor, cv.id)).toEqual({ kind: "absent" });
    expect(await profileSections(t.db).addPortfolioItem(thief.actor, { title: "Vol", url: "https://x.example.com" }, photo.id)).toEqual({ kind: "absent" });
  });

  it("remplacer la photo supprime l'ancienne et rend son identifiant", async () => {
    const { actor } = await freelancer();
    const first = file("photo");
    const second = file("photo");
    await storedFiles(t.db).record(actor, first);
    await storedFiles(t.db).record(actor, second);
    expect(await profileSections(t.db).setPhoto(actor, first.id)).toEqual({ kind: "set", previousFileId: null });
    expect(await profileSections(t.db).setPhoto(actor, second.id)).toEqual({ kind: "set", previousFileId: first.id });
    expect(await t.db.storedFile.count({ where: { id: first.id } })).toBe(0);
    expect(await profileSections(t.db).removePhoto(actor)).toBe(second.id);
    expect(await storedFiles(t.db).idsOfOwner(actor.userId)).toEqual([]);
  });
});

const CANDIDATE = {
  experiences: [
    { title: "Lead data engineer", company: "Acme", start: "2023-03", end: null, description: "Plateforme Spark.", skills: ["Spark"] },
    { title: "Consultant", company: "Beta", start: "2019", end: "2022-12", description: "Contact : jean@exemple.fr", skills: [] },
    { title: "Sans date", company: "Gamma" },
    { title: "Fin avant début", start: "2022-01", end: "2021-01" },
  ],
  educations: [{ school: "INSA Lyon", degree: "Ingénieur", startYear: 2014, endYear: "2019" }, { degree: "sans école" }],
  certifications: [{ name: "AWS SAA", issuer: "AWS", year: 2024, skills: ["AWS"] }],
  languages: [
    { code: "EN", level: "C1" },
    { code: "en", level: "b2" },
    { code: "klingon", level: "c2" },
    { code: "fr", level: "expert" },
  ],
  skills: ["Spark", "spark", "dbt", "jean@exemple.fr"],
  seniority: "senior",
  score: 9,
};

describe("brouillon d'import d'un CV", () => {
  it("ne garde de la proposition du modèle que des éléments valides, sans coordonnées ni note", () => {
    const draft = draftFromCandidate(CANDIDATE);
    expect(draft.experiences.map((e) => [e.title, e.startMonth, e.endMonth, e.description])).toEqual([
      ["Lead data engineer", "2023-03", null, "Plateforme Spark."],
      ["Consultant", "2019-01", "2022-12", null],
    ]);
    expect(draft.educations).toEqual([{ school: "INSA Lyon", degree: "Ingénieur", startYear: 2014, endYear: 2019 }]);
    expect(draft.languages).toEqual([{ code: "en", level: "c1" }]);
    expect(draft.skills).toEqual(["Spark", "dbt"]);
    expect(JSON.stringify(draft)).not.toMatch(/senior|score/);
    expect(draftFromCandidate(null)).toEqual({ experiences: [], educations: [], certifications: [], languages: [], skills: [] });
    expect(draftFromCandidate("du texte")).toEqual({ experiences: [], educations: [], certifications: [], languages: [], skills: [] });
  });

  it("rien n'entre au profil sans acceptation ; accepter ajoute l'élément et le retire du brouillon, une seule fois", async () => {
    const { actor } = await freelancer();
    const drafts = importDrafts(t.db);
    expect(await drafts.save(actor, draftFromCandidate(CANDIDATE))).toBe(true);
    expect((await profileSections(t.db).mine(actor))?.experiences).toHaveLength(0);

    const draft = await drafts.get(actor);
    const key = draftItemKey(draft?.experiences[0]);
    expect(await drafts.accept(actor, "experiences", 0, key)).toBe("added");
    expect(await drafts.accept(actor, "experiences", 0, key)).toBe("stale");
    expect((await profileSections(t.db).mine(actor))?.experiences.map((e) => e.title)).toEqual(["Lead data engineer"]);

    const remaining = await drafts.get(actor);
    expect(remaining?.experiences.map((e) => e.title)).toEqual(["Consultant"]);
    expect(await drafts.dismiss(actor, "experiences", 0, draftItemKey(remaining?.experiences[0]))).toBe(true);
    expect(await drafts.accept(actor, "languages", 0, draftItemKey(remaining?.languages[0]))).toBe("added");
    expect((await profileSections(t.db).mine(actor))?.languages).toEqual([{ code: "en", level: "c1" }]);
  });

  it("ajoute les compétences proposées à celles du profil, puis vide le brouillon", async () => {
    const { actor, profileId } = await freelancer();
    const drafts = importDrafts(t.db);
    await drafts.save(actor, { experiences: [], educations: [], certifications: [], languages: [], skills: ["Spark", "dbt"] });
    expect(await drafts.acceptSkills(actor)).toBe("added");
    const skills = await t.db.freelanceSkill.findMany({ where: { profileId }, select: { skill: { select: { label: true } } } });
    expect(skills.map((s) => s.skill.label).sort()).toEqual(["Spark", "dbt"].sort());
    expect(await drafts.get(actor)).toBeNull();
    expect(await drafts.acceptSkills(actor)).toBe("stale");
  });

  it("un élément refusé par sa section revient dans le brouillon", async () => {
    const { actor, profileId } = await freelancer();
    await t.db.profileCertification.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ profileId, name: `Cert ${i}` })) });
    const drafts = importDrafts(t.db);
    await drafts.save(actor, draftFromCandidate(CANDIDATE));
    const draft = await drafts.get(actor);
    expect(await drafts.accept(actor, "certifications", 0, draftItemKey(draft?.certifications[0]))).toBe("limit");
    expect((await drafts.get(actor))?.certifications.map((c) => c.name)).toEqual(["AWS SAA"]);
    await drafts.discard(actor);
    expect(await drafts.get(actor)).toBeNull();
  });

  it("le brouillon d'un freelance est invisible pour un autre", async () => {
    const owner = await freelancer();
    const other = await freelancer();
    await importDrafts(t.db).save(owner.actor, draftFromCandidate(CANDIDATE));
    expect(await importDrafts(t.db).get(other.actor)).toBeNull();
    const key = draftItemKey((await importDrafts(t.db).get(owner.actor))?.experiences[0]);
    expect(await importDrafts(t.db).accept(other.actor, "experiences", 0, key)).toBe("stale");
  });
});
