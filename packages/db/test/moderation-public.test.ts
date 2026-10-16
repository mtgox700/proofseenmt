import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Operator } from "../src/back-office";
import { barometers } from "../src/barometers";
import { cityPages } from "../src/city-pages";
import { companyPages } from "../src/company-pages";
import { freelanceLists } from "../src/freelance-lists";
import { messaging } from "../src/messaging";
import { missionInvitations } from "../src/mission-invitations";
import { missions } from "../src/missions";
import { moderation } from "../src/moderation";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { skillPages } from "../src/skill-pages";
import { storedFiles } from "../src/stored-files";
import { userDesk } from "../src/user-desk";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Un contenu masqué par un opérateur, ou dont l'auteur est suspendu, sort de CHAQUE chemin public : un test par chemin,
 * pour qu'une requête qui oublierait le filtre se voie au lieu de se deviner.
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
const REASON = "Contenu contraire aux conditions";
let drawn = 0;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const nextReference = (): string => {
  drawn += 1;
  return `FR-MP${ALPHABET[Math.floor(drawn / 31) % 31]}${ALPHABET[drawn % 31]}Q`;
};

const published = async (skill: string, city = "Lille", dailyRateCents: number | null = 60_000) => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create({ userId }, { headline: "Dev", summary: "Résumé.", city, workMode: "remote", dailyRateCents, skills: [skill] }, nextReference);
  if (created === null) throw new Error("profil non créé");
  await profiles(t.db).setVisibility({ userId }, "named");
  return { userId, id: created.id, reference: created.reference, slug: created.reference.toLowerCase() };
};

const company = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  return { recruiter, org };
};

const openMission = async (c: { recruiter: string; org: string }, skill: string, city: string | null = null): Promise<string> => {
  const created = await missions(t.db).create({ userId: c.recruiter }, c.org, {
    title: `Mission ${skill}`,
    description: `Une mission ${skill} réelle.`,
    workMode: city === null ? "remote" : "hybrid",
    city,
    dailyRateMinCents: 50_000,
    dailyRateMaxCents: 70_000,
    skills: [skill],
  });
  if (created === null) throw new Error("mission non créée");
  await missions(t.db).publish({ userId: c.recruiter }, created.id, NOW);
  return created.id;
};

const hideProfile = (reference: string) => moderation(t.db, operator).hide("profile", reference, REASON, NOW);
const hideMission = (id: string) => moderation(t.db, operator).hide("mission", id, REASON, NOW);

describe("un profil masqué sort de chaque chemin public", () => {
  it("page publique du profil", async () => {
    const p = await published("Zig");
    expect(await publicProfiles(t.db).page(p.slug)).not.toBeNull();
    expect(await hideProfile(p.reference)).toBe("done");
    expect(await publicProfiles(t.db).page(p.slug)).toBeNull();
    expect(await moderation(t.db, operator).restore("profile", p.reference, "Erreur de modération", NOW)).toBe("done");
    expect(await publicProfiles(t.db).page(p.slug)).not.toBeNull();
  });

  it("annuaire public", async () => {
    const p = await published("Nim");
    const slugs = async () => (await publicProfiles(t.db).directory({ skill: "Nim" })).items.map((i) => i.slug);
    expect(await slugs()).toContain(p.slug);
    await hideProfile(p.reference);
    expect(await slugs()).not.toContain(p.slug);
  });

  it("sitemap des profils", async () => {
    const p = await published("Crystal");
    const slugs = async () => (await publicProfiles(t.db).listForSitemap()).map((i) => i.slug);
    expect(await slugs()).toContain(p.slug);
    await hideProfile(p.reference);
    expect(await slugs()).not.toContain(p.slug);
  });

  it("recherche de freelances des entreprises", async () => {
    const p = await published("Odin");
    const found = async () => (await profiles(t.db).search({ skills: ["Odin"] }, NOW)).items.map((i) => i.reference);
    expect(await found()).toContain(p.reference);
    await hideProfile(p.reference);
    expect(await found()).not.toContain(p.reference);
  });

  it("lecture publique d'un profil par son adresse (API)", async () => {
    const p = await published("Gleam");
    expect(await profiles(t.db).findPublic(p.slug)).not.toBeNull();
    await hideProfile(p.reference);
    expect(await profiles(t.db).findPublic(p.slug)).toBeNull();
  });

  it("page métier, sitemap des métiers et llms.txt (qui lit la même liste)", async () => {
    const p = await published("Pony");
    await openMission(await company(), "Pony");
    expect(await skillPages(t.db).page("pony")).not.toBeNull();
    expect((await skillPages(t.db).page("pony"))?.profiles).toHaveLength(1);
    await hideProfile(p.reference);
    // Une mission seule ne suffit plus à faire une page : le profil masqué ne compte plus.
    expect(await skillPages(t.db).page("pony")).toBeNull();
    expect((await skillPages(t.db).listForSitemap()).map((s) => s.key)).not.toContain("pony");
  });

  it("baromètre des TJM", async () => {
    const p = await published("Racket", "Lille", 61_000);
    const before = (await barometers(t.db).rates(NOW)).profiles.total;
    await hideProfile(p.reference);
    expect((await barometers(t.db).rates(NOW)).profiles.total).toBe(before - 1);
  });

  it("photo publique d'un profil nominatif", async () => {
    const p = await published("Idris");
    const file = await t.db.storedFile.create({ data: { ownerId: p.userId, kind: "photo", contentType: "image/webp", size: 10, sha256: "a".repeat(64) }, select: { id: true } });
    await t.db.freelanceProfile.update({ where: { id: p.id }, data: { photoFileId: file.id } });
    expect((await storedFiles(t.db).readable(file.id, null))?.audience).toBe("public");
    await hideProfile(p.reference);
    expect(await storedFiles(t.db).readable(file.id, null)).toBeNull();
  });
});

