import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { audienceStats, MAX_KEYWORDS_PER_DAY, purgeAudience, statKeywords, type Sighting } from "../src/audience-stats";
import { freelanceLists } from "../src/freelance-lists";
import { parisDay } from "../src/stat-days";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Comptage de l'audience : un visiteur compte une fois par jour, le propriétaire et les profils privés ne comptent pas,
 * et rien de ce qui est écrit ne permet de retrouver une adresse.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY = "2026-10-15";
const HASH_A = "AAAAAAAAAAAAAAAAAAAAAA";
const HASH_B = "BBBBBBBBBBBBBBBBBBBBBB";
const visitor = (viewerHash: string, day = DAY, viewerClerkId: string | null = null): Sighting => ({ day, viewerHash, viewerClerkId });

const published = async () => {
  const owner = await createUser(t.db);
  const profileId = await createProfile(t.db, owner);
  const { reference } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { reference: true } });
  const { clerkId } = await t.db.user.findUniqueOrThrow({ where: { id: owner }, select: { clerkId: true } });
  return { owner, profileId, reference, clerkId };
};

const statsOf = (profileId: string) => t.db.profileStatDay.findMany({ where: { profileId }, orderBy: { day: "asc" }, select: { views: true, searchAppearances: true, directoryAppearances: true, listAdds: true } });

describe("vues de profil", () => {
  it("compte un visiteur une fois par jour, deux visiteurs deux fois, et de nouveau le lendemain", async () => {
    const p = await published();
    const stats = audienceStats(t.db);
    expect(await stats.recordView(p.reference, visitor(HASH_A))).toBe(true);
    expect(await stats.recordView(p.reference, visitor(HASH_A))).toBe(false);
    expect(await stats.recordView(p.reference, visitor(HASH_B))).toBe(true);
    expect(await stats.recordView(p.reference, visitor(HASH_A, "2026-10-16"))).toBe(true);
    expect(await statsOf(p.profileId)).toEqual([
      { views: 2, searchAppearances: 0, directoryAppearances: 0, listAdds: 0 },
      { views: 1, searchAppearances: 0, directoryAppearances: 0, listAdds: 0 },
    ]);
  });

  it("n'écrit plus d'empreinte au-delà du plafond du jour pour un profil (revue vague 3, M4)", async () => {
    const p = await published();
    const stats = audienceStats(t.db, { maxSightingsPerProfileDay: 3 });
    const hashes = ["CCCCCCCCCCCCCCCCCCCCCC", "DDDDDDDDDDDDDDDDDDDDDD", "EEEEEEEEEEEEEEEEEEEEEE", "FFFFFFFFFFFFFFFFFFFFFF", "GGGGGGGGGGGGGGGGGGGGGG"];
    const counted = [];
    for (const hash of hashes) counted.push(await stats.recordView(p.reference, visitor(hash)));
    expect(counted).toEqual([true, true, true, false, false]);
    expect(await t.db.profileStatSeen.count({ where: { profileId: p.profileId } })).toBe(3);
    expect(await statsOf(p.profileId)).toEqual([{ views: 3, searchAppearances: 0, directoryAppearances: 0, listAdds: 0 }]);
    // Le lendemain, le compte repart.
    expect(await stats.recordView(p.reference, visitor(HASH_A, "2026-10-16"))).toBe(true);
  });

  it("ne compte ni le propriétaire connecté, ni un profil privé, ni une référence inconnue", async () => {
    const p = await published();
    const stats = audienceStats(t.db);
    expect(await stats.recordView(p.reference, visitor(HASH_A, DAY, p.clerkId))).toBe(false);
    expect(await stats.recordView(p.reference, visitor(HASH_B, DAY, "clerk_someone_else"))).toBe(true);
    const hidden = await createProfile(t.db, await createUser(t.db), "private");
    const { reference } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: hidden }, select: { reference: true } });
    expect(await stats.recordView(reference, visitor(HASH_A))).toBe(false);
    expect(await stats.recordView("FR-ZZZZZ", visitor(HASH_A))).toBe(false);
    expect(await statsOf(hidden)).toEqual([]);
    expect(await statsOf(p.profileId)).toEqual([{ views: 1, searchAppearances: 0, directoryAppearances: 0, listAdds: 0 }]);
  });

  it("refuse une adresse en clair : ni le code ni la base ne l'acceptent comme empreinte", async () => {
    const p = await published();
    const stats = audienceStats(t.db);
    expect(await stats.recordView(p.reference, visitor("203.0.113.7"))).toBe(false);
    expect(await stats.recordView(p.reference, visitor("2001:db8::1"))).toBe(false);
    await expect(t.db.profileStatSeen.create({ data: { day: new Date(`${DAY}T00:00:00Z`), profileId: p.profileId, scope: "view", viewerHash: "203.0.113.7-padding-xx" } })).rejects.toThrow();
    const stored = await t.db.profileStatSeen.findMany({ select: { viewerHash: true, scope: true } });
    expect(stored.every((row) => /^[A-Za-z0-9_-]{22}$/.test(row.viewerHash))).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("203.0.113.7");
  });
});

