import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gdpr } from "../src/gdpr";
import { SECTION_LIMITS } from "../src/profile-section-schemas";
import { profileSections } from "../src/profile-sections";
import { publicProfiles } from "../src/public-profiles";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Profil enrichi : chaque section n'est écrite que par son freelance, plafonnée sous verrou, sans coordonnées ; la page
 * publique ne montre ni photo ni adresse web d'un profil pseudonyme, ni une entreprise masquée.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const freelancer = async (visibility: "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId, visibility);
  return { userId, profileId, actor: { userId } };
};

const month = (iso: string): Date => new Date(`${iso}-01T00:00:00Z`);

const EXPERIENCE = { title: "Lead data engineer", company: "Acme", startMonth: month("2023-03"), description: "Plateforme Spark.", skills: ["Spark", "spark", "dbt"] };

describe("sections du profil", () => {
  it("ajoute, lit et retire une expérience ; dédoublonne les compétences ; refuse une fin avant le début", async () => {
    const { actor } = await freelancer();
    const repo = profileSections(t.db);
    const added = await repo.addExperience(actor, EXPERIENCE);
    expect(added.kind).toBe("added");
    expect(await repo.addExperience(actor, { ...EXPERIENCE, endMonth: month("2022-01") })).toEqual({ kind: "invalid" });
    expect(await repo.addExperience(actor, { ...EXPERIENCE, startMonth: new Date("2023-03-15T00:00:00Z") })).toEqual({ kind: "invalid" });

    const mine = await repo.mine(actor);
    expect(mine?.experiences).toHaveLength(1);
    expect(mine?.experiences[0]?.skills).toEqual(["Spark", "dbt"]);
    if (added.kind !== "added") throw new Error("non ajoutée");
    expect((await repo.remove(actor, "experiences", added.id)).removed).toBe(true);
    expect((await repo.mine(actor))?.experiences).toHaveLength(0);
  });

  it("refuse les coordonnées dans tout texte publié", async () => {
    const { actor } = await freelancer();
    const repo = profileSections(t.db);
    expect(await repo.addExperience(actor, { ...EXPERIENCE, description: "Écrivez-moi : jean@exemple.fr" })).toEqual({ kind: "contact" });
    expect(await repo.addEducation(actor, { school: "INSA, appelez le 06 12 34 56 78" })).toEqual({ kind: "contact" });
    expect(await repo.addPortfolioItem(actor, { title: "Démo", url: "https://demo.example.com", description: "www.moi.fr" })).toEqual({ kind: "contact" });
  });

  it("n'accepte que des adresses https, sans identifiants", async () => {
    const { actor } = await freelancer();
    const repo = profileSections(t.db);
    expect(await repo.addPortfolioItem(actor, { title: "Démo", url: "http://demo.example.com" })).toEqual({ kind: "invalid" });
    expect(await repo.addPortfolioItem(actor, { title: "Démo", url: "javascript:alert(1)" })).toEqual({ kind: "invalid" });
    expect(await repo.addPortfolioItem(actor, { title: "Démo", url: "https://user:pass@demo.example.com" })).toEqual({ kind: "invalid" });
    expect(await repo.addCertification(actor, { name: "AWS SAA", credentialUrl: "data:text/html,x" })).toEqual({ kind: "invalid" });
    expect((await repo.addPortfolioItem(actor, { title: "Démo", url: "https://demo.example.com/a b" })).kind).toBe("added");
    expect((await repo.mine(actor))?.portfolio[0]?.url).toBe("https://demo.example.com/a%20b");
  });

  it("plafonne chaque section", async () => {
    const { actor, profileId } = await freelancer();
    await t.db.profileEducation.createMany({ data: Array.from({ length: SECTION_LIMITS.educations }, (_, i) => ({ profileId, school: `École ${i}` })) });
    expect(await profileSections(t.db).addEducation(actor, { school: "Une de trop" })).toEqual({ kind: "limit" });
  });

  it("une langue par code : changer le niveau remplace la ligne ; un code inconnu est refusé", async () => {
    const { actor } = await freelancer();
    const repo = profileSections(t.db);
    expect((await repo.setLanguage(actor, { code: "en", level: "b2" })).kind).toBe("added");
    expect((await repo.setLanguage(actor, { code: "en", level: "c1" })).kind).toBe("added");
    expect(await repo.setLanguage(actor, { code: "xx" as "en", level: "c1" })).toEqual({ kind: "invalid" });
    expect((await repo.mine(actor))?.languages).toEqual([{ code: "en", level: "c1" }]);
    expect(await repo.removeLanguage(actor, "en")).toBe(true);
    expect((await repo.mine(actor))?.languages).toEqual([]);
  });

  it("personne ne retire l'élément d'un autre freelance", async () => {
    const owner = await freelancer();
    const intruder = await freelancer();
    const added = await profileSections(t.db).addEducation(owner.actor, { school: "INSA Lyon" });
    if (added.kind !== "added") throw new Error("non ajoutée");
    expect((await profileSections(t.db).remove(intruder.actor, "educations", added.id)).removed).toBe(false);
    expect((await profileSections(t.db).mine(owner.actor))?.educations).toHaveLength(1);
    expect(await profileSections(t.db).addEducation({ userId: await createUser(t.db) }, { school: "Sans profil" })).toEqual({ kind: "absent" });
  });

  it("confirme la disponibilité à une date", async () => {
    const { actor } = await freelancer();
    const now = new Date("2026-10-15T09:00:00Z");
    expect(await profileSections(t.db).confirmAvailability(actor, now)).toEqual(now);
    expect((await profileSections(t.db).mine(actor))?.availabilityAt).toEqual(now);
  });
});

