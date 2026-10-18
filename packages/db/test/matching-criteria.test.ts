import { describe, expect, it } from "vitest";
import {
  explainMissionForProfile,
  explainProfileForMission,
  explainSimilarMission,
  explainSimilarProfile,
  MATCH_FRESH_DAYS,
  orderExplained,
  workModesCompatible,
  type MatchMission,
  type MatchProfile,
} from "../src/matching-criteria";
import { AVAILABILITY_FRESH_DAYS } from "../src/profile-search";

/*
 * Les critères du rapprochement, un par un, sur des faits écrits à la main : chaque raison est vérifiable, chaque
 * critère sans objet disparaît, et l'ordre suit la règle affichée.
 */

const NOW = new Date("2026-10-18T10:00:00Z");
const DAY = 86_400_000;
const skill = (label: string) => ({ key: label.toLowerCase(), label });

const mission = (over: Partial<MatchMission> = {}): MatchMission => ({
  id: "m1",
  skills: [skill("Kotlin"), skill("Ktor")],
  families: ["developpeur-back-end"],
  city: "Lyon",
  cityKey: "lyon",
  workMode: "hybrid",
  rateMin: 50_000,
  rateMax: 70_000,
  companyRegistryActive: true,
  publishedAt: NOW,
  ...over,
});

const profile = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  id: "p1",
  skills: [skill("Kotlin"), skill("Ktor"), skill("Docker")],
  families: ["developpeur-back-end"],
  city: "Lyon",
  cityKey: "lyon",
  workMode: "hybrid",
  rate: 60_000,
  availability: "available",
  availableFrom: null,
  availabilityAt: NOW,
  languages: ["en", "fr"],
  provenUrls: 1,
  verifiedMissions: 2,
  registryActive: true,
  vigilanceValid: false,
  updatedAt: NOW,
  ...over,
});

describe("critères d'une mission pour un profil", () => {
  it("dit chaque critère rempli avec son fait", () => {
    const e = explainMissionForProfile(profile(), mission());
    expect(e.matched).toEqual([
      { kind: "skills", shared: ["Kotlin", "Ktor"] },
      { kind: "job_title", families: ["developpeur-back-end"] },
      { kind: "city", city: "Lyon" },
      { kind: "work_mode", mode: "hybrid" },
      { kind: "rate" },
      { kind: "company_registry" },
    ]);
    expect(e.missing).toEqual([]);
  });

  it("une mission en télétravail n'a pas de critère de ville ; un TJM au-dessus du budget manque", () => {
    const e = explainMissionForProfile(profile({ rate: 80_000 }), mission({ workMode: "remote", city: null, cityKey: null, companyRegistryActive: false }));
    expect(e.matched.map((r) => r.kind)).not.toContain("city");
    expect(e.missing).toEqual(["rate", "company_registry"]);
  });

  it("un profil sans TJM ou une mission sans budget : le critère est sans objet", () => {
    expect(explainMissionForProfile(profile({ rate: null }), mission()).matched.map((r) => r.kind)).not.toContain("rate");
    const e = explainMissionForProfile(profile(), mission({ rateMin: null, rateMax: null }));
    expect([...e.matched.map((r) => r.kind), ...e.missing]).not.toContain("rate");
  });

  it("un seul montant donné sert de plafond", () => {
    expect(explainMissionForProfile(profile({ rate: 60_000 }), mission({ rateMin: 60_000, rateMax: null })).missing).not.toContain("rate");
    expect(explainMissionForProfile(profile({ rate: 61_000 }), mission({ rateMin: 60_000, rateMax: null })).missing).toContain("rate");
  });
});

describe("modes de travail", () => {
  it("seul le couple sur site / télétravail est incompatible", () => {
    expect(workModesCompatible("onsite", "remote")).toBe(false);
    expect(workModesCompatible("remote", "onsite")).toBe(false);
    for (const [a, b] of [["remote", "hybrid"], ["hybrid", "onsite"], ["remote", "remote"], ["onsite", "onsite"]] as const) {
      expect(workModesCompatible(a, b)).toBe(true);
    }
  });
});

