import { describe, expect, it } from "vitest";
import type { FreelanceDashboard } from "@proofseen/db";
import { insightsEn } from "../src/i18n/market/insights-en";
import { insightsFr } from "../src/i18n/market/insights-fr";
import { settingsEn } from "../src/i18n/market/settings-en";
import { settingsFr } from "../src/i18n/market/settings-fr";
import { applicationsInProgress, ARRIVAL_STEP_KEYS, arrivalSteps, availabilityCheckDue, freelanceStage, nextArrivalStep, profileModerated, readyToPublish } from "../src/lib/freelance-stage";
import { confirmationMatches, ERASE_WORDS, eraseOutcome, pickOrganisation } from "../src/lib/settings";

describe("pickOrganisation", () => {
  const mine = [
    { id: "a", role: "member" },
    { id: "b", role: "owner" },
    { id: "c", role: "admin" },
  ];

  it("honours the chosen company while the person belongs to it", () => {
    expect(pickOrganisation(mine, "c")?.id).toBe("c");
  });

  it("ignores a choice the person no longer belongs to, and falls back to the company they own", () => {
    expect(pickOrganisation(mine, "gone")?.id).toBe("b");
    expect(pickOrganisation(mine, undefined)?.id).toBe("b");
    expect(pickOrganisation([{ id: "a", role: "member" }], "x")?.id).toBe("a");
    expect(pickOrganisation([], "a")).toBeNull();
  });
});

describe("erasure confirmation", () => {
  it("needs the exact word of the page's language, case and spaces aside", () => {
    expect(confirmationMatches(" supprimer ", "fr")).toBe(true);
    expect(confirmationMatches("SUPPRIME", "fr")).toBe(false);
    expect(confirmationMatches("DELETE", "fr")).toBe(false);
    expect(confirmationMatches("delete", "en")).toBe(true);
    expect(ERASE_WORDS).toEqual({ fr: "SUPPRIMER", en: "DELETE" });
  });

  it("reads the route's answer, including why erasure is refused", () => {
    expect(eraseOutcome({ ok: true, data: { erased: true } })).toBe("erased");
    expect(eraseOutcome({ ok: false, error: "contrat en cours" })).toBe("busy");
    expect(eraseOutcome({ ok: false, error: "trop de demandes" })).toBe("throttled");
    expect(eraseOutcome({ ok: false, error: "non-connecté" })).toBe("signed_out");
    expect(eraseOutcome({ ok: false, error: "erreur serveur" })).toBe("failed");
    expect(eraseOutcome(null)).toBe("failed");
    expect(eraseOutcome("oops")).toBe("failed");
  });

  it("explains every refusal in French and in English", () => {
    for (const dictionary of [settingsFr, settingsEn]) {
      for (const outcome of ["busy", "throttled", "signed_out", "failed"] as const) {
        expect(dictionary.erase.outcomes[outcome].length, outcome).toBeGreaterThan(20);
      }
      expect(dictionary.erase.confirmLabel("X")).toContain("X");
    }
  });
});

const NOW = new Date("2026-11-20T09:00:00Z");
const DAY_MS = 86_400_000;
const facts = { verifiedUrls: 0, verifiedMissions: 0, moderated: false, availability: "available" as const, availabilityAt: NOW };

const board = (over: Partial<FreelanceDashboard> = {}): FreelanceDashboard => ({
  profile: { ...facts, published: true, missing: [], verifiedUrls: 1 },
  applications: {},
  contracts: {},
  money: null,
  invoices: 0,
  reviews: 0,
  ...over,
});

