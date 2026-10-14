import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profiles } from "../src/profiles";
import { DIRECTORY_PAGE_SIZE, publicProfiles } from "../src/public-profiles";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

let drawn = 0;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const nextReference = (): string => {
  drawn += 1;
  return `FR-D${ALPHABET[Math.floor(drawn / 31) % 31]}${ALPHABET[drawn % 31]}ZQ`;
};

const publish = async (input: { city: string; skills: string[]; visibility?: "named" | "pseudonymous" | "private" }) => {
  const userId = await createUser(t.db);
  await profiles(t.db).create({ userId }, { headline: `Dev ${input.skills.join(" ")}`, summary: "Résumé.", city: input.city, workMode: "remote", skills: input.skills }, nextReference);
  const visibility = input.visibility ?? "pseudonymous";
  if (visibility !== "private") await profiles(t.db).setVisibility({ userId }, visibility);
  return userId;
};

describe("annuaire public des profils", () => {
  it("ne liste que les profils publiés, du plus récemment mis à jour au plus ancien", async () => {
    await publish({ city: "Rennes", skills: ["Clojure"] });
    await publish({ city: "Rennes", skills: ["Clojure"], visibility: "private" });
    const last = await publish({ city: "Rennes", skills: ["Clojure"], visibility: "named" });

    const { items, hasMore } = await publicProfiles(t.db).directory({ skill: "clojure" });
    expect(items).toHaveLength(2);
    expect(hasMore).toBe(false);
    expect(items[0]?.updatedAt.getTime()).toBeGreaterThanOrEqual(items[1]?.updatedAt.getTime() ?? 0);
    const { reference } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { userId: last }, select: { reference: true } });
    expect(items[0]?.reference).toBe(reference);
    expect(items[0]?.displayName).toMatch(/^User \d+$/);
    expect(items[1]?.displayName).toBeNull();
  });

  it("filtre par compétence et par ville sous leur forme normalisée", async () => {
    await publish({ city: "Saint-Étienne", skills: ["OCaml"] });
    await publish({ city: "Lille", skills: ["OCaml"] });
    expect((await publicProfiles(t.db).directory({ skill: "ocaml", city: "saint etienne" })).items.map((c) => c.city)).toEqual(["Saint-Étienne"]);
    expect((await publicProfiles(t.db).directory({ skill: "OCaml", city: "" })).items).toHaveLength(2);
    expect((await publicProfiles(t.db).directory({ skill: "ocaml", city: "Brest" })).items).toEqual([]);
  });

  it("porte des faits vérifiés, jamais une note ni un rang", async () => {
    await publish({ city: "Caen", skills: ["Fortran"] });
    const [card] = (await publicProfiles(t.db).directory({ skill: "fortran" })).items;
    expect(card?.facts).toEqual({ registryActive: false, identityVerified: false, vigilanceValid: false, verifiedMissions: 0, payingClients: 0 });
    expect(JSON.stringify(card)).not.toMatch(/score|rank|rating/i);
    expect(card?.skills).toEqual(["Fortran"]);
  });

  it("pagine par pages fixes et le dit", async () => {
    for (let i = 0; i < DIRECTORY_PAGE_SIZE + 1; i += 1) await publish({ city: "Pau", skills: ["Cobol"] });
    const first = await publicProfiles(t.db).directory({ skill: "cobol", page: 1 });
    const second = await publicProfiles(t.db).directory({ skill: "cobol", page: 2 });
    expect(first.items).toHaveLength(DIRECTORY_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
  }, 120_000);

  it("refuse des filtres hors bornes", async () => {
    await expect(publicProfiles(t.db).directory({ page: 0 })).rejects.toThrow();
    await expect(publicProfiles(t.db).directory({ skill: "x".repeat(61) })).rejects.toThrow();
  });
});
