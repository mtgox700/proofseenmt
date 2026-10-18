import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gdpr } from "../src/gdpr";
import { profiles, type ProfileInput } from "../src/profiles";
import { MAX_SAVED_SEARCHES_PER_ORGANISATION, MAX_SEARCH_ALERTS_PER_USER, SEARCH_ALERT_INTERVAL_MS, savedSearches, type SavedSearchInput } from "../src/saved-searches";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Recherches enregistrées d'une entreprise (C22) : partagées entre ses membres, invisibles des autres entreprises ;
 * alerte quotidienne pour le seul créateur, qui ne reçoit jamais deux fois le même profil ni le stock existant.
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
  return `FR-W${ALPHABET[Math.floor(drawn / 31) % 31]}${ALPHABET[drawn % 31]}SS`;
};

const BASE: ProfileInput = { headline: "Développeur", summary: "Résumé du profil.", city: "Nantes", workMode: "remote", skills: [] };

const publish = async (skills: readonly string[]): Promise<string> => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create({ userId }, { ...BASE, skills: [...skills] }, nextReference);
  if (created === null) throw new Error("profil non créé");
  await profiles(t.db).setVisibility({ userId }, "pseudonymous");
  return created.id;
};

const company = async () => {
  const owner = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, owner);
  const member = await createUser(t.db);
  await t.db.membership.create({ data: { organisationId, userId: member, role: "member" } });
  return { organisationId, owner: { userId: owner }, member: { userId: member } };
};

const input = (skill: string, alert = false): SavedSearchInput => ({ name: `Recherche ${skill}`, query: `competences=${skill}`, filters: { skills: [skill] }, alert });

describe("recherches enregistrées : accès", () => {
  it("se partagent entre membres de l'entreprise, jamais avec une autre", async () => {
    const acme = await company();
    const other = await company();
    const repo = savedSearches(t.db);
    const created = await repo.create(acme.member, acme.organisationId, input("Rust"), new Date());
    if (created.kind !== "created") throw new Error(created.kind);

    expect((await repo.list(acme.owner, acme.organisationId))?.map((s) => [s.name, s.mine, s.removable])).toEqual([["Recherche Rust", false, true]]);
    expect((await repo.list(acme.member, acme.organisationId))?.map((s) => [s.mine, s.removable])).toEqual([[true, true]]);
    expect(await repo.list(other.owner, acme.organisationId)).toBeNull();
    expect(await repo.query(acme.owner, created.id)).toBe("competences=Rust");
    expect(await repo.query(other.owner, created.id)).toBeNull();
    expect(await repo.create(other.owner, acme.organisationId, input("Go"), new Date())).toEqual({ kind: "absent" });
    // Seul le créateur règle l'alerte ; une autre entreprise ne la voit même pas.
    expect(await repo.setAlert(acme.owner, created.id, true, new Date())).toBe("absent");
    expect(await repo.setAlert(other.owner, created.id, true, new Date())).toBe("absent");
    expect(await repo.remove(other.owner, created.id)).toBe(false);
  });

  it("se supprime par son créateur ou un administrateur, pas par un autre membre", async () => {
    const acme = await company();
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: acme.organisationId, userId: colleague, role: "member" } });
    const repo = savedSearches(t.db);
    const first = await repo.create(acme.member, acme.organisationId, input("Go"), new Date());
    const second = await repo.create(acme.member, acme.organisationId, input("Ada"), new Date());
    if (first.kind !== "created" || second.kind !== "created") throw new Error("non créées");
    expect(await repo.remove({ userId: colleague }, first.id)).toBe(false);
    expect(await repo.remove(acme.member, first.id)).toBe(true);
    expect(await repo.remove(acme.owner, second.id)).toBe(true);
    expect(await repo.list(acme.owner, acme.organisationId)).toEqual([]);
  });

  it("refuse un nom vide, une adresse hors format, des filtres invalides ; tient les plafonds", async () => {
    const acme = await company();
    const repo = savedSearches(t.db);
    expect(await repo.create(acme.owner, acme.organisationId, { ...input("Go"), name: " " }, new Date())).toEqual({ kind: "invalid" });
    expect(await repo.create(acme.owner, acme.organisationId, { ...input("Go"), query: "?competences=Go" }, new Date())).toEqual({ kind: "invalid" });
    expect(await repo.create(acme.owner, acme.organisationId, { ...input("Go"), filters: { jobTitle: "astronaute" } }, new Date())).toEqual({ kind: "invalid" });
    for (let i = 0; i < MAX_SEARCH_ALERTS_PER_USER; i += 1) expect((await repo.create(acme.owner, acme.organisationId, input(`a${i}`, true), new Date())).kind).toBe("created");
    expect(await repo.create(acme.owner, acme.organisationId, input("trop", true), new Date())).toEqual({ kind: "alert_limit" });
    for (let i = MAX_SEARCH_ALERTS_PER_USER; i < MAX_SAVED_SEARCHES_PER_ORGANISATION; i += 1) expect((await repo.create(acme.owner, acme.organisationId, input(`s${i}`), new Date())).kind).toBe("created");
    expect(await repo.create(acme.member, acme.organisationId, input("plein"), new Date())).toEqual({ kind: "limit" });
  });
});

