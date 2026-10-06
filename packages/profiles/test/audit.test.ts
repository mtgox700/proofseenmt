import { describe, expect, it } from "vitest";
import {
  K_MIN,
  MEANINGFUL_CATALOGUE_SIZE,
  SELF_SEARCH_MAX_AGE_DAYS,
  kAnonymity,
  publicationBlockers,
  quasiIdentifiers,
  selfSearchQueries,
  takedowns,
  type SelfSearch,
} from "../src/audit";
import { IRREVERSIBILITY_NOTICE, PrivateIdentitySchema, PublicProfileSchema, type PublicProfile } from "../src/identity";
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
    verifiedMissions: 0,
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
    ...overrides,
  });

const identity = (id: string, withdrawnAt: string | null = null) =>
  PrivateIdentitySchema.parse({
    profileId: id,
    realName: "Personne Test",
    email: "test@example.com",
    phone: null,
    links: [],
    legalId: null,
    consent: { givenAt: "2026-09-10", scope: "public_pseudonymous_profile", irreversibilityAcknowledged: true, withdrawnAt },
  });

const NOW = new Date("2026-09-21T12:00:00Z");
const passed: SelfSearch = { doneAt: "2026-09-20", outcome: "not_found", queriesRun: 5 };
const gate = (profiles: PublicProfile[], search: SelfSearch | undefined) =>
  publicationBlockers({
    profiles,
    selfSearches: new Map(profiles.map((p) => [p.id, search])),
    consentGivenAt: new Map(profiles.map((p) => [p.id, "2026-09-10"])),
    now: NOW,
  });

describe("k-anonymity on the quasi-identifiers of §6.2", () => {
  it("groups profiles that cannot be told apart on stack, area, seniority, sectors, clients and rate", () => {
    const k = kAnonymity([profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC", { seniority: "3 à 5 ans" })]);
    expect(k).toEqual([
      { id: "FR-AAAAA", k: 2 },
      { id: "FR-BBBBB", k: 2 },
      { id: "FR-CCCCC", k: 1 },
    ]);
  });

  it("reads the day rate as a 100 € band, not as an exact fingerprint", () => {
    const a = profile("FR-AAAAA", { rate: { min: 550, max: 650, currency: "EUR", unit: "day" } });
    const b = profile("FR-BBBBB", { rate: { min: 590, max: 700, currency: "EUR", unit: "day" } });
    expect(quasiIdentifiers(a)).toBe(quasiIdentifiers(b));
  });

  it("ignores the order skills are listed in", () => {
    const a = profile("FR-AAAAA", { skills: ["TypeScript", "Node.js", "PostgreSQL"] });
    const b = profile("FR-BBBBB", { skills: ["PostgreSQL", "TypeScript", "Node.js"] });
    expect(quasiIdentifiers(a)).toBe(quasiIdentifiers(b));
  });

  it("only reports k on a small catalogue, and enforces it once the catalogue is large enough", () => {
    const small = [profile("FR-AAAAA"), profile("FR-BBBBB", { seniority: "3 à 5 ans" })];
    expect(gate(small, passed)).toEqual([]);
    const large = Array.from({ length: MEANINGFUL_CATALOGUE_SIZE }, (_, i) => profile(`FR-${String(i).padStart(2, "0")}AAA`));
    const withLoner = [...large, profile("FR-ZZZZZ", { area: "Lyon / Rhône" })];
    expect(gate(withLoner, passed).join(" ")).toMatch(new RegExp(`FR-ZZZZZ : k = 1`));
    expect(K_MIN).toBe(2);
  });
});

describe("self-search, the real-world re-identification test", () => {
  it("refuses publication when the freelancer has not searched for himself", () => {
    expect(gate([profile("FR-AAAAA")], undefined).join(" ")).toMatch(/aucune auto-recherche/);
  });

  it("refuses publication when the search reached the real identity", () => {
    expect(gate([profile("FR-AAAAA")], { ...passed, outcome: "found" }).join(" ")).toMatch(/retrouvé l'identité réelle/);
  });

  it("refuses a stale search and a search made before the consent", () => {
    expect(gate([profile("FR-AAAAA")], { ...passed, doneAt: "2026-05-01" }).join(" ")).toMatch(new RegExp(`${SELF_SEARCH_MAX_AGE_DAYS} jours`));
    expect(gate([profile("FR-AAAAA")], { ...passed, doneAt: "2026-09-01" }).join(" ")).toMatch(/antérieure au consentement/);
  });

  it("builds its queries only from what the public page shows", () => {
    const queries = selfSearchQueries(profile("FR-AAAAA", { missions: [], verifiedMissions: 0 }));
    expect(queries.length).toBeGreaterThanOrEqual(4);
    expect(queries.join(" ")).toContain("TypeScript");
    expect(queries.join(" ")).toContain("Paris");
    expect(queries.join(" ")).not.toMatch(/Personne Test|test@example\.com/);
  });
});

describe("consent withdrawal (§6.3)", () => {
  it("makes an uninformed consent impossible to encode", () => {
    expect(() =>
      PrivateIdentitySchema.parse({ ...identity("FR-AAAAA"), consent: { givenAt: "2026-09-10", scope: "public_pseudonymous_profile" } }),
    ).toThrow();
    expect(IRREVERSIBILITY_NOTICE.fr).toMatch(/ne pouvons pas effacer/);
  });

  it("lists the pages to take down with a 72 h deadline", () => {
    const [down] = takedowns([identity("FR-AAAAA", "2026-09-20"), identity("FR-BBBBB")], "https://proofseen.example", NOW);
    expect(down).toEqual({
      id: "FR-AAAAA",
      withdrawnAt: "2026-09-20",
      deadline: "2026-09-23T00:00:00.000Z",
      overdue: false,
      urls: ["https://proofseen.example/p/FR-AAAAA/", "https://proofseen.example/en/p/FR-AAAAA/"],
    });
  });

  it("flags a missed deadline", () => {
    expect(takedowns([identity("FR-AAAAA", "2026-09-15")], "https://proofseen.example", NOW)[0]!.overdue).toBe(true);
  });
});

describe("breadcrumb", () => {
  const files = buildProfilesSite([profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")], { baseUrl: "https://proofseen.example" });
  const page = (path: string): string => files.find((f) => f.path === path)?.content ?? "";

  it("shows the trail on a profile and declares the same trail as structured data", () => {
    const html = page("p/FR-AAAAA/index.html");
    expect(html).toContain('<nav class="crumbs" aria-label="Fil d&#39;Ariane">');
    expect(html).toContain('<li aria-current="page">Profil.A</li>');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]!) as { "@type": string; itemListElement?: { name: string; item: string }[] }[];
    const crumbs = ld.find((block) => block["@type"] === "BreadcrumbList")!;
    expect(crumbs.itemListElement!.map((i) => i.name)).toEqual(["Proofseen", "Node.js · Paris", "Profil.A"]);
    expect(crumbs.itemListElement!.at(-1)!.item).toBe("https://proofseen.example/p/FR-AAAAA/");
    for (const step of crumbs.itemListElement!) expect(html).toContain(step.name);
  });

  it("puts a trail on entry pages but not on the home page", () => {
    expect(page("freelances/typescript-paris/index.html")).toContain('class="crumbs"');
    expect(page("index.html")).not.toContain('class="crumbs"');
  });
});
