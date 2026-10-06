import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

let drawn = 0;
const nextReference = (): string => `FR-PP${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}ZQ`;

const published = async (visibility: "named" | "pseudonymous") => {
  const userId = await createUser(t.db);
  const profile = await profiles(t.db).create({ userId }, { headline: "Dev Rust", summary: "Embarqué.", city: "Lyon", workMode: "remote", skills: ["Rust"] }, nextReference);
  await t.db.ownedUrl.create({ data: { profileId: profile?.id ?? "", url: `https://p${drawn}.dev`, urlKey: `https://p${drawn}.dev`, proofMethod: "dns_txt", verifiedAt: new Date() } });
  const result = await profiles(t.db).setVisibility({ userId }, visibility);
  if (result.kind !== "ok" || result.profile.slug === null) throw new Error(result.kind);
  return { userId, slug: result.profile.slug };
};

describe("page publique d'un profil, depuis la base", () => {
  it("cache le nom et les adresses d'un profil pseudonyme, garde le nombre de preuves", async () => {
    const p = await published("pseudonymous");
    const page = await publicProfiles(t.db).page(p.slug);
    expect(page).toMatchObject({ visibility: "pseudonymous", displayName: null, provenUrls: [], provenUrlCount: 1, skills: ["Rust"] });
  });

  it("montre nom et adresses prouvées d'un profil nominatif", async () => {
    const p = await published("named");
    const page = await publicProfiles(t.db).page(p.slug);
    expect(page?.displayName).toMatch(/^User \d+$/);
    expect(page?.provenUrls).toHaveLength(1);
  });

  it("ne sert aucune page pour un profil privé, retiré ou inconnu", async () => {
    const p = await published("pseudonymous");
    await profiles(t.db).setVisibility({ userId: p.userId }, "private");
    expect(await publicProfiles(t.db).page(p.slug)).toBeNull();
    expect(await publicProfiles(t.db).page("inconnu-xyz")).toBeNull();
    expect(await publicProfiles(t.db).page("../../etc")).toBeNull();
    expect((await publicProfiles(t.db).listForSitemap()).map((s) => s.slug)).not.toContain(p.slug);
  });
});