describe("apparitions et mots-clés", () => {
  it("compte une apparition par visiteur et par jour, dans la recherche et dans l'annuaire séparément", async () => {
    const a = await published();
    const b = await published();
    const stats = audienceStats(t.db);
    expect(await stats.recordAppearances("search", [a.reference, b.reference], visitor(HASH_A))).toBe(2);
    expect(await stats.recordAppearances("search", [a.reference], visitor(HASH_A))).toBe(0);
    expect(await stats.recordAppearances("directory", [a.reference], visitor(HASH_A))).toBe(1);
    expect(await statsOf(a.profileId)).toEqual([{ views: 0, searchAppearances: 1, directoryAppearances: 1, listAdds: 0 }]);
    expect(await statsOf(b.profileId)).toEqual([{ views: 0, searchAppearances: 1, directoryAppearances: 0, listAdds: 0 }]);
  });

  it("agrège les filtres normalisés qui ont fait apparaître le profil, une fois par visiteur, jamais l'entreprise", async () => {
    const p = await published();
    const stats = audienceStats(t.db);
    const react = statKeywords({ skills: ["React", "react ", "Node.js"], city: "Paris" });
    expect(react).toEqual([
      { kind: "skill", keyword: "react" },
      { kind: "skill", keyword: "nodejs" },
      { kind: "city", keyword: "paris" },
    ]);
    await stats.recordAppearances("search", [p.reference], visitor(HASH_A), react);
    await stats.recordAppearances("search", [p.reference], visitor(HASH_A), statKeywords({ skills: ["React", "TypeScript"] }));
    await stats.recordAppearances("search", [p.reference], visitor(HASH_B), statKeywords({ skills: ["React"] }));
    // L'annuaire public ne garde aucun filtre.
    await stats.recordAppearances("directory", [p.reference], visitor(HASH_A), statKeywords({ skills: ["Go"] }));
    const rows = await t.db.profileStatKeyword.findMany({ where: { profileId: p.profileId }, orderBy: { keyword: "asc" }, select: { kind: true, keyword: true, appearances: true } });
    expect(rows).toEqual([
      { kind: "skill", keyword: "nodejs", appearances: 1 },
      { kind: "city", keyword: "paris", appearances: 1 },
      { kind: "skill", keyword: "react", appearances: 2 },
      { kind: "skill", keyword: "typescript", appearances: 1 },
    ]);
    expect(Object.keys(await t.db.profileStatKeyword.findFirstOrThrow({ where: { profileId: p.profileId } }))).not.toContain("organisationId");
  });

  it("compte une langue demandée par son code, sans le niveau ; un code hors liste n'entre pas (C21)", async () => {
    const p = await published();
    const keywords = statKeywords({ skills: ["Go"], languages: ["en", "en", "xx", "de"] });
    expect(keywords).toEqual([
      { kind: "skill", keyword: "go" },
      { kind: "language", keyword: "en" },
      { kind: "language", keyword: "de" },
    ]);
    await audienceStats(t.db).recordAppearances("search", [p.reference], visitor(HASH_A), keywords);
    const rows = await t.db.profileStatKeyword.findMany({ where: { profileId: p.profileId, kind: "language" }, orderBy: { keyword: "asc" }, select: { keyword: true, appearances: true } });
    expect(rows).toEqual([
      { keyword: "de", appearances: 1 },
      { keyword: "en", appearances: 1 },
    ]);
  });

  it("ne garde que vingt filtres par profil et par jour, puis la purge ramène aux plus fréquents", async () => {
    const p = await published();
    const stats = audienceStats(t.db);
    const skills = Array.from({ length: 10 }, (_, i) => `skill${String(i).padStart(2, "0")}`);
    await stats.recordAppearances("search", [p.reference], visitor(HASH_A), statKeywords({ skills }));
    await stats.recordAppearances("search", [p.reference], visitor(HASH_B), statKeywords({ skills: skills.slice(0, 3) }));
    const more = Array.from({ length: 10 }, (_, i) => `other${String(i).padStart(2, "0")}`);
    await stats.recordAppearances("search", [p.reference], visitor("CCCCCCCCCCCCCCCCCCCCCC"), statKeywords({ skills: more }));
    await stats.recordAppearances("search", [p.reference], visitor("DDDDDDDDDDDDDDDDDDDDDD"), statKeywords({ skills: ["extra-one", "extra-two"] }));
    expect(await t.db.profileStatKeyword.count({ where: { profileId: p.profileId } })).toBe(MAX_KEYWORDS_PER_DAY);
    // Le mot déjà connu continue de compter.
    await stats.recordAppearances("search", [p.reference], visitor("EEEEEEEEEEEEEEEEEEEEEE"), statKeywords({ skills: ["skill00"] }));
    expect((await t.db.profileStatKeyword.findFirstOrThrow({ where: { profileId: p.profileId, keyword: "skill00" } })).appearances).toBe(3);
  });
});

