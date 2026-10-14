import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profiles, type ProfileInput } from "../src/profiles";
import { createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, verifiedVigilance, type TestDatabase } from "./support/database";

/*
 * Recherche de freelances côté entreprise : chaque filtre sur un fait, chaque ordre choisi, et rien d'autre que des
 * profils publiés. Une compétence propre à chaque test isole ses profils de ceux des autres tests du fichier.
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
  return `FR-S${ALPHABET[Math.floor(drawn / 31) % 31]}${ALPHABET[drawn % 31]}RQ`;
};

const BASE: ProfileInput = { headline: "Développeur", summary: "Résumé du profil.", city: "Nantes", workMode: "remote", skills: [] };

const make = async (input: Partial<ProfileInput>, visibility: "named" | "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create({ userId }, { ...BASE, ...input }, nextReference);
  if (created === null) throw new Error("profil non créé");
  if (visibility !== "private") await profiles(t.db).setVisibility({ userId }, visibility);
  return created.id;
};

const ids = async (filters: Parameters<ReturnType<typeof profiles>["search"]>[0], now?: Date): Promise<string[]> =>
  (await profiles(t.db).search(filters, now)).items.map((p) => p.id);

describe("recherche de freelances : seulement des profils publiés", () => {
  it("écarte les profils privés, montre le nom d'un profil nominatif et jamais celui d'un pseudonyme", async () => {
    const named = await make({ skills: ["Elixir"] }, "named");
    const pseudo = await make({ skills: ["Elixir"] }, "pseudonymous");
    await make({ skills: ["Elixir"] }, "private");

    const { items } = await profiles(t.db).search({ skills: ["elixir"] });
    expect(items.map((p) => p.id).sort()).toEqual([named, pseudo].sort());
    expect(items.find((p) => p.id === named)?.displayName).toMatch(/^User \d+$/);
    expect(items.find((p) => p.id === pseudo)).not.toHaveProperty("displayName");
    expect(JSON.stringify(items)).not.toMatch(/score|rank|rating|email|userId/i);
  });
});

describe("recherche de freelances : filtres", () => {
  it("filtre par TJM minimum et maximum ; un profil sans TJM sort dès qu'une borne est posée", async () => {
    const low = await make({ skills: ["Haskell"], dailyRateCents: 40_000 });
    const mid = await make({ skills: ["Haskell"], dailyRateCents: 60_000 });
    const high = await make({ skills: ["Haskell"], dailyRateCents: 90_000 });
    const none = await make({ skills: ["Haskell"], dailyRateCents: null });

    expect((await ids({ skills: ["haskell"] })).sort()).toEqual([low, mid, high, none].sort());
    expect((await ids({ skills: ["haskell"], minDailyRateCents: 50_000 })).sort()).toEqual([mid, high].sort());
    expect(await ids({ skills: ["haskell"], minDailyRateCents: 50_000, maxDailyRateCents: 70_000 })).toEqual([mid]);
    expect(await ids({ skills: ["haskell"], maxDailyRateCents: 45_000 })).toEqual([low]);
  });

  it("filtre par mode de travail et par ville, sans casse ni accents", async () => {
    const remote = await make({ skills: ["Scala"], workMode: "remote", city: "Saint-Étienne" });
    const onsite = await make({ skills: ["Scala"], workMode: "onsite", city: "Lille" });
    expect(await ids({ skills: ["scala"], workModes: ["onsite"] })).toEqual([onsite]);
    expect(await ids({ skills: ["scala"], city: "saint etienne" })).toEqual([remote]);
    expect((await ids({ skills: ["scala"], workModes: ["onsite", "remote"] })).sort()).toEqual([remote, onsite].sort());
  });

  it("filtre par date de disponibilité : tout de suite, ou à partir d'une date antérieure", async () => {
    const now = await make({ skills: ["Erlang"], availability: "available" });
    const soon = await make({ skills: ["Erlang"], availability: "available_from", availableFrom: new Date("2026-11-01") });
    const later = await make({ skills: ["Erlang"], availability: "available_from", availableFrom: new Date("2027-03-01") });
    const never = await make({ skills: ["Erlang"], availability: "unavailable" });

    expect((await ids({ skills: ["erlang"], availableBy: new Date("2026-12-01") })).sort()).toEqual([now, soon].sort());
    expect((await ids({ skills: ["erlang"], availableOnly: true })).sort()).toEqual([now, soon, later].sort());
    expect(await ids({ skills: ["erlang"] })).toContain(never);
  });

  it("filtre sur les faits vérifiés : adresse prouvée, SIRET actif, attestation URSSAF en cours", async () => {
    const proven = await make({ skills: ["Zig"] });
    const registered = await make({ skills: ["Zig"] });
    const vigilant = await make({ skills: ["Zig"] });
    const expired = await make({ skills: ["Zig"] });
    await t.db.ownedUrl.create({ data: { profileId: proven, url: "https://zig.example.dev", urlKey: "https://zig.example.dev", proofMethod: "dns_txt", verifiedAt: new Date() } });
    await t.db.billingIdentity.create({
      data: { profileId: registered, legalName: "Zig EI", siret: nextSiret("552100554"), address: { line1: "1 rue", postalCode: "44000", city: "Nantes", country: "FR" }, registryStatus: "active", registryCheckedAt: new Date() },
    });
    await verifiedVigilance(t.db, vigilant);
    await t.db.vigilanceAttestation.create({ data: { profileId: expired, issuedOn: new Date("2025-01-01"), securityCode: "OLDCODE01", verifiedAt: new Date("2025-01-02") } });

    expect(await ids({ skills: ["zig"], provenOnly: true })).toEqual([proven]);
    expect(await ids({ skills: ["zig"], registryActiveOnly: true })).toEqual([registered]);
    expect(await ids({ skills: ["zig"], vigilanceValidOnly: true })).toEqual([vigilant]);

    const { items } = await profiles(t.db).search({ skills: ["zig"] });
    expect(items.find((p) => p.id === registered)?.registryActive).toBe(true);
    expect(items.find((p) => p.id === vigilant)?.vigilanceValid).toBe(true);
    expect(items.find((p) => p.id === expired)?.vigilanceValid).toBe(false);
    expect(items.find((p) => p.id === proven)?.verifiedUrls).toBe(1);
  });
});

describe("recherche de freelances : l'ordre est un critère choisi, jamais un score", () => {
  it("trie par TJM croissant et décroissant, les profils sans TJM en dernier", async () => {
    const a = await make({ skills: ["Ada"], dailyRateCents: 70_000 });
    const b = await make({ skills: ["Ada"], dailyRateCents: 50_000 });
    const c = await make({ skills: ["Ada"], dailyRateCents: null });
    expect(await ids({ skills: ["ada"], sort: "rate_asc" })).toEqual([b, a, c]);
    expect(await ids({ skills: ["ada"], sort: "rate_desc" })).toEqual([a, b, c]);
  });

  it("trie par disponibilité : disponibles, puis la date la plus proche, puis indisponibles", async () => {
    const never = await make({ skills: ["Prolog"], availability: "unavailable" });
    const later = await make({ skills: ["Prolog"], availability: "available_from", availableFrom: new Date("2027-05-01") });
    const now = await make({ skills: ["Prolog"], availability: "available" });
    const soon = await make({ skills: ["Prolog"], availability: "available_from", availableFrom: new Date("2026-12-01") });
    expect(await ids({ skills: ["prolog"], sort: "availability" })).toEqual([now, soon, later, never]);
  });

  it("trie par mise à jour du profil, la plus récente d'abord", async () => {
    const first = await make({ skills: ["Lisp"] });
    const second = await make({ skills: ["Lisp"] });
    await t.db.freelanceProfile.update({ where: { id: first }, data: { updatedAt: new Date(Date.now() + 60_000) } });
    expect(await ids({ skills: ["lisp"], sort: "recent" })).toEqual([first, second]);
  });

  it("pagine et refuse un tri inconnu", async () => {
    for (let i = 0; i < 3; i += 1) await make({ skills: ["Pascal"] });
    const page1 = await profiles(t.db).search({ skills: ["pascal"], pageSize: 2, page: 1 });
    const page2 = await profiles(t.db).search({ skills: ["pascal"], pageSize: 2, page: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page2.items).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
    await expect(profiles(t.db).search({ sort: "relevance" as never })).rejects.toThrow();
  });
});