describe("critères d'un profil pour une mission", () => {
  it("ajoute la disponibilité et les faits vérifiés du profil", () => {
    const e = explainProfileForMission(mission(), profile(), NOW);
    expect(e.matched.map((r) => r.kind)).toEqual(["skills", "job_title", "city", "work_mode", "rate", "availability", "proven_address", "verified_missions", "registry_active"]);
    expect(e.matched).toContainEqual({ kind: "verified_missions", count: 2 });
    expect(e.missing).toEqual(["vigilance_valid"]);
  });

  it("disponibilité : maintenant, dans les 30 jours, trop tard, ou déclarée il y a trop longtemps", () => {
    const soon = new Date(NOW.getTime() + 10 * DAY);
    expect(explainProfileForMission(mission(), profile({ availability: "available_from", availableFrom: soon }), NOW).matched).toContainEqual({ kind: "availability", from: soon });
    const late = profile({ availability: "available_from", availableFrom: new Date(NOW.getTime() + 45 * DAY) });
    expect(explainProfileForMission(mission(), late, NOW).missing).toContain("availability");
    const stale = profile({ availabilityAt: new Date(NOW.getTime() - 31 * DAY) });
    expect(explainProfileForMission(mission(), stale, NOW).missing).toContain("availability");
    expect(explainProfileForMission(mission(), profile({ availability: "unavailable" }), NOW).missing).toContain("availability");
  });

  it("la fraîcheur de la disponibilité est celle de la recherche", () => {
    expect(MATCH_FRESH_DAYS).toBe(AVAILABILITY_FRESH_DAYS);
  });

  it("une ville différente manque ; aucune compétence commune manque", () => {
    const e = explainProfileForMission(mission(), profile({ city: "Nantes", cityKey: "nantes", skills: [skill("Rust")] }), NOW);
    expect(e.missing).toEqual(expect.arrayContaining(["skills", "city"]));
  });
});

describe("missions proches et profils proches", () => {
  it("deux fourchettes de TJM qui se recouvrent", () => {
    expect(explainSimilarMission(mission(), mission({ id: "m2", rateMin: 65_000, rateMax: 90_000 })).matched).toContainEqual({ kind: "rate" });
    expect(explainSimilarMission(mission(), mission({ id: "m2", rateMin: 75_000, rateMax: 90_000 })).missing).toContain("rate");
  });

  it("deux TJM proches à 20 % près, et les langues en commun", () => {
    const e = explainSimilarProfile(profile(), profile({ id: "p2", rate: 70_000, languages: ["fr", "es"] }));
    expect(e.matched).toContainEqual({ kind: "rate" });
    expect(e.matched).toContainEqual({ kind: "languages", codes: ["fr"] });
    expect(explainSimilarProfile(profile(), profile({ id: "p2", rate: 80_000 })).missing).toContain("rate");
  });

  it("les preuves ne rapprochent pas deux profils : elles restent sur chaque page", () => {
    const kinds = explainSimilarProfile(profile(), profile({ id: "p2" })).matched.map((r) => r.kind);
    expect(kinds).not.toContain("proven_address");
    expect(kinds).not.toContain("vigilance_valid");
  });
});

describe("règle d'ordre", () => {
  const item = (id: string, kinds: readonly ("city" | "rate" | "work_mode")[], shared: number, daysAgo: number) => ({
    id,
    date: new Date(NOW.getTime() - daysAgo * DAY),
    matched: [{ kind: "skills" as const, shared: Array.from({ length: shared }, (_, i) => `S${i}`) }, ...kinds.map((kind) => (kind === "city" ? { kind, city: "Lyon" } : kind === "work_mode" ? { kind, mode: "remote" as const } : { kind }))],
    missing: (["city", "rate", "work_mode"] as const).filter((k) => !kinds.includes(k)),
  });

  it("critères remplis, puis compétences en commun, puis le plus récent, puis l'identifiant", () => {
    const items = [item("a", ["city"], 1, 0), item("b", ["city", "rate"], 1, 5), item("c", ["city"], 3, 9), item("d", ["city"], 1, 2), item("e", ["city"], 1, 2)];
    expect(orderExplained(items).map((i) => i.id)).toEqual(["b", "c", "a", "e", "d"]);
  });

  it("seuls les critères comptés par la personne ordonnent ; un critère exigé écarte", () => {
    const items = [item("a", ["city"], 1, 0), item("b", ["rate"], 1, 5)];
    expect(orderExplained(items, { counted: ["rate"] }).map((i) => i.id)).toEqual(["b", "a"]);
    expect(orderExplained(items, { required: ["city"] }).map((i) => i.id)).toEqual(["a"]);
  });

  it("un critère exigé mais sans objet ne fait pas sortir la proposition", () => {
    const noCity = { ...item("a", [], 1, 0), missing: ["rate" as const] };
    expect(orderExplained([noCity], { required: ["city"] }).map((i) => i.id)).toEqual(["a"]);
  });

  it("borne le nombre de propositions", () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`x${i}`, [], 1, i));
    expect(orderExplained(items)).toHaveLength(12);
    expect(orderExplained(items, { limit: 3 })).toHaveLength(3);
    expect(() => orderExplained(items, { limit: 500 })).toThrow();
  });
});