describe("modifier un élément en place (C21)", () => {
  const added = (result: { readonly kind: string; readonly id?: string }): string => {
    if (result.kind !== "added" || result.id === undefined) throw new Error("non ajouté");
    return result.id;
  };

  it("modifie une expérience, une formation et une certification avec la validation de l'ajout", async () => {
    const { actor } = await freelancer();
    const repo = profileSections(t.db);
    const xp = added(await repo.addExperience(actor, EXPERIENCE));
    const edu = added(await repo.addEducation(actor, { school: "INSA Lyon" }));
    const cert = added(await repo.addCertification(actor, { name: "AWS SAA" }));

    expect(await repo.updateExperience(actor, xp, { ...EXPERIENCE, title: "Staff data engineer", endMonth: month("2025-06"), skills: ["Kafka"] })).toEqual({ kind: "updated", removedFileIds: [] });
    expect(await repo.updateEducation(actor, edu, { school: "INSA Lyon", degree: "Ingénieur", startYear: 2014, endYear: 2019 })).toEqual({ kind: "updated", removedFileIds: [] });
    expect(await repo.updateCertification(actor, cert, { name: "AWS SAA", issuer: "AWS", credentialUrl: "https://aws.example.com/v/2" })).toEqual({ kind: "updated", removedFileIds: [] });

    const mine = await repo.mine(actor);
    expect(mine?.experiences[0]).toMatchObject({ id: xp, title: "Staff data engineer", endMonth: month("2025-06"), skills: ["Kafka"] });
    expect(mine?.educations[0]).toMatchObject({ id: edu, degree: "Ingénieur", endYear: 2019 });
    expect(mine?.certifications[0]).toMatchObject({ id: cert, issuer: "AWS", credentialUrl: "https://aws.example.com/v/2" });
  });

  it("refuse une modification invalide ou porteuse de coordonnées, et laisse l'élément intact", async () => {
    const { actor } = await freelancer();
    const repo = profileSections(t.db);
    const xp = added(await repo.addExperience(actor, EXPERIENCE));
    const cert = added(await repo.addCertification(actor, { name: "AWS SAA" }));
    const item = added(await repo.addPortfolioItem(actor, { title: "Démo", url: "https://demo.example.com" }));

    expect(await repo.updateExperience(actor, xp, { ...EXPERIENCE, endMonth: month("2020-01") })).toEqual({ kind: "invalid" });
    expect(await repo.updateExperience(actor, xp, { ...EXPERIENCE, description: "Écrivez-moi : jean@exemple.fr" })).toEqual({ kind: "contact" });
    expect(await repo.updateCertification(actor, cert, { name: "AWS SAA", credentialUrl: "http://aws.example.com" })).toEqual({ kind: "invalid" });
    expect(await repo.updatePortfolioItem(actor, item, { title: "Démo", url: "https://wa.me/33612345678" })).toEqual({ kind: "contact" });
    expect((await repo.mine(actor))?.experiences[0]).toMatchObject({ endMonth: null, description: "Plateforme Spark." });
  });

  it("l'élément d'un autre freelance est absent, comme un identifiant inconnu", async () => {
    const owner = await freelancer();
    const intruder = await freelancer();
    const repo = profileSections(t.db);
    const edu = added(await repo.addEducation(owner.actor, { school: "INSA Lyon" }));
    const item = added(await repo.addPortfolioItem(owner.actor, { title: "Démo", url: "https://demo.example.com" }));

    expect(await repo.updateEducation(intruder.actor, edu, { school: "Volée" })).toEqual({ kind: "absent" });
    expect(await repo.updatePortfolioItem(intruder.actor, item, { title: "Volée", url: "https://x.example.com" })).toEqual({ kind: "absent" });
    expect(await repo.updateExperience(owner.actor, "pas-un-uuid", EXPERIENCE)).toEqual({ kind: "absent" });
    expect((await repo.mine(owner.actor))?.educations[0]?.school).toBe("INSA Lyon");
  });

  it("une réalisation garde, remplace ou retire son image ; l'ancienne est supprimée", async () => {
    const { actor, userId } = await freelancer();
    const repo = profileSections(t.db);
    const image = (sha: string) => t.db.storedFile.create({ data: { ownerId: userId, kind: "portfolio_image", contentType: "image/webp", size: 10, sha256: sha.repeat(64) }, select: { id: true } });
    const first = await image("1");
    const item = added(await repo.addPortfolioItem(actor, { title: "Démo", url: "https://demo.example.com" }, first.id));

    expect(await repo.updatePortfolioItem(actor, item, { title: "Démo v2", url: "https://demo.example.com" })).toEqual({ kind: "updated", removedFileIds: [] });
    expect((await repo.mine(actor))?.portfolio[0]).toMatchObject({ title: "Démo v2", imageFileId: first.id });

    const second = await image("2");
    expect(await repo.updatePortfolioItem(actor, item, { title: "Démo v2", url: "https://demo.example.com" }, second.id)).toEqual({ kind: "updated", removedFileIds: [first.id] });
    expect(await t.db.storedFile.count({ where: { id: first.id } })).toBe(0);

    // L'image d'un autre, ou déjà prise par une autre réalisation, n'est pas posée.
    const other = await freelancer();
    const foreign = await t.db.storedFile.create({ data: { ownerId: other.userId, kind: "portfolio_image", contentType: "image/webp", size: 10, sha256: "3".repeat(64) }, select: { id: true } });
    expect(await repo.updatePortfolioItem(actor, item, { title: "Démo v2", url: "https://demo.example.com" }, foreign.id)).toEqual({ kind: "absent" });
    const otherItem = added(await repo.addPortfolioItem(actor, { title: "Autre", url: "https://autre.example.com" }));
    expect(await repo.updatePortfolioItem(actor, otherItem, { title: "Autre", url: "https://autre.example.com" }, second.id)).toEqual({ kind: "absent" });

    expect(await repo.updatePortfolioItem(actor, item, { title: "Démo v2", url: "https://demo.example.com" }, null)).toEqual({ kind: "updated", removedFileIds: [second.id] });
    expect((await repo.mine(actor))?.portfolio.find((p) => p.id === item)?.imageFileId).toBeNull();
    expect(await t.db.storedFile.count({ where: { ownerId: userId } })).toBe(0);
  });
});