describe("recherches enregistrées : alerte quotidienne", () => {
  const later = (from: Date, ms = SEARCH_ALERT_INTERVAL_MS + 1000): Date => new Date(from.getTime() + ms);
  const pending = async (userId: string) => t.db.notification.findMany({ where: { userId, kind: "profile_match" }, select: { payload: true } });

  it("ne renvoie ni le stock existant, ni deux fois le même profil, et attend un jour entre deux passages", async () => {
    const acme = await company();
    const repo = savedSearches(t.db);
    await publish(["Nim"]);
    const start = new Date();
    const created = await repo.create(acme.member, acme.organisationId, input("Nim", true), start);
    if (created.kind !== "created") throw new Error(created.kind);

    expect(await repo.scan(later(start))).toBe(0);
    const fresh = await publish(["Nim"]);
    // Moins d'un jour après le passage précédent : rien ne part.
    expect(await repo.scan(later(start, 60_000))).toBe(0);
    const second = later(later(start));
    expect(await repo.scan(second)).toBe(1);
    const sent = await pending(acme.member.userId);
    expect(sent).toHaveLength(1);
    const slug = (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: fresh }, select: { slug: true } })).slug;
    expect(sent[0]?.payload).toEqual({ savedSearchId: created.id, slugs: [slug] });
    expect(await repo.scan(later(second))).toBe(0);
    expect(await pending(acme.owner.userId)).toEqual([]);
  });

  it("s'éteint quand le créateur quitte l'entreprise, et ne repart qu'après réactivation par lui", async () => {
    const acme = await company();
    const repo = savedSearches(t.db);
    const start = new Date();
    const created = await repo.create(acme.member, acme.organisationId, input("Crystal", true), start);
    if (created.kind !== "created") throw new Error(created.kind);
    await t.db.membership.delete({ where: { organisationId_userId: { organisationId: acme.organisationId, userId: acme.member.userId } } });
    await publish(["Crystal"]);
    expect(await repo.scan(later(start))).toBe(0);
    expect((await t.db.savedSearch.findUniqueOrThrow({ where: { id: created.id }, select: { alert: true } })).alert).toBe(false);
    expect(await repo.setAlert(acme.member, created.id, true, new Date())).toBe("absent");
  });

  it("à la réactivation, marque vus les profils qui répondent déjà", async () => {
    const acme = await company();
    const repo = savedSearches(t.db);
    const created = await repo.create(acme.owner, acme.organisationId, input("Pony"), new Date());
    if (created.kind !== "created") throw new Error(created.kind);
    await publish(["Pony"]);
    const on = new Date();
    expect(await repo.setAlert(acme.owner, created.id, true, on)).toBe("saved");
    expect(await repo.scan(later(on))).toBe(0);
    await publish(["Pony"]);
    expect(await repo.scan(later(later(on)))).toBe(1);
  });
});

describe("recherches enregistrées : RGPD", () => {
  it("figurent dans l'export ; restent à l'entreprise, sans alerte ni créateur, après l'effacement du compte", async () => {
    const acme = await company();
    const repo = savedSearches(t.db);
    const created = await repo.create(acme.member, acme.organisationId, input("Odin", true), new Date());
    if (created.kind !== "created") throw new Error(created.kind);
    const exported = await gdpr(t.db).exportUser(acme.member.userId, new Date());
    expect(JSON.stringify(exported?.freelanceLists)).toContain("Recherche Odin");
    expect(await gdpr(t.db).eraseUser(acme.member.userId)).toBe("erased");
    const row = await t.db.savedSearch.findUniqueOrThrow({ where: { id: created.id }, select: { createdByUserId: true } });
    expect(row.createdByUserId).toBeNull();
    expect(await repo.scan(new Date(Date.now() + 2 * SEARCH_ALERT_INTERVAL_MS))).toBe(0);
    expect((await t.db.savedSearch.findUniqueOrThrow({ where: { id: created.id }, select: { alert: true } })).alert).toBe(false);
  });
});
