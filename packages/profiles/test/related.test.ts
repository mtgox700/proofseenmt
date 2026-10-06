import { describe, expect, it } from "vitest";
import { PublicProfileSchema, type PublicProfile } from "../src/identity";
import { RELATED_LIMIT, relatedProfiles } from "../src/related";
import { buildProfilesSite } from "../src/site";

const profile = (id: string, overrides: Record<string, unknown> = {}): PublicProfile =>
  PublicProfileSchema.parse({
    id,
    handle: `Profil.${id.slice(-1)}`,
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills: ["TypeScript", "Node.js", "PostgreSQL"],
    sectors: ["SaaS B2B"],
    availability: { status: "available", updatedAt: "2026-09-21" },
    rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
    verifiedMissions: 2,
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
    ...overrides,
  });

const ids = (list: readonly PublicProfile[]): string[] => list.map((p) => p.id);

describe("profile → profile linking", () => {
  const five = ["FR-AAAAA", "FR-BBBBB", "FR-CCCCC", "FR-DDDDD", "FR-EEEEE"].map((id) => profile(id));

  it("hands over to the profiles that follow it, wrapping around", () => {
    expect(ids(relatedProfiles(five[0]!, five))).toEqual(["FR-BBBBB", "FR-CCCCC", "FR-DDDDD"]);
    expect(ids(relatedProfiles(five[4]!, five))).toEqual(["FR-AAAAA", "FR-BBBBB", "FR-CCCCC"]);
  });

  it("leaves no profile orphaned: every one of them is linked at least once", () => {
    const linked = new Set(five.flatMap((p) => ids(relatedProfiles(p, five))));
    expect([...linked].sort()).toEqual(ids(five).sort());
  });

  it("never links a profile to itself and caps the number of links", () => {
    for (const p of five) {
      const related = relatedProfiles(p, five);
      expect(ids(related)).not.toContain(p.id);
      expect(related.length).toBeLessThanOrEqual(RELATED_LIMIT);
    }
  });

  it("keeps the same links whatever the input order: the rule is the identifier, nothing else", () => {
    const shuffled = [five[3]!, five[0]!, five[4]!, five[2]!, five[1]!];
    expect(ids(relatedProfiles(five[0]!, shuffled))).toEqual(ids(relatedProfiles(five[0]!, five)));
  });

  it("does not link across areas or across unrelated skills", () => {
    const elsewhere = profile("FR-FFFFF", { area: "Lyon / Auvergne-Rhône-Alpes" });
    const otherTrade = profile("FR-GGGGG", { skills: ["Figma", "Illustrator", "Design system"] });
    const pool = [...five, elsewhere, otherTrade];
    const related = ids(relatedProfiles(five[0]!, pool));
    expect(related).not.toContain("FR-FFFFF");
    expect(related).not.toContain("FR-GGGGG");
  });

  it("returns nothing when a profile is alone in its group", () => {
    expect(relatedProfiles(five[0]!, [five[0]!])).toEqual([]);
    expect(relatedProfiles(profile("FR-HHHHH"), five)).toEqual([]);
  });

  it("links two profiles to each other when they are the only two", () => {
    const pair = [five[0]!, five[1]!];
    expect(ids(relatedProfiles(pair[0]!, pair))).toEqual(["FR-BBBBB"]);
    expect(ids(relatedProfiles(pair[1]!, pair))).toEqual(["FR-AAAAA"]);
  });
});

describe("profile → profile linking, on the built site", () => {
  const thin = (id: string): PublicProfile =>
    PublicProfileSchema.parse({
      ...profile(id),
      skills: ["TypeScript"],
      summary: { fr: "Trop court.", en: "Too short." },
    });

  const pageOf = (files: readonly { path: string; content: string }[], id: string): string =>
    files.find((f) => f.path === `p/${id}/index.html`)?.content ?? "";

  it("prints the links and the rule that produced them", () => {
    const files = buildProfilesSite([profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")], { baseUrl: "https://proofseen.example" });
    const page = pageOf(files, "FR-AAAAA");
    expect(page).toContain("Profils proches");
    expect(page).toContain('href="/p/FR-BBBBB/"');
    expect(page).toMatch(/ordre des identifiants/);
    expect(page).toMatch(/[Aa]ucun classement/);
  });

  it("never sends a visitor or a crawler to a noindex page", () => {
    const files = buildProfilesSite([profile("FR-AAAAA"), profile("FR-BBBBB"), thin("FR-CCCCC")], { baseUrl: "https://proofseen.example" });
    expect(pageOf(files, "FR-AAAAA")).not.toContain('href="/p/FR-CCCCC/"');
    expect(pageOf(files, "FR-CCCCC")).toContain('name="robots" content="noindex"');
  });

  it("gives the English pages their own links", () => {
    const files = buildProfilesSite([profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")], { baseUrl: "https://proofseen.example" });
    const english = files.find((f) => f.path === "en/p/FR-AAAAA/index.html")?.content ?? "";
    expect(english).toContain("Related profiles");
    expect(english).toContain('href="/en/p/FR-BBBBB/"');
  });
});
