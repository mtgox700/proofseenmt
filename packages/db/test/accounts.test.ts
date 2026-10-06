import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missions } from "../src/missions";
import { organisations } from "../src/organisations";
import { profiles, type ProfileInput } from "../src/profiles";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

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
  return `FR-AC${ALPHABET[drawn % ALPHABET.length]}${ALPHABET[Math.floor(drawn / ALPHABET.length) % ALPHABET.length]}Q`;
};

const COMPLETE: ProfileInput = {
  headline: "Développeuse Rust",
  summary: "Systèmes embarqués et WebAssembly.",
  city: "Lyon",
  workMode: "remote",
  dailyRateCents: 65_000,
  skills: ["Rust", "WebAssembly"],
};

const emailOf = async (userId: string): Promise<string> => (await t.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })).email;

describe("entreprises et membres", () => {
  it("fait du créateur le propriétaire, et laisse les administrateurs gérer les membres", async () => {
    const owner = await createUser(t.db);
    const colleague = await createUser(t.db);
    const outsider = await createUser(t.db);
    const org = await organisations(t.db).create({ userId: owner }, { name: "Acme", kind: "pme", siret: "552 100 554 00025" });
    expect(org).toMatchObject({ role: "owner", siret: "55210055400025" });

    expect(await organisations(t.db).addMember({ userId: outsider }, org.id, await emailOf(colleague), "member")).toBe(false);
    expect(await organisations(t.db).addMember({ userId: owner }, org.id, "inconnu@x.fr", "member")).toBe(false);
    expect(await organisations(t.db).addMember({ userId: owner }, org.id, (await emailOf(colleague)).toUpperCase(), "member")).toBe(true);
    expect((await organisations(t.db).listMine({ userId: colleague })).map((o) => o.id)).toEqual([org.id]);
  });

  it("retire l'accès aux missions dès qu'un membre est retiré", async () => {
    const owner = await createUser(t.db);
    const colleague = await createUser(t.db);
    const org = await organisations(t.db).create({ userId: owner }, { name: "Acme", kind: "esn" });
    await organisations(t.db).addMember({ userId: owner }, org.id, await emailOf(colleague), "admin");
    expect(await missions(t.db).listForOrganisation({ userId: colleague }, org.id)).toEqual([]);

    expect(await organisations(t.db).removeMember({ userId: owner }, org.id, colleague)).toBe(true);
    expect(await missions(t.db).listForOrganisation({ userId: colleague }, org.id)).toBeNull();
  });

  it("garde toujours un propriétaire", async () => {
    const owner = await createUser(t.db);
    const org = await organisations(t.db).create({ userId: owner }, { name: "Solo", kind: "startup" });
    expect(await organisations(t.db).removeMember({ userId: owner }, org.id, owner)).toBe(false);
  });

  it("refuse un SIRET mal formé", async () => {
    await expect(organisations(t.db).create({ userId: await createUser(t.db) }, { name: "Acme", kind: "pme", siret: "123" })).rejects.toThrow();
  });
});

describe("profil freelance", () => {
  it("se crée privé, une seule fois, et ne se publie que complet", async () => {
    const me = await createUser(t.db);
    const draft = await profiles(t.db).create({ userId: me }, { workMode: "remote" }, nextReference);
    expect(draft).toMatchObject({ visibility: "private", slug: null });
    expect(await profiles(t.db).create({ userId: me }, COMPLETE, nextReference)).toBeNull();

    expect(await profiles(t.db).setVisibility({ userId: me }, "pseudonymous")).toEqual({ kind: "incomplete", missing: ["headline", "summary", "city"] });
    await profiles(t.db).update({ userId: me }, COMPLETE);
    const published = await profiles(t.db).setVisibility({ userId: me }, "pseudonymous");
    expect(published).toMatchObject({ kind: "ok", profile: { visibility: "pseudonymous", slug: draft?.reference.toLowerCase() } });
    expect(await profiles(t.db).findPublic(draft?.reference.toLowerCase() ?? "")).toMatchObject({ headline: "Développeuse Rust" });

    await profiles(t.db).setVisibility({ userId: me }, "private");
    expect(await profiles(t.db).findPublic(draft?.reference.toLowerCase() ?? "")).toBeNull();
  });

  it("refuse une disponibilité « à partir de » sans date", async () => {
    const me = await createUser(t.db);
    await expect(profiles(t.db).create({ userId: me }, { ...COMPLETE, availability: "available_from" }, nextReference)).rejects.toThrow(/disponibilité/);
  });
});

describe("recherche de freelances : filtres et faits, jamais un nom ni un score", () => {
  it("filtre par compétences (toutes), ville sans casse et preuve de possession", async () => {
    const make = async (input: ProfileInput, proven: boolean) => {
      const userId = await createUser(t.db);
      const profile = await profiles(t.db).create({ userId }, input, nextReference);
      await profiles(t.db).setVisibility({ userId }, "pseudonymous");
      if (proven) {
        await t.db.ownedUrl.create({ data: { profileId: profile?.id ?? "", url: `https://p${drawn}.dev`, urlKey: `https://p${drawn}.dev`, proofMethod: "dns_txt", verifiedAt: new Date() } });
      }
      return profile?.id ?? "";
    };
    const proven = await make({ ...COMPLETE, skills: ["Rust", "WebAssembly", "Kafka"] }, true);
    const unproven = await make({ ...COMPLETE, skills: ["Rust", "WebAssembly"] }, false);
    const hidden = await createUser(t.db);
    await profiles(t.db).create({ userId: hidden }, COMPLETE, nextReference);

    const both = await profiles(t.db).search({ skills: ["rust", "webassembly"], city: "LYON" });
    expect(both.items.map((p) => p.id).sort()).toEqual([proven, unproven].sort());
    expect((await profiles(t.db).search({ skills: ["Rust"], provenOnly: true })).items.map((p) => p.id)).toEqual([proven]);
    expect((await profiles(t.db).search({ skills: ["Kafka", "Rust"] })).items.map((p) => p.id)).toEqual([proven]);

    const [first] = both.items;
    expect(first).not.toHaveProperty("displayName");
    expect(first).not.toHaveProperty("email");
    expect(first).not.toHaveProperty("userId");
    expect(first?.verifiedUrls).toBeTypeOf("number");
  });
});