describe("un profil masqué ne se démarche plus", () => {
  it("ni prise de contact, ni invitation à postuler, ni ajout à une liste d'entreprise", async () => {
    const p = await published("Elm");
    const c = await company();
    const mission = await openMission(c, "Elm");
    const list = await freelanceLists(t.db).create({ userId: c.recruiter }, c.org, "Présélection");
    if (list.kind !== "created") throw new Error(list.kind);
    await hideProfile(p.reference);
    expect(await messaging(t.db).contact({ userId: c.recruiter }, c.org, p.id, "Bonjour, une mission ?")).toEqual({ kind: "absent" });
    expect((await missionInvitations(t.db).invite({ userId: c.recruiter }, mission, p.reference, NOW)).kind).toBe("unknown_profile");
    expect(await freelanceLists(t.db).addItem({ userId: c.recruiter }, list.id, p.id)).toBe("absent");
  });
});

describe("une mission masquée sort de chaque chemin public", () => {
  it("page publique de la mission", async () => {
    const id = await openMission(await company(), "Fortran");
    expect(await missions(t.db).findPublic(id, NOW)).not.toBeNull();
    expect(await hideMission(id)).toBe("done");
    expect(await missions(t.db).findPublic(id, NOW)).toBeNull();
  });

  it("liste et recherche des missions, plein texte compris", async () => {
    const id = await openMission(await company(), "Cobol");
    const bySkill = async () => (await missions(t.db).search({ skills: ["Cobol"] })).items.map((m) => m.id);
    const byText = async () => (await missions(t.db).search({ q: "Cobol" })).items.map((m) => m.id);
    expect(await bySkill()).toContain(id);
    expect(await byText()).toContain(id);
    await hideMission(id);
    expect(await bySkill()).not.toContain(id);
    expect(await byText()).not.toContain(id);
  });

  it("sitemap des missions", async () => {
    const id = await openMission(await company(), "Ada");
    const ids = async () => (await missions(t.db).listOpenForSitemap()).map((m) => m.id);
    expect(await ids()).toContain(id);
    await hideMission(id);
    expect(await ids()).not.toContain(id);
  });

  it("page de ville et sitemap des villes", async () => {
    const c = await company();
    const first = await openMission(c, "Pascal", "Quimper");
    await openMission(c, "Pascal", "Quimper");
    expect((await cityPages(t.db).page("quimper"))?.missions).toHaveLength(2);
    await hideMission(first);
    // Il faut deux missions pour une page de ville : il n'en reste qu'une publique.
    expect(await cityPages(t.db).page("quimper")).toBeNull();
    expect((await cityPages(t.db).listForSitemap()).map((city) => city.key)).not.toContain("quimper");
  });

  it("page métier", async () => {
    const id = await openMission(await company(), "Smalltalk");
    await openMission(await company(), "Smalltalk");
    expect((await skillPages(t.db).page("smalltalk"))?.missions).toHaveLength(2);
    await hideMission(id);
    expect(await skillPages(t.db).page("smalltalk")).toBeNull();
  });

  it("baromètres des TJM et des compétences demandées", async () => {
    const id = await openMission(await company(), "Lisp");
    const [rates, skills] = await Promise.all([barometers(t.db).rates(NOW), barometers(t.db).skills(NOW)]);
    await hideMission(id);
    expect((await barometers(t.db).rates(NOW)).missions.total).toBe(rates.missions.total - 1);
    expect((await barometers(t.db).skills(NOW)).totalMissions).toBe(skills.totalMissions - 1);
  });

  it("missions listées sur la page publique de l'entreprise", async () => {
    const c = await company();
    const page = await companyPages(t.db).publish({ userId: c.recruiter }, c.org, { publicName: "Acme Modération" }, NOW);
    if (page.kind !== "saved") throw new Error(page.kind);
    const id = await openMission(c, "Prolog");
    expect((await companyPages(t.db).page(page.slug, NOW))?.missions.map((m) => m.id)).toContain(id);
    await hideMission(id);
    expect((await companyPages(t.db).page(page.slug, NOW))?.missions.map((m) => m.id)).not.toContain(id);
  });
});

