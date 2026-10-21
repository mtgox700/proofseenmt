import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profileFacets } from "../src/profile-facets";
import { profileSections } from "../src/profile-sections";
import { profiles, type ProfileInput } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, verifiedVigilance, type TestDatabase } from "./support/database";

/*
 * Recherche avancée (C22) : mots-clés sans accents (texte tenu par la base), famille de poste, nouveaux faits filtrés,
 * aucun ordre par compte de preuves, facettes comptées sur l'ensemble filtré, annuaire public élargi. Une compétence
 * propre à chaque test isole ses profils de ceux des autres tests du fichier.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
let drawn = 0;
const nextReference = (): string => {
  drawn += 1;
  return `FR-A${ALPHABET[Math.floor(drawn / 31) % 31]}${ALPHABET[drawn % 31]}VS`;
};

const BASE: ProfileInput = { headline: "Développeur", summary: "Résumé du profil.", city: "Nantes", workMode: "remote", skills: [] };

const make = async (input: Partial<ProfileInput>, visibility: "named" | "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create({ userId }, { ...BASE, ...input }, nextReference);
  if (created === null) throw new Error("profil non créé");
  if (visibility !== "private") await profiles(t.db).setVisibility({ userId }, visibility);
  return { id: created.id, userId };
};

const ids = async (filters: Parameters<ReturnType<typeof profiles>["search"]>[0]): Promise<string[]> => (await profiles(t.db).search(filters)).items.map((p) => p.id);
const sorted = (values: readonly string[]): string[] => [...values].sort();

const verifiedMission = (profileId: string) =>
  t.db.verifiedMission.create({ data: { profileId, role: "Lead", clientKind: "pme", durationMonths: 6, summary: "Refonte.", evidenceKind: "facture", verifiedAt: new Date() } });

describe("mots-clés : titre, résumé, compétences et expériences, sans accents", () => {
  it("trouve un mot du résumé, d'une compétence ou d'une expérience, quelle que soit l'écriture", async () => {
    const summary = await make({ skills: ["Kotlin"], summary: "Migration d'une plateforme bancaire vers le cloud." });
    const skill = await make({ skills: ["Kotlin", "Débogage"] });
    const experience = await make({ skills: ["Kotlin"] });
    await make({ skills: ["Kotlin"] });
    const added = await profileSections(t.db).addExperience({ userId: experience.userId }, { title: "Ingénieure télécommunications", startMonth: new Date("2021-01-01T00:00:00Z"), skills: [] });
    expect(added.kind).toBe("added");

    expect(await ids({ skills: ["kotlin"], text: "BANCAIRE" })).toEqual([summary.id]);
    expect(await ids({ skills: ["kotlin"], text: "debogage" })).toEqual([skill.id]);
    expect(await ids({ skills: ["kotlin"], text: "telecommunications" })).toEqual([experience.id]);
    expect(await ids({ skills: ["kotlin"], text: "inexistant" })).toEqual([]);
  });

  it("garde le texte à jour quand le profil, ses compétences ou ses expériences changent", async () => {
    const p = await make({ skills: ["Elm"] });
    expect(await ids({ skills: ["elm"], text: "astronomie" })).toEqual([]);
    await profiles(t.db).update({ userId: p.userId }, { ...BASE, skills: ["Elm"], summary: "Logiciels d'astronomie." });
    expect(await ids({ skills: ["elm"], text: "astronomie" })).toEqual([p.id]);
    await profiles(t.db).update({ userId: p.userId }, { ...BASE, skills: ["Elm", "Géodésie"] });
    expect(await ids({ skills: ["elm"], text: "geodesie" })).toEqual([p.id]);
    expect(await ids({ skills: ["elm"], text: "astronomie" })).toEqual([]);
    // Une écriture directe de la colonne est recalculée : le texte ne dit jamais autre chose que le profil.
    await t.db.$executeRaw`UPDATE "FreelanceProfile" SET "searchText" = 'faux texte injecte' WHERE "id" = ${p.id}::uuid`;
    expect(await ids({ skills: ["elm"], text: "injecte" })).toEqual([]);
    expect(await ids({ skills: ["elm"], text: "geodesie" })).toEqual([p.id]);
  });

  it("refuse un texte vide ou trop long", async () => {
    await expect(profiles(t.db).search({ text: "" })).rejects.toThrow();
    await expect(profiles(t.db).search({ text: "x".repeat(201) })).rejects.toThrow();
  });
});

describe("famille de poste, faits vérifiés, photo et réalisations", () => {
  it("reconnaît la famille de poste dans le titre, comme les pages publiques par poste", async () => {
    const data = await make({ skills: ["Scio"], headline: "Data Engineer senior" });
    const devops = await make({ skills: ["Scio"], headline: "Ingénieur DevOps" });
    expect(await ids({ skills: ["scio"], jobTitle: "data-engineer" })).toEqual([data.id]);
    expect(await ids({ skills: ["scio"], jobTitle: "devops-sre" })).toEqual([devops.id]);
    await expect(profiles(t.db).search({ jobTitle: "astronaute" })).rejects.toThrow();
  });

  it("filtre sur les missions vérifiées, la photo d'un profil nominatif, les réalisations et la disponibilité immédiate", async () => {
    const withMission = await make({ skills: ["Idris"], availability: "unavailable" });
    const named = await make({ skills: ["Idris"], availability: "available_from", availableFrom: new Date("2027-01-01") }, "named");
    const pseudo = await make({ skills: ["Idris"] }, "pseudonymous");
    const portfolio = await make({ skills: ["Idris"], availability: "unavailable" });
    await verifiedMission(withMission.id);
    for (const p of [named, pseudo]) {
      const file = await t.db.storedFile.create({ data: { ownerId: p.userId, kind: "photo", contentType: "image/webp", size: 10, sha256: "b".repeat(64) }, select: { id: true } });
      await t.db.freelanceProfile.update({ where: { id: p.id }, data: { photoFileId: file.id } });
    }
    await t.db.portfolioItem.create({ data: { profileId: portfolio.id, title: "Démo", url: "https://demo.example.com" } });

    expect(await ids({ skills: ["idris"], verifiedMissionsOnly: true })).toEqual([withMission.id]);
    // Un pseudonyme ne montre jamais de visage : il ne sort pas du filtre « photo », et sa carte n'en porte pas.
    expect(await ids({ skills: ["idris"], photoOnly: true })).toEqual([named.id]);
    expect(await ids({ skills: ["idris"], portfolioOnly: true })).toEqual([portfolio.id]);
    expect(await ids({ skills: ["idris"], availableNow: true })).toEqual([pseudo.id]);
    const { items } = await profiles(t.db).search({ skills: ["idris"] });
    expect(items.find((c) => c.id === named.id)?.photoFileId).not.toBeNull();
    expect(items.find((c) => c.id === pseudo.id)?.photoFileId).toBeNull();
    expect(items.find((c) => c.id === portfolio.id)?.hasPortfolio).toBe(true);
  });
});

describe("aucun ordre par nombre de faits vérifiés (AI Act, revue Kensa M4) : les faits restent des filtres", () => {
  it("refuse l'ordre par compte de preuves, ne renvoie aucun compte sur la carte, et filtre chaque fait pour lui-même", async () => {
    const none = await make({ skills: ["Racket"] });
    const two = await make({ skills: ["Racket"] });
    const three = await make({ skills: ["Racket"] });
    await verifiedMission(two.id);
    await verifiedVigilance(t.db, two.id);
    await verifiedMission(three.id);
    await verifiedMission(three.id);
    await t.db.billingIdentity.create({
      data: { profileId: three.id, legalName: "R EI", siret: nextSiret("552100554"), address: { line1: "1 rue", postalCode: "44000", city: "Nantes", country: "FR" }, registryStatus: "active", registryCheckedAt: new Date() },
    });
    // The old order, asked by hand, is refused by the schema rather than silently honoured.
    await expect(profiles(t.db).search({ skills: ["racket"], sort: "verified_facts" } as unknown as Parameters<ReturnType<typeof profiles>["search"]>[0])).rejects.toThrow();
    const page = await profiles(t.db).search({ skills: ["racket"] });
    expect(sorted(page.items.map((c) => c.id))).toEqual(sorted([none.id, two.id, three.id]));
    for (const card of page.items) expect(card).not.toHaveProperty("verifiedFacts");
    expect(sorted(await ids({ skills: ["racket"], verifiedMissionsOnly: true }))).toEqual(sorted([two.id, three.id]));
    expect(await ids({ skills: ["racket"], vigilanceValidOnly: true })).toEqual([two.id]);
    expect(await ids({ skills: ["racket"], registryActiveOnly: true })).toEqual([three.id]);
  });
});

describe("facettes : des effectifs de profils sur l'ensemble filtré", () => {
  it("compte compétences, villes, modes, postes, langues et faits ; ville et mode sans leur propre filtre", async () => {
    const a = await make({ skills: ["Nix", "Rust"], city: "Lyon", workMode: "remote", headline: "Data engineer" });
    const b = await make({ skills: ["Nix", "Rust"], city: "lyon", workMode: "hybrid", headline: "Ingénieur DevOps" });
    const c = await make({ skills: ["Nix"], city: "Paris", workMode: "remote", headline: "Data engineer" });
    await make({ skills: ["Nix"], city: "Lille" }, "private");
    await t.db.profileLanguage.createMany({ data: [{ profileId: a.id, code: "en", level: "c1" }, { profileId: b.id, code: "en", level: "b2" }, { profileId: c.id, code: "de", level: "b1" }] });
    await verifiedMission(a.id);

    const all = await profileFacets(t.db, { skills: ["nix"] }, new Date());
    expect(all.total).toBe(3);
    expect(all.capped).toBe(false);
    expect(all.skills.map((s) => [s.label, s.count])).toEqual([["Nix", 3], ["Rust", 2]]);
    expect(all.cities.map((s) => [s.key, s.count])).toEqual([["lyon", 2], ["paris", 1]]);
    expect(all.workModes).toEqual({ remote: 2, hybrid: 1, onsite: 0 });
    expect(all.jobTitles).toEqual([{ key: "data-engineer", count: 2 }, { key: "devops-sre", count: 1 }]);
    expect(all.languages).toEqual([{ code: "en", count: 2 }, { code: "de", count: 1 }]);
    expect(all.facts.verifiedMissions).toBe(1);

    // La ville choisie restreint les autres facettes, pas la sienne : les autres villes gardent leur nombre.
    const lyon = await profileFacets(t.db, { skills: ["nix"], city: "Lyon" }, new Date());
    expect(lyon.total).toBe(2);
    expect(lyon.cities.map((s) => [s.key, s.count])).toEqual([["lyon", 2], ["paris", 1]]);
    expect(lyon.workModes).toEqual({ remote: 1, hybrid: 1, onsite: 0 });
    const remote = await profileFacets(t.db, { skills: ["nix"], workModes: ["remote"] }, new Date());
    expect(remote.total).toBe(2);
    expect(remote.workModes).toEqual({ remote: 2, hybrid: 1, onsite: 0 });
    const data = await profileFacets(t.db, { skills: ["nix"], jobTitle: "data-engineer" }, new Date());
    expect(data.total).toBe(2);
    expect(data.jobTitles).toEqual([{ key: "data-engineer", count: 2 }, { key: "devops-sre", count: 1 }]);
    expect(JSON.stringify(all)).not.toMatch(/score|rank|rating/i);
  });

  it("rend des facettes vides quand rien ne répond", async () => {
    const none = await profileFacets(t.db, { skills: ["aucune-competence-zz"] }, new Date());
    expect(none).toMatchObject({ total: 0, skills: [], cities: [], jobTitles: [], languages: [], workModes: { remote: 0, hybrid: 0, onsite: 0 } });
  });
});

describe("annuaire public : filtres élargis, mêmes règles", () => {
  it("filtre par compétences, mode, poste et faits ; photo et nom pour un profil nominatif seulement", async () => {
    const named = await make({ skills: ["Gleam"], headline: "Développeur back-end", workMode: "onsite", dailyRateCents: 65_000 }, "named");
    const pseudo = await make({ skills: ["Gleam", "Erlang"], workMode: "remote" }, "pseudonymous");
    for (const p of [named, pseudo]) {
      const file = await t.db.storedFile.create({ data: { ownerId: p.userId, kind: "photo", contentType: "image/webp", size: 10, sha256: "d".repeat(64) }, select: { id: true } });
      await t.db.freelanceProfile.update({ where: { id: p.id }, data: { photoFileId: file.id } });
    }
    await verifiedMission(pseudo.id);
    const slugsOf = async (search: Parameters<ReturnType<typeof publicProfiles>["directory"]>[0]) => (await publicProfiles(t.db).directory(search)).items.map((i) => i.reference);
    const page = await publicProfiles(t.db).directory({ skill: "gleam" });
    expect(page.items).toHaveLength(2);
    const namedCard = page.items.find((i) => i.displayName !== null);
    const pseudoCard = page.items.find((i) => i.displayName === null);
    expect(namedCard?.photoFileId).not.toBeNull();
    expect(namedCard?.dailyRateCents).toBe(65_000);
    expect(pseudoCard?.photoFileId).toBeNull();
    expect(pseudoCard?.facts.verifiedMissions).toBe(1);

    expect(sorted(await slugsOf({ skills: ["gleam", "erlang"] }))).toEqual([pseudoCard?.reference]);
    expect(await slugsOf({ skill: "gleam", workModes: ["onsite"] })).toEqual([namedCard?.reference]);
    expect(await slugsOf({ skill: "gleam", jobTitle: "developpeur-back-end" })).toEqual([namedCard?.reference]);
    expect(await slugsOf({ skill: "gleam", verifiedMissionsOnly: true })).toEqual([pseudoCard?.reference]);
    await expect(publicProfiles(t.db).directory({ jobTitle: "astronaute" })).rejects.toThrow();
  });
});