describe("freelanceStage", () => {
  it("is arrival until the profile is published, then applying, then mission once a contract is under way", () => {
    expect(freelanceStage(board({ profile: null }))).toBe("arrival");
    expect(freelanceStage(board({ profile: { ...facts, published: false, missing: ["summary"] } }))).toBe("arrival");
    expect(freelanceStage(board({ applications: { submitted: 2 } }))).toBe("applying");
    expect(freelanceStage(board({ contracts: { pending_signatures: 1 } }))).toBe("mission");
    expect(freelanceStage(board({ contracts: { completed: 3 } }))).toBe("applying");
  });

  it("lists what is missing to publish, field by field and in order, then publishing, then a proven address", () => {
    expect(arrivalSteps(board({ profile: null })).map((s) => [s.key, s.done])).toEqual([
      ["create", false],
      ["headline", false],
      ["summary", false],
      ["city", false],
      ["publish", false],
      ["prove", false],
    ]);
    const halfway = arrivalSteps(board({ profile: { ...facts, published: false, missing: ["summary", "city"] } }));
    expect(halfway.map((s) => s.done)).toEqual([true, true, false, false, false, false]);
    expect(nextArrivalStep(halfway)).toEqual({ key: "summary", done: false, path: "profil#summary" });
    // Each step to do links to the exact field of the profile form.
    expect(halfway.map((s) => s.path)).toEqual(["profil", "profil#headline", "profil#summary", "profil#city", "profil#publication-title", "preuves"]);
    expect(nextArrivalStep(arrivalSteps(board({ profile: { ...facts, published: false, missing: [] } })))?.key).toBe("publish");
    expect(nextArrivalStep(arrivalSteps(board()))).toBeNull();
  });

  it("offers the one-click publish only once everything is filled in and the profile is still private", () => {
    expect(readyToPublish(board({ profile: null }))).toBe(false);
    expect(readyToPublish(board({ profile: { ...facts, published: false, missing: ["city"] } }))).toBe(false);
    expect(readyToPublish(board({ profile: { ...facts, published: false, missing: [] } }))).toBe(true);
    expect(readyToPublish(board())).toBe(false);
  });

  it("never offers to publish a profile hidden by an operator, and says it is hidden", () => {
    const hidden = board({ profile: { ...facts, published: false, moderated: true, missing: [] } });
    expect(readyToPublish(hidden)).toBe(false);
    expect(profileModerated(hidden)).toBe(true);
    expect(freelanceStage(hidden)).toBe("arrival");
    expect(arrivalSteps(hidden).find((s) => s.key === "publish")?.done).toBe(false);
    expect(availabilityCheckDue(board({ profile: { ...facts, published: false, moderated: true, missing: [], availabilityAt: new Date(NOW.getTime() - 40 * DAY_MS) } }), NOW)).toBe(false);
    expect(profileModerated(board())).toBe(false);
    for (const dictionary of [insightsFr, insightsEn]) expect(dictionary.stage.moderated.length).toBeGreaterThan(20);
  });

  it("asks a published freelancer to reconfirm an availability 14 days old, never a private or unavailable one", () => {
    const at = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
    expect(availabilityCheckDue(board({ profile: { ...facts, published: true, missing: [], availabilityAt: at(13) } }), NOW)).toBe(false);
    expect(availabilityCheckDue(board({ profile: { ...facts, published: true, missing: [], availabilityAt: at(14) } }), NOW)).toBe(true);
    expect(availabilityCheckDue(board({ profile: { ...facts, published: false, missing: [], availabilityAt: at(40) } }), NOW)).toBe(false);
    expect(availabilityCheckDue(board({ profile: { ...facts, published: true, missing: [], availability: "unavailable", availabilityAt: at(40) } }), NOW)).toBe(false);
  });

  it("names every guided step in both languages", () => {
    for (const dictionary of [insightsFr, insightsEn]) {
      for (const key of ARRIVAL_STEP_KEYS) expect(dictionary.stage.steps[key].length, key).toBeGreaterThan(5);
    }
  });

  it("counts applications still waiting on a company", () => {
    expect(applicationsInProgress(board({ applications: { submitted: 2, shortlisted: 1, declined: 4 } }))).toBe(3);
  });

  it("has every stage title in both languages", () => {
    for (const dictionary of [insightsFr, insightsEn]) {
      for (const stage of ["arrival", "applying", "mission"] as const) expect(dictionary.stage.titles[stage].length).toBeGreaterThan(3);
      expect(dictionary.stage.applyingLead(0)).not.toContain("0");
    }
  });
});