describe("page publique enrichie", () => {
  const fill = async (userId: string, profileId: string) => {
    const actor = { userId };
    await profileSections(t.db).addExperience(actor, { ...EXPERIENCE, companyHidden: true });
    await profileSections(t.db).addExperience(actor, { title: "Data engineer", company: "Beta", startMonth: month("2019-01"), endMonth: month("2023-02") });
    await profileSections(t.db).addCertification(actor, { name: "AWS SAA", issuer: "AWS", year: 2024, credentialUrl: "https://aws.example.com/v/1", skills: ["AWS"] });
    await profileSections(t.db).setLanguage(actor, { code: "en", level: "c1" });
    await profileSections(t.db).addEducation(actor, { school: "INSA Lyon", degree: "Ingénieur", startYear: 2014, endYear: 2019 });
    const image = await t.db.storedFile.create({ data: { ownerId: userId, kind: "portfolio_image", contentType: "image/webp", size: 10, sha256: "c".repeat(64) }, select: { id: true } });
    await profileSections(t.db).addPortfolioItem(actor, { title: "Démo", url: "https://demo.example.com" }, image.id);
    const photo = await t.db.storedFile.create({ data: { ownerId: userId, kind: "photo", contentType: "image/webp", size: 10, sha256: "a".repeat(64) }, select: { id: true } });
    await profileSections(t.db).setPhoto(actor, photo.id);
    const { slug } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { slug: true } });
    return { slug: slug ?? "", photoId: photo.id, imageId: image.id };
  };

  it("profil pseudonyme : sections publiées, sans photo, sans image, sans adresse web, sans entreprise ni école", async () => {
    const { userId, profileId } = await freelancer();
    const { slug } = await fill(userId, profileId);
    const page = await publicProfiles(t.db).page(slug);
    expect(page?.photoFileId).toBeNull();
    // Une entreprise ou une école, croisée avec des dates, désigne la personne : un profil pseudonyme n'en montre aucune.
    expect(page?.sections.experiences.map((e) => [e.title, e.company])).toEqual([
      ["Lead data engineer", null],
      ["Data engineer", null],
    ]);
    expect(page?.sections.educations).toEqual([{ school: null, degree: "Ingénieur", startYear: 2014, endYear: 2019 }]);
    expect(page?.sections.certifications[0]).toMatchObject({ name: "AWS SAA", credentialUrl: null });
    expect(page?.sections.portfolio[0]).toMatchObject({ title: "Démo", url: null, imageFileId: null });
    expect(page?.sections.languages).toEqual([{ code: "en", level: "c1" }]);
    expect(page?.availabilityConfirmedAt).toBeInstanceOf(Date);
  });

  it("profil nominatif : photo et adresses publiées", async () => {
    const { userId, profileId } = await freelancer();
    const { slug, photoId, imageId } = await fill(userId, profileId);
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "named" } });
    const page = await publicProfiles(t.db).page(slug);
    expect(page?.photoFileId).toBe(photoId);
    expect(page?.sections.portfolio[0]?.imageFileId).toBe(imageId);
    expect(page?.sections.educations[0]?.school).toBe("INSA Lyon");
    expect(page?.sections.experiences[1]?.company).toBe("Beta");
    expect(page?.sections.certifications[0]?.credentialUrl).toBe("https://aws.example.com/v/1");
    expect(page?.sections.portfolio[0]?.url).toBe("https://demo.example.com/");
    expect(page?.sections.experiences[0]?.company).toBeNull();
  });

  it("l'export RGPD contient les sections et les fichiers ; l'effacement les emporte", async () => {
    const { userId, profileId } = await freelancer();
    await fill(userId, profileId);
    const exported = await gdpr(t.db).exportUser(userId, new Date());
    expect(JSON.stringify(exported?.freelanceProfile)).toContain("Lead data engineer");
    // La photo et l'image de la réalisation.
    expect(exported?.files).toHaveLength(2);
    expect(await gdpr(t.db).eraseUser(userId)).toBe("erased");
    expect(await t.db.storedFile.count({ where: { ownerId: userId } })).toBe(0);
    expect(await t.db.profileExperience.count({ where: { profileId } })).toBe(0);
  });
});
