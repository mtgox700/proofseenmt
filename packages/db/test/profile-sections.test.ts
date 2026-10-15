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

describe("page publique enrichie", () => {
  const fill = async (userId: string, profileId: string) => {
    const actor = { userId };
    await profileSections(t.db).addExperience(actor, { ...EXPERIENCE, companyHidden: true });
    await profileSections(t.db).addExperience(actor, { title: "Data engineer", company: "Beta", startMonth: month("2019-01"), endMonth: month("2023-02") });
    await profileSections(t.db).addCertification(actor, { name: "AWS SAA", issuer: "AWS", year: 2024, credentialUrl: "https://aws.example.com/v/1", skills: ["AWS"] });
    await profileSections(t.db).setLanguage(actor, { code: "en", level: "c1" });
    await profileSections(t.db).addPortfolioItem(actor, { title: "Démo", url: "https://demo.example.com" });
    const photo = await t.db.storedFile.create({ data: { ownerId: userId, kind: "photo", contentType: "image/webp", size: 10, sha256: "a".repeat(64) }, select: { id: true } });
    await profileSections(t.db).setPhoto(actor, photo.id);
    const { slug } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { slug: true } });
    return { slug: slug ?? "", photoId: photo.id };
  };

  it("profil pseudonyme : sections publiées, sans photo, sans adresse web, sans entreprise masquée", async () => {
    const { userId, profileId } = await freelancer();
    const { slug } = await fill(userId, profileId);
    const page = await publicProfiles(t.db).page(slug);
    expect(page?.photoFileId).toBeNull();
    expect(page?.sections.experiences.map((e) => [e.title, e.company])).toEqual([
      ["Lead data engineer", null],
      ["Data engineer", "Beta"],
    ]);
    expect(page?.sections.certifications[0]).toMatchObject({ name: "AWS SAA", credentialUrl: null });
    expect(page?.sections.portfolio[0]).toMatchObject({ title: "Démo", url: null });
    expect(page?.sections.languages).toEqual([{ code: "en", level: "c1" }]);
    expect(page?.availabilityConfirmedAt).toBeInstanceOf(Date);
  });

  it("profil nominatif : photo et adresses publiées", async () => {
    const { userId, profileId } = await freelancer();
    const { slug, photoId } = await fill(userId, profileId);
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "named" } });
    const page = await publicProfiles(t.db).page(slug);
    expect(page?.photoFileId).toBe(photoId);
    expect(page?.sections.certifications[0]?.credentialUrl).toBe("https://aws.example.com/v/1");
    expect(page?.sections.portfolio[0]?.url).toBe("https://demo.example.com/");
    expect(page?.sections.experiences[0]?.company).toBeNull();
  });

  it("l'export RGPD contient les sections et les fichiers ; l'effacement les emporte", async () => {
    const { userId, profileId } = await freelancer();
    await fill(userId, profileId);
    const exported = await gdpr(t.db).exportUser(userId, new Date());
    expect(JSON.stringify(exported?.freelanceProfile)).toContain("Lead data engineer");
    expect(exported?.files).toHaveLength(1);
    expect(await gdpr(t.db).eraseUser(userId)).toBe("erased");
    expect(await t.db.storedFile.count({ where: { ownerId: userId } })).toBe(0);
    expect(await t.db.profileExperience.count({ where: { profileId } })).toBe(0);
  });
});