describe("ajouts à une liste et recherches d'équipe", () => {
  it("compte l'ajout d'un profil à une liste, et la recherche d'un membre seulement", async () => {
    const p = await published();
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const list = await freelanceLists(t.db).create({ userId: recruiter }, org, "Short-list");
    if (list.kind !== "created") throw new Error(list.kind);
    expect(await freelanceLists(t.db).addItem({ userId: recruiter }, list.id, p.profileId)).toBe("added");
    expect(await freelanceLists(t.db).addItem({ userId: recruiter }, list.id, p.profileId)).toBe("already");
    const today = await t.db.profileStatDay.findUniqueOrThrow({ where: { profileId_day: { profileId: p.profileId, day: new Date(`${parisDay(new Date())}T00:00:00Z`) } } });
    expect(today.listAdds).toBe(1);

    const stats = audienceStats(t.db);
    await stats.recordSearch({ userId: recruiter }, org, DAY);
    await stats.recordSearch({ userId: recruiter }, org, DAY);
    await stats.recordSearch({ userId: await createUser(t.db) }, org, DAY);
    expect(await t.db.organisationStatDay.findMany({ where: { organisationId: org }, select: { searches: true } })).toEqual([{ searches: 2 }]);
  });
});

describe("purge", () => {
  it("efface les empreintes des jours passés et les compteurs de plus de treize mois", async () => {
    const p = await published();
    const stats = audienceStats(t.db);
    await stats.recordView(p.reference, visitor(HASH_A, "2026-10-14"));
    await stats.recordView(p.reference, visitor(HASH_A, "2026-10-15"));
    await stats.recordView(p.reference, visitor(HASH_A, "2025-09-10"));
    await stats.recordView(p.reference, visitor(HASH_A, "2025-09-20"));
    await purgeAudience(t.db, new Date("2026-10-15T10:00:00Z"));
    expect(await t.db.profileStatSeen.findMany({ where: { profileId: p.profileId }, select: { day: true } })).toEqual([{ day: new Date("2026-10-15T00:00:00Z") }]);
    const days = await t.db.profileStatDay.findMany({ where: { profileId: p.profileId }, orderBy: { day: "asc" }, select: { day: true } });
    expect(days.map((d) => d.day.toISOString().slice(0, 10))).toEqual(["2025-09-20", "2026-10-14", "2026-10-15"]);
  });

  it("ramène les filtres du jour aux vingt plus fréquents", async () => {
    const p = await published();
    const day = new Date(`${parisDay(new Date())}T00:00:00Z`);
    await t.db.profileStatKeyword.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ profileId: p.profileId, day, kind: "skill" as const, keyword: `kw${String(i).padStart(2, "0")}`, appearances: i + 1 })),
    });
    await purgeAudience(t.db, new Date());
    const kept = await t.db.profileStatKeyword.findMany({ where: { profileId: p.profileId }, orderBy: { appearances: "asc" }, select: { appearances: true } });
    expect(kept).toHaveLength(MAX_KEYWORDS_PER_DAY);
    expect(kept[0]?.appearances).toBe(6);
  });
});
