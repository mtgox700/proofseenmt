import { describe, expect, it } from "vitest";
import type { MatchReason, SuggestedMission, SuggestedProfile, Suggestions } from "@proofseen/db";
import { matchingEn } from "../src/i18n/market/matching-en";
import { matchingFr } from "../src/i18n/market/matching-fr";
import { FOR_YOU_CRITERIA, matchOptionsFromQuery, queryOf, reasonText, toNearbyMissions, toNearbyProfiles } from "../src/lib/matching";

/*
 * Explained matching on screen (C22): every typed reason has its words in both languages, the viewer's criteria come
 * from the page's query and nothing else, and the public lists carry similarity only, never a person's proofs.
 */

const ALL_REASONS: readonly MatchReason[] = [
  { kind: "skills", shared: ["Go", "Kafka", "Kubernetes", "PostgreSQL", "Redis"] },
  { kind: "job_title", families: ["devops-sre", "inconnue"] },
  { kind: "city", city: "Lyon" },
  { kind: "work_mode", mode: "remote" },
  { kind: "rate" },
  { kind: "availability", from: null },
  { kind: "availability", from: new Date("2026-11-02T12:00:00Z") },
  { kind: "languages", codes: ["de", "en"] },
  { kind: "proven_address" },
  { kind: "verified_missions", count: 2 },
  { kind: "registry_active" },
  { kind: "vigilance_valid" },
  { kind: "company_registry" },
];

describe("reasons in words", () => {
  it("says every reason in French and English, without a percentage or a score", () => {
    for (const [m, lang] of [[matchingFr, "fr"], [matchingEn, "en"]] as const) {
      const texts = ALL_REASONS.map((r) => reasonText(r, m, lang, "budget"));
      expect(texts.every((t) => t.length > 0)).toBe(true);
      expect(texts.join(" ")).not.toMatch(/%|score|rank|compatib/i);
    }
    expect(reasonText(ALL_REASONS[0] as MatchReason, matchingFr, "fr", "budget")).toBe("5 compétences en commun (Go, Kafka, Kubernetes, PostgreSQL et 1 autre)");
    expect(reasonText({ kind: "job_title", families: ["devops-sre", "inconnue"] }, matchingFr, "fr", "budget")).toBe("même métier (DevOps / SRE)");
    expect(reasonText({ kind: "availability", from: new Date("2026-11-02T12:00:00Z") }, matchingFr, "fr", "budget")).toBe("disponible dès le 2 novembre 2026");
    expect(reasonText({ kind: "languages", codes: ["de"] }, matchingEn, "en", "budget")).toBe("languages in common (German)");
  });

  it("words the rate after what was compared", () => {
    expect(reasonText({ kind: "rate" }, matchingFr, "fr", "budget")).toBe("TJM dans le budget");
    expect(reasonText({ kind: "rate" }, matchingFr, "fr", "overlap")).toBe("fourchettes de TJM qui se recouvrent");
    expect(reasonText({ kind: "rate" }, matchingEn, "en", "close")).toBe("close day rate (less than a fifth apart)");
  });

  it("names every criterion in both languages", () => {
    expect(Object.keys(matchingEn.criteria).sort()).toEqual(Object.keys(matchingFr.criteria).sort());
  });
});

describe("the viewer's criteria", () => {
  const options = (raw: string) => matchOptionsFromQuery(new URLSearchParams(raw), FOR_YOU_CRITERIA, 30);

  it("counts everything until the form is submitted", () => {
    expect(options("")).toEqual({ required: [], limit: 30 });
  });

  it("reads counted and required criteria, drops unknown or unoffered ones and duplicates", () => {
    expect(options("f=1&c=city&c=rate&c=rate&c=score&r=skills&r=vigilance_valid")).toEqual({ counted: ["city", "rate"], required: ["skills"], limit: 30 });
    expect(options("f=1")).toEqual({ counted: [], required: [], limit: 30 });
  });

  it("keeps repeated keys from a page's search params", () => {
    expect(queryOf({ c: ["city", "rate"], r: "skills", x: undefined }).toString()).toBe("c=city&c=rate&r=skills");
  });
});

describe("public nearby lists", () => {
  const mission: SuggestedMission = { id: "m2", title: "SRE", organisationName: "Acme", city: null, workMode: "remote", dailyRateMinCents: null, dailyRateMaxCents: null, currency: "EUR", skills: ["Go"], publishedAt: new Date() };
  const profile: SuggestedProfile = { id: "p2", reference: "FR-ABCDE", slug: "fr-abcde", headline: "SRE", city: "Lyon", workMode: "remote", dailyRateCents: null, currency: "EUR", availability: "available", availableFrom: null, skills: ["Go"], updatedAt: new Date() };
  const of = <T,>(item: T): Suggestions<T> => ({ items: [{ item, matched: ALL_REASONS, missing: [] }], considered: 1, capped: false });

  it("keep similarity reasons only, with job labels in the page's language", () => {
    const [m] = toNearbyMissions(of(mission), "en");
    expect(m?.reasons.map((r) => r.kind)).toEqual(["skills", "job_title", "city", "work_mode", "rate", "languages"]);
    expect(m?.reasons).toContainEqual({ kind: "job_title", labels: ["DevOps / SRE"] });
    expect(toNearbyMissions(null, "fr")).toEqual([]);
  });

  it("name a pseudonymous profile by its reference only", () => {
    const [p] = toNearbyProfiles(of(profile), "fr");
    expect(p).not.toHaveProperty("displayName");
    expect(p?.reference).toBe("FR-ABCDE");
    expect(toNearbyProfiles(of({ ...profile, displayName: "Jeanne Martin" }), "fr")[0]?.displayName).toBe("Jeanne Martin");
    expect(JSON.stringify(p)).not.toMatch(/proven|vigilance|registry|verified/);
  });
});
