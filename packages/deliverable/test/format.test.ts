import { describe, expect, it } from "vitest";
import { day, pct, points } from "../src/format";

/*
 * Le rapport est un document français remis à un client : virgule décimale, espace insécable avant « % », date écrite
 * en toutes lettres. « 39.0 % » et « 2026-09-24 » y étaient des coquilles de programme, pas de la typographie.
 */
describe("format français du rapport", () => {
  it("écrit les taux avec une virgule et une espace insécable", () => {
    expect(pct(0.39)).toBe("39,0\u00a0%");
    expect(pct(0.019)).toBe("1,9\u00a0%");
    expect(pct(0)).toBe("0,0\u00a0%");
  });

  it("écrit une date de mesure en toutes lettres, sans heure", () => {
    expect(day("2026-09-24")).toBe("24 septembre 2026");
    expect(day("2026-10-01")).toBe("1er octobre 2026");
  });

  it("signe un écart en points avec un vrai signe moins", () => {
    expect(points(0.15)).toBe("+15,0\u00a0pt");
    expect(points(-0.302)).toBe("\u221230,2\u00a0pt");
    expect(points(0)).toBe("0,0\u00a0pt");
  });
});
