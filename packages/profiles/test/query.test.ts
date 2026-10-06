import { describe, expect, it } from "vitest";
import { PublicProfileSchema, publicApi, searchProfiles, type PublicProfile } from "../src";

const BASE = "https://proofseen.example";

const profile = (id: string, overrides: Record<string, unknown> = {}): PublicProfile =>
  PublicProfileSchema.parse({
    id,
    handle: `Profil.${id.slice(-1)}`,
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills: ["TypeScript", "Node.js", "React"],
    sectors: ["SaaS B2B"],
    availability: { status: "available", updatedAt: "2026-09-20" },
    rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
    verifiedMissions: 4,
    summary: {
      fr: "Construit des applications TypeScript en production, avec des missions vérifiées par Proofseen.",
      en: "Builds production TypeScript applications, with missions verified by Proofseen.",
    },
    ...overrides,
  });

const catalogue: PublicProfile[] = [
  profile("FR-AAAAA", { availability: { status: "available", updatedAt: "2026-09-18" } }),
  profile("FR-BBBBB", { skills: ["TypeScript", "Kafka"], area: "Lyon", rate: { min: 700, max: 800, currency: "EUR", unit: "day" }, availability: { status: "available", updatedAt: "2026-09-20" } }),
  profile("FR-CCCCC", { skills: ["Go", "Kubernetes"], availability: { status: "unavailable", updatedAt: "2026-09-19" } }),
];

describe("read-only search: deterministic, never a score", () => {
  it("filters on every skill asked, ignoring case", () => {
    const found = searchProfiles(catalogue, { skills: ["typescript", "kafka"] });
    expect(found.map((p) => p.id)).toEqual(["FR-BBBBB"]);
  });

  it("filters on area, availability and maximum day rate", () => {
    expect(searchProfiles(catalogue, { area: "lyon" }).map((p) => p.id)).toEqual(["FR-BBBBB"]);
    expect(searchProfiles(catalogue, { availableOnly: true }).map((p) => p.id).sort()).toEqual(["FR-AAAAA", "FR-BBBBB"]);
    expect(searchProfiles(catalogue, { maxRate: 660 }).map((p) => p.id).sort()).toEqual(["FR-AAAAA", "FR-CCCCC"]);
  });

  it("orders by freshness then by id — a rule anyone can check, not a hidden score", () => {
    const order = searchProfiles(catalogue, {}).map((p) => p.id);
    expect(order).toEqual(["FR-BBBBB", "FR-CCCCC", "FR-AAAAA"]);
    expect(searchProfiles(catalogue, {})).toEqual(searchProfiles(catalogue, {}));
    expect(JSON.stringify(searchProfiles(catalogue, {}))).not.toMatch(/score|ranking|relevance/i);
  });

  it("caps the number of results and says how many matched", () => {
    const page = searchProfiles(catalogue, {}, 2);
    expect(page).toHaveLength(2);
    expect(searchProfiles(catalogue, { skills: ["Rust"] })).toEqual([]);
  });

  it("returns nothing a visitor cannot already read on the page", () => {
    const [first] = searchProfiles(catalogue, {});
    expect(Object.keys(first!).sort()).toEqual(
      ["area", "availability", "handle", "headline", "id", "missions", "rate", "sectors", "seniority", "skills", "summary", "url", "verifiedMissions"].sort(),
    );
  });
});

describe("static read-only API", () => {
  const api = () => JSON.parse(publicApi(catalogue, BASE).content);

  it("publishes the profiles with their URL and the contact route", () => {
    const payload = api();
    expect(payload.profiles).toHaveLength(3);
    expect(payload.profiles[0].url).toMatch(/^https:\/\/proofseen\.example\/p\/FR-[A-Z0-9]{5}\/$/);
    expect(payload.contact).toBe(`${BASE}/contact/`);
  });

  it("states in the payload itself how results are ordered and that nothing is scored", () => {
    const payload = api();
    expect(payload.ordering).toMatch(/mise à jour|updated/i);
    expect(payload.notice).toMatch(/aucun classement automatique|no automated ranking/i);
  });

  it("is served at a stable path and carries a version", () => {
    const file = publicApi(catalogue, BASE);
    expect(file.path).toBe("api/profiles.json");
    expect(JSON.parse(file.content).version).toBe(1);
  });
});
