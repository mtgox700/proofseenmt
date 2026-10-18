import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matching } from "../src/matching";
import { missions, type MissionInput } from "../src/missions";
import { profiles, type ProfileInput } from "../src/profiles";
import { createOrganisation, createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, verifiedVigilance, type TestDatabase } from "./support/database";

/*
 * Rapprochement expliqué sur une vraie base (PGlite) : résultats déterministes, raisons exactes, règles de visibilité et
 * contrôle d'accès. Chaque bloc a sa propre compétence, pour que ses fiches ne croisent pas celles des autres blocs.
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
  return `FR-M${ALPHABET[Math.floor(drawn / 31) % 31]}${ALPHABET[drawn % 31]}TC`;
};

const BASE_PROFILE: ProfileInput = { headline: "Développeur back-end", summary: "Résumé du profil.", city: "Lyon", workMode: "hybrid", skills: [] };

const makeProfile = async (input: Partial<ProfileInput>, visibility: "named" | "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create({ userId }, { ...BASE_PROFILE, ...input }, nextReference);
  if (created === null) throw new Error("profil non créé");
  if (visibility !== "private") await profiles(t.db).setVisibility({ userId }, visibility);
  const row = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: created.id }, select: { slug: true, reference: true } });
  return { userId, id: created.id, slug: row.slug ?? "", reference: row.reference };
};

const BASE_MISSION: MissionInput = { title: "Développeur back-end", description: "Une mission.", workMode: "hybrid", city: "Lyon", skills: [] };

const makeCompany = async () => {
  const ownerId = await createUser(t.db);
  return { ownerId, organisationId: await createOrganisation(t.db, ownerId) };
};

const makeMission = async (company: { readonly ownerId: string; readonly organisationId: string }, input: Partial<MissionInput>, status: "draft" | "open" | "closed" = "open", publishedAt = new Date()) => {
  const created = await missions(t.db).create({ userId: company.ownerId }, company.organisationId, { ...BASE_MISSION, ...input });
  if (created === null) throw new Error("mission non créée");
  if (status !== "draft") await missions(t.db).publish({ userId: company.ownerId }, created.id, publishedAt);
  if (status === "closed") await missions(t.db).close({ userId: company.ownerId }, created.id, new Date());
  return created.id;
};

const minutesAgo = (n: number): Date => new Date(Date.now() - n * 60_000);

describe("Missions pour vous", () => {
  it("propose les missions ouvertes qui partagent une compétence, avec leurs raisons, dans l'ordre affiché", async () => {
    const me = await makeProfile({ skills: ["Kotlin-A", "Ktor-A"], dailyRateCents: 60_000 });
    const company = await makeCompany();
    await t.db.organisation.update({ where: { id: company.organisationId }, data: { registryStatus: "active" } });
    const best = await makeMission(company, { title: "Développeur back-end Kotlin", skills: ["Kotlin-A", "Ktor-A"], dailyRateMaxCents: 70_000 }, "open", minutesAgo(30));
    const remote = await makeMission(company, { title: "Mission data", skills: ["Kotlin-A"], workMode: "remote", city: null, dailyRateMaxCents: 50_000 }, "open", minutesAgo(10));
    const paris = await makeMission(company, { title: "Mission Paris", skills: ["Kotlin-A"], workMode: "onsite", city: "Paris" }, "open", minutesAgo(5));
    await makeMission(company, { skills: ["Rust-A"] });
    await makeMission(company, { skills: ["Kotlin-A"] }, "draft");
    await makeMission(company, { skills: ["Kotlin-A"] }, "closed");
    const hidden = await makeMission(company, { skills: ["Kotlin-A"] });
    await t.db.jobPost.update({ where: { id: hidden }, data: { moderatedAt: new Date(), moderationReason: "Test" } });
    const applied = await makeMission(company, { skills: ["Kotlin-A"] });
    await t.db.application.create({ data: { jobPostId: applied, profileId: me.id, coverNote: "Bonjour" } });

    const result = await matching(t.db).missionsForProfile({ userId: me.userId });
    expect(result?.items.map((s) => s.item.id)).toEqual([best, paris, remote]);
    expect(result?.considered).toBe(3);
    expect(result?.capped).toBe(false);
    expect(result?.items[0]?.matched).toEqual([
      { kind: "skills", shared: ["Kotlin-A", "Ktor-A"] },
      { kind: "job_title", families: ["developpeur-back-end"] },
      { kind: "city", city: "Lyon" },
      { kind: "work_mode", mode: "hybrid" },
      { kind: "rate" },
      { kind: "company_registry" },
    ]);
    expect(result?.items[1]?.missing).toEqual(["job_title", "city"]);
    expect(result?.items[2]?.missing).toEqual(["job_title", "rate"]);
  });

  it("les critères exigés écartent ; les critères comptés ordonnent ; rien sans profil", async () => {
    const me = await makeProfile({ skills: ["Kotlin-B"], dailyRateCents: 60_000 });
    const company = await makeCompany();
    const cheap = await makeMission(company, { skills: ["Kotlin-B"], workMode: "onsite", city: "Paris", dailyRateMaxCents: 40_000 }, "open", minutesAgo(1));
    const lyon = await makeMission(company, { title: "Autre", skills: ["Kotlin-B"], dailyRateMaxCents: 40_000 }, "open", minutesAgo(20));
    const fits = await makeMission(company, { title: "Autre", skills: ["Kotlin-B"], workMode: "remote", city: null, dailyRateMaxCents: 90_000 }, "open", minutesAgo(30));

    const m = matching(t.db);
    expect((await m.missionsForProfile({ userId: me.userId }, { required: ["rate"] }))?.items.map((s) => s.item.id)).toEqual([fits]);
    expect((await m.missionsForProfile({ userId: me.userId }, { required: ["city"] }))?.items.map((s) => s.item.id)).toEqual([lyon, fits]);
    expect((await m.missionsForProfile({ userId: me.userId }, { counted: ["city"] }))?.items.map((s) => s.item.id)).toEqual([lyon, cheap, fits]);
    expect(await m.missionsForProfile({ userId: await createUser(t.db) })).toBeNull();
  });
});

describe("Missions proches", () => {
  it("les missions ouvertes proches d'une mission publique, sans elle-même ; rien pour une mission fermée", async () => {
    const company = await makeCompany();
    const source = await makeMission(company, { skills: ["Elm-C", "Haskell-C"] });
    const near = await makeMission(company, { skills: ["Elm-C", "Haskell-C"] }, "open", minutesAgo(5));
    const far = await makeMission(company, { skills: ["Elm-C"], workMode: "onsite", city: "Brest" }, "open", minutesAgo(1));
    const closed = await makeMission(company, { skills: ["Elm-C"] }, "closed");

    const result = await matching(t.db).similarMissions(source);
    expect(result?.items.map((s) => s.item.id)).toEqual([near, far]);
    expect(result?.items[0]?.matched[0]).toEqual({ kind: "skills", shared: ["Elm-C", "Haskell-C"] });
    expect(await matching(t.db).similarMissions(closed)).toBeNull();
    expect(await matching(t.db).similarMissions("pas-un-id")).toBeNull();
  });
});

describe("Profils qui correspondent", () => {
  it("pour les membres de l'entreprise seulement, avec les faits vérifiés et sans nom pour un pseudonyme", async () => {
    const company = await makeCompany();
    const mission = await makeMission(company, { skills: ["Clojure-D", "Datomic-D"], dailyRateMaxCents: 70_000 });
    const named = await makeProfile({ skills: ["Clojure-D", "Datomic-D"], dailyRateCents: 65_000 }, "named");
    const pseudo = await makeProfile({ skills: ["Clojure-D"], workMode: "remote", city: "Lille", availability: "unavailable" });
    await t.db.ownedUrl.create({ data: { profileId: named.id, url: "https://named.example/", urlKey: "https://named.example", proofMethod: "meta_tag", verifiedAt: new Date() } });
    await verifiedVigilance(t.db, named.id);
    await t.db.billingIdentity.create({ data: { profileId: named.id, legalName: "Named EI", siret: nextSiret("123456789"), address: {}, registryStatus: "active" } });
    await makeProfile({ skills: ["Clojure-D"] }, "private");
    const hidden = await makeProfile({ skills: ["Clojure-D"] });
    await t.db.freelanceProfile.update({ where: { id: hidden.id }, data: { moderatedAt: new Date(), moderationReason: "Test" } });
    const suspended = await makeProfile({ skills: ["Clojure-D"] });
    await t.db.user.update({ where: { id: suspended.userId }, data: { suspendedAt: new Date(), suspensionReason: "Test" } });
    const applicant = await makeProfile({ skills: ["Clojure-D"] });
    await t.db.application.create({ data: { jobPostId: mission, profileId: applicant.id, coverNote: "Bonjour" } });
    const colleague = await makeProfile({ skills: ["Clojure-D"] });
    await t.db.membership.create({ data: { organisationId: company.organisationId, userId: colleague.userId } });
    await t.db.missionInvitation.create({ data: { jobPostId: mission, profileId: pseudo.id, invitedByUserId: company.ownerId } });

    const result = await matching(t.db).profilesForMission({ userId: company.ownerId }, mission);
    expect(result?.items.map((s) => s.item.id)).toEqual([named.id, pseudo.id]);
    const [first, second] = result?.items ?? [];
    expect(first?.item.displayName).toMatch(/^User \d+$/);
    expect(first?.item.invited).toBe(false);
    expect(first?.matched.map((r) => r.kind)).toEqual(["skills", "job_title", "city", "work_mode", "rate", "availability", "proven_address", "registry_active", "vigilance_valid"]);
    expect(first?.missing).toEqual(["verified_missions"]);
    expect(second?.item).not.toHaveProperty("displayName");
    expect(second?.item.reference).toBe(pseudo.reference);
    expect(second?.item.invited).toBe(true);
    expect(second?.missing).toEqual(expect.arrayContaining(["city", "availability"]));

    const stranger = await makeCompany();
    expect(await matching(t.db).profilesForMission({ userId: stranger.ownerId }, mission)).toBeNull();
    expect(await matching(t.db).profilesForMission({ userId: named.userId }, mission)).toBeNull();
    expect(await matching(t.db).profilesForMission({ userId: company.ownerId }, "pas-un-id")).toBeNull();
  });

  it("aucun champ de score, de pourcentage ni de rang dans ce qui sort", async () => {
    const company = await makeCompany();
    const mission = await makeMission(company, { skills: ["Zig-E"] });
    const p = await makeProfile({ skills: ["Zig-E"] });
    const out = JSON.stringify([
      await matching(t.db).profilesForMission({ userId: company.ownerId }, mission),
      await matching(t.db).missionsForProfile({ userId: p.userId }),
      await matching(t.db).similarProfiles(p.slug),
    ]);
    expect(out).toContain("Zig-E");
    expect(out).not.toMatch(/score|percent|rank|rating|compat|weight|email|userId/i);
  });
});

describe("Profils proches", () => {
  it("les profils publiés proches d'un profil public, avec les langues en commun ; rien pour un profil privé", async () => {
    const source = await makeProfile({ skills: ["Nim-F", "Crystal-F"], dailyRateCents: 60_000 });
    await t.db.profileLanguage.createMany({ data: [{ profileId: source.id, code: "fr", level: "native" }, { profileId: source.id, code: "de", level: "b2" }] });
    const close = await makeProfile({ skills: ["Nim-F", "Crystal-F"], dailyRateCents: 66_000 });
    await t.db.profileLanguage.create({ data: { profileId: close.id, code: "de", level: "c1" } });
    const other = await makeProfile({ skills: ["Nim-F"], workMode: "onsite", city: "Brest" });
    const priv = await makeProfile({ skills: ["Nim-F"] }, "private");

    const result = await matching(t.db).similarProfiles(source.slug);
    expect(result?.items.map((s) => s.item.id)).toEqual([close.id, other.id]);
    expect(result?.items[0]?.matched).toContainEqual({ kind: "languages", codes: ["de"] });
    expect(result?.items[0]?.matched).toContainEqual({ kind: "rate" });
    expect(await matching(t.db).similarProfiles(priv.slug === "" ? "inconnu" : priv.slug)).toBeNull();
    expect(await matching(t.db).similarProfiles("inconnu")).toBeNull();
  });
});
