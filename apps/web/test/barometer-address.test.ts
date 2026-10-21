import { describe, expect, it } from "vitest";
import config from "../next.config";

/*
 * The natural address of the barometer (/fr/barometre, /en/barometre) answered 404 (AUDIT §3.6, measured 2026-10-21).
 * It now leads, for good, to the day-rate barometer, which links to the skills one. The two pages keep their addresses.
 */

describe("the barometer address", () => {
  it("redirects /[lang]/barometre to the day-rate barometer, permanently, in both languages only", async () => {
    const rules = (await config.redirects?.()) ?? [];
    expect(rules).toContainEqual({ source: "/:lang(fr|en)/barometre", destination: "/:lang/barometre/tjm", permanent: true });
    // The root still goes to French, temporarily.
    expect(rules).toContainEqual({ source: "/", destination: "/fr", permanent: false });
  });
});
