import { describe, expect, it } from "vitest";
import { CatalogueSchema, contactTool, getProfileTool, searchTool, type Catalogue } from "../src/tools";

const profile = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  handle: `Profil.${id.slice(-1)}`,
  headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
  seniority: "7+ ans",
  area: "Paris / Île-de-France",
  skills: ["TypeScript", "Node.js"],
  sectors: ["SaaS B2B"],
  availability: { status: "available", from: null, updatedAt: "2026-09-20" },
  rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
  verifiedMissions: 4,
  summary: { fr: "Construit des applications TypeScript en production, missions vérifiées.", en: "Builds production TypeScript applications." },
  url: `https://proofseen.example/p/${id}/`,
  ...overrides,
});

const catalogue: Catalogue = CatalogueSchema.parse({
  version: 1,
  contact: "https://proofseen.example/contact/",
  profiles: [profile("FR-AAAAA"), profile("FR-BBBBB", { skills: ["Go"], availability: { status: "unavailable", from: null, updatedAt: "2026-09-19" } })],
});

const payload = (result: { content: { text: string }[] }) => JSON.parse(result.content[0]!.text);

describe("what an assistant gets from the connector", () => {
  it("returns pseudonymous profiles, their URL and the contact route", () => {
    const data = payload(searchTool(catalogue, { skills: ["typescript"] }));
    expect(data.matched).toBe(1);
    expect(data.profiles[0].handle).toBe("Profil.A");
    expect(data.profiles[0].url).toBe("https://proofseen.example/p/FR-AAAAA/");
    expect(data.contact).toBe("https://proofseen.example/contact/");
  });

  it("never exposes a real identity, an email or a phone number", () => {
    const text = JSON.stringify([searchTool(catalogue, {}), getProfileTool(catalogue, "FR-AAAAA"), contactTool(catalogue, "FR-AAAAA")]);
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(text).not.toMatch(/linkedin|github|\+33|realName/i);
  });

  it("states the ordering rule and never returns a score", () => {
    const data = payload(searchTool(catalogue, {}));
    expect(data.ordering).toMatch(/mise à jour/i);
    expect(JSON.stringify(data)).not.toMatch(/"score"|"ranking"|"relevance"/i);
  });

  it("answers an unknown identifier with an error instead of an empty list", () => {
    const result = getProfileTool(catalogue, "FR-ZZZZZ");
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/aucun profil/i);
  });

  it("explains that contact goes through Proofseen and identity comes after agreement", () => {
    const data = payload(contactTool(catalogue, "FR-AAAAA"));
    expect(data.contact).toBe("https://proofseen.example/contact/");
    expect(data.howItWorks.join(" ")).toMatch(/anonyme.*accepté|avant tout engagement/i);
  });

  it("honours availability and budget filters", () => {
    expect(payload(searchTool(catalogue, { availableOnly: true })).matched).toBe(1);
    expect(payload(searchTool(catalogue, { maxRate: 500 })).matched).toBe(0);
    expect(payload(searchTool(catalogue, { limit: 1 })).profiles).toHaveLength(1);
  });
});