describe("une page d'entreprise masquée sort de chaque chemin public", () => {
  it("page publique, sitemap des entreprises, lien depuis ses missions", async () => {
    const c = await company();
    const page = await companyPages(t.db).publish({ userId: c.recruiter }, c.org, { publicName: "Acme Cachée" }, NOW);
    if (page.kind !== "saved") throw new Error(page.kind);
    const mission = await openMission(c, "Scheme");
    expect((await missions(t.db).findPublic(mission, NOW))?.organisationSlug).toBe(page.slug);
    expect(await moderation(t.db, operator).hide("company", page.slug, REASON, NOW)).toBe("done");
    expect(await companyPages(t.db).page(page.slug, NOW)).toBeNull();
    expect((await companyPages(t.db).listForSitemap()).map((p) => p.slug)).not.toContain(page.slug);
    expect((await missions(t.db).findPublic(mission, NOW))?.organisationSlug).toBeNull();
  });
});

describe("une entreprise masquée avec ses missions sort de chaque chemin public (revue vague 3, M5)", () => {
  it("sa page et toutes ses missions, même écrites par un membre actif, jusqu'au rétablissement", async () => {
    const c = await company();
    const page = await companyPages(t.db).publish({ userId: c.recruiter }, c.org, { publicName: "Acme Entière" }, NOW);
    if (page.kind !== "saved") throw new Error(page.kind);
    const mission = await openMission(c, "Erlang", "Brest");
    await openMission(c, "Erlang", "Brest");
    const desk = moderation(t.db, operator);
    const listed = async () => (await missions(t.db).search({ skills: ["Erlang"] })).items.map((m) => m.id);
    expect(await listed()).toContain(mission);

    expect(await desk.hide("organisation", c.org, REASON, NOW)).toBe("done");
    expect(await desk.hide("organisation", c.org, REASON, NOW)).toBe("unchanged");
    expect(await missions(t.db).findPublic(mission, NOW)).toBeNull();
    expect(await listed()).not.toContain(mission);
    expect((await missions(t.db).listOpenForSitemap()).map((m) => m.id)).not.toContain(mission);
    expect(await cityPages(t.db).page("brest")).toBeNull();
    expect(await companyPages(t.db).page(page.slug, NOW)).toBeNull();
    expect((await companyPages(t.db).listForSitemap()).map((p) => p.slug)).not.toContain(page.slug);
    // Le masque de la seule page reste une autre décision : il n'a pas été posé.
    expect((await t.db.organisation.findUniqueOrThrow({ where: { id: c.org } })).moderatedAt).toBeNull();

    expect(await desk.restore("organisation", page.slug, "Masque levé", NOW)).toBe("done");
    expect(await missions(t.db).findPublic(mission, NOW)).not.toBeNull();
    expect(await companyPages(t.db).page(page.slug, NOW)).not.toBeNull();
  });

  it("masquer la seule page publique laisse ses missions publiques", async () => {
    const c = await company();
    const page = await companyPages(t.db).publish({ userId: c.recruiter }, c.org, { publicName: "Acme Page Seule" }, NOW);
    if (page.kind !== "saved") throw new Error(page.kind);
    const mission = await openMission(c, "Elixir");
    expect(await moderation(t.db, operator).hide("company", page.slug, REASON, NOW)).toBe("done");
    expect(await missions(t.db).findPublic(mission, NOW)).not.toBeNull();
  });
});

describe("un compte suspendu n'a plus de contenu public", () => {
  it("son profil, les missions qu'il a écrites, la page d'une entreprise dont il est le seul membre", async () => {
    const p = await published("Haxe");
    const c = await company();
    const page = await companyPages(t.db).publish({ userId: c.recruiter }, c.org, { publicName: "Acme Suspendue" }, NOW);
    if (page.kind !== "saved") throw new Error(page.kind);
    const mission = await openMission(c, "Haxe");
    const desk = userDesk(t.db, operator);
    expect(await desk.suspend(p.userId, REASON, NOW)).toBe("done");
    expect(await desk.suspend(c.recruiter, REASON, NOW)).toBe("done");

    expect(await publicProfiles(t.db).page(p.slug)).toBeNull();
    expect((await profiles(t.db).search({ skills: ["Haxe"] }, NOW)).items).toHaveLength(0);
    expect(await missions(t.db).findPublic(mission, NOW)).toBeNull();
    expect((await missions(t.db).search({ skills: ["Haxe"] })).items).toHaveLength(0);
    expect(await companyPages(t.db).page(page.slug, NOW)).toBeNull();

    expect(await desk.restore(p.userId, "Suspension levée", NOW)).toBe("done");
    expect(await publicProfiles(t.db).page(p.slug)).not.toBeNull();
  });

  it("la page d'une entreprise reste publique tant qu'un autre membre est actif", async () => {
    const c = await company();
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: colleague, role: "admin" } });
    const page = await companyPages(t.db).publish({ userId: c.recruiter }, c.org, { publicName: "Acme Collègue" }, NOW);
    if (page.kind !== "saved") throw new Error(page.kind);
    await userDesk(t.db, operator).suspend(c.recruiter, REASON, NOW);
    expect(await companyPages(t.db).page(page.slug, NOW)).not.toBeNull();
  });
});
