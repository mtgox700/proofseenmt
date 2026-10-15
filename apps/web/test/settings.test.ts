import { describe, expect, it } from "vitest";
import type { FreelanceDashboard } from "@proofseen/db";
import { insightsEn } from "../src/i18n/market/insights-en";
import { insightsFr } from "../src/i18n/market/insights-fr";
import { settingsEn } from "../src/i18n/market/settings-en";
import { settingsFr } from "../src/i18n/market/settings-fr";
import { applicationsInProgress, arrivalSteps, freelanceStage } from "../src/lib/freelance-stage";
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

const board = (over: Partial<FreelanceDashboard> = {}): FreelanceDashboard => ({
  profile: { published: true, missing: [], verifiedUrls: 1, verifiedMissions: 0 },
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
    expect(freelanceStage(board({ profile: { published: false, missing: ["summary"], verifiedUrls: 0, verifiedMissions: 0 } }))).toBe("arrival");
    expect(freelanceStage(board({ applications: { submitted: 2 } }))).toBe("applying");
    expect(freelanceStage(board({ contracts: { pending_signatures: 1 } }))).toBe("mission");
    expect(freelanceStage(board({ contracts: { completed: 3 } }))).toBe("applying");
  });

  it("lists the arrival steps in order, each done or to do", () => {
    expect(arrivalSteps(board({ profile: null })).map((s) => [s.key, s.done])).toEqual([
      ["create", false],
      ["complete", false],
      ["publish", false],
      ["prove", false],
    ]);
    expect(arrivalSteps(board({ profile: { published: false, missing: [], verifiedUrls: 0, verifiedMissions: 0 } })).map((s) => s.done)).toEqual([true, true, false, false]);
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
