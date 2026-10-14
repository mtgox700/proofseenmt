import { describe, expect, it } from "vitest";
import type { MeasurementRefusal } from "@proofseen/db";
import { visibilityEn } from "../src/i18n/market/visibility-en";
import { visibilityFr } from "../src/i18n/market/visibility-fr";

/*
 * Every reason a measurement request can be refused is explained to the person, in both languages, including the
 * platform-wide guards added after the C13 security review (account too recent, queue full).
 */

const REASONS = ["no_profile", "not_published", "no_proven_url", "too_recent", "already_active", "monthly_limit", "platform_busy"] as const satisfies readonly MeasurementRefusal[];

describe("measurement refusals", () => {
  it("has a text for every refusal, in French and English", () => {
    for (const dictionary of [visibilityFr, visibilityEn]) {
      for (const reason of REASONS) {
        const text = dictionary.refusals[reason];
        const rendered = typeof text === "function" ? text("15/10/2026") : text;
        expect(rendered.length, reason).toBeGreaterThan(10);
      }
    }
  });

  it("dates the wait of a too recent account, and does not blame the person for a full queue", () => {
    expect(visibilityFr.refusals.too_recent("15/10/2026")).toContain("15/10/2026");
    expect(visibilityEn.refusals.too_recent("15/10/2026")).toContain("15/10/2026");
    expect(visibilityFr.refusals.platform_busy).toMatch(/réessayez/i);
    expect(visibilityEn.refusals.platform_busy).toMatch(/try again/i);
  });

  it("explains a measurement stopped at its maximum duration", () => {
    expect(visibilityFr.requests.codes.time_limit).toBeDefined();
    expect(visibilityEn.requests.codes.time_limit).toBeDefined();
  });
});
