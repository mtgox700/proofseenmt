import { describe, expect, it } from "vitest";
import type { PublicProfile } from "@proofseen/profiles";
import { parseCriteria, runSearch } from "../src/lib/directory";

const profile = (id: string, updatedAt: string, skills: string[], area = "Paris"): PublicProfile => ({
  id,
  handle: "Test.X",
  headline: { fr: "Dev", en: "Dev" },
  seniority: "3 à 5 ans",
  area,
  skills,
  sectors: [],
  availability: { status: "available", from: null, updatedAt },
  rate: null,
  verifiedMissions: 0,
  missions: [],
  summary: { fr: "Résumé", en: "Summary" },
});

const profiles = [
  profile("FR-BBBBB", "2026-09-20", ["TypeScript"]),
  profile("FR-AAAAA", "2026-09-10", ["TypeScript", "Go"], "Lyon"),
  profile("FR-CCCCC", "2026-09-28", ["Python"]),
];

describe("parseCriteria", () => {
  it("reads a GET form without trusting it", () => {
    expect(parseCriteria({ skill: " TypeScript ", area: "", available: "1", sort: "id" })).toEqual({
      skill: "TypeScript",
      area: undefined,
      availableOnly: true,
      sort: "id",
    });
  });

  it("falls back to freshness for any unknown sort, never to a score", () => {
    expect(parseCriteria({ sort: "score" }).sort).toBe("freshness");
    expect(parseCriteria({ sort: ["id", "id"] }).sort).toBe("freshness");
  });

  it("caps overlong inputs", () => {
    expect(parseCriteria({ skill: "x".repeat(500) }).skill?.length).toBe(60);
  });
});

describe("runSearch", () => {
  it("orders by freshness, then identifier, by default", () => {
    expect(runSearch(profiles, parseCriteria({})).map((p) => p.id)).toEqual(["FR-CCCCC", "FR-BBBBB", "FR-AAAAA"]);
  });

  it("orders by identifier when asked, and by nothing else", () => {
    expect(runSearch(profiles, parseCriteria({ sort: "id" })).map((p) => p.id)).toEqual(["FR-AAAAA", "FR-BBBBB", "FR-CCCCC"]);
  });

  it("filters on skill and area with the shared query layer", () => {
    expect(runSearch(profiles, parseCriteria({ skill: "typescript", area: "lyon" })).map((p) => p.id)).toEqual(["FR-AAAAA"]);
  });
});
