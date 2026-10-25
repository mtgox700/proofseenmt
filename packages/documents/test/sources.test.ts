import { describe, expect, it } from "vitest";
import { defaultRegistry, loadRegistry } from "../src/registry";
import { EXPIRY_WARNING_DAYS, expiredSourcesOf, expiryAlerts, expiringSourcesOf } from "../src/sources";
import { EXAMPLE_ROOT } from "./support/fixtures";

const real = defaultRegistry();
const fixtures = loadRegistry(EXAMPLE_ROOT);

describe("expiryAlerts (the alarm that rings 60 days before a cited source ends)", () => {
  it("warns 60 days ahead by default", () => {
    expect(EXPIRY_WARNING_DAYS).toBe(60);
  });

  it("stays silent on 2028-04-30 and rings from 2028-05-01 for 289 and 293 B, which end on 2028-06-30", () => {
    expect(expiryAlerts(real.all(), real.sources, "2028-04-30")).toEqual([]);
    const alerts = expiryAlerts(real.all(), real.sources, "2028-05-01");
    const ids = new Set(alerts.map((a) => a.sourceId));
    expect([...ids].sort()).toEqual(["cgi-289", "cgi-293b"]);
    expect(alerts.every((a) => a.daysLeft === 60 && a.validUntil === "2028-06-30")).toBe(true);
    expect(alerts.find((a) => a.sourceId === "cgi-289")).toMatchObject({ templateId: expect.any(String), clause: expect.any(String), version: 1 });
  });

  it("keeps ringing after the end, with negative days left", () => {
    const late = expiryAlerts(real.all(), real.sources, "2028-07-15");
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((a) => a.daysLeft === -15)).toBe(true);
  });

  it("THE ALARM OF THE REPOSITORY: no source cited by a template ends within 60 days of the real date", () => {
    // Si ce test échoue, ce n'est pas un bug : une règle citée par un gabarit va cesser de s'appliquer. Écrire la
    // version suivante du gabarit (nouvelle source dans sources.yaml, nouvelle version) AVANT la date, voir
    // l'alerte pour la clause et la source concernées.
    const today = new Date().toISOString().slice(0, 10);
    expect(expiryAlerts(real.all(), real.sources, today)).toEqual([]);
  });

  it("does not ring for a retired template", () => {
    const retired = real.all().map((t) => ({ ...t, decl: { ...t.decl, status: "retired" as const } }));
    expect(expiryAlerts(retired, real.sources, "2028-06-01")).toEqual([]);
  });
});

describe("source lookups by issue date", () => {
  const only = fixtures.find("expiring", 1);
  const clause = only?.decl.clauses[0];

  it("reports a cited source whose validUntil is before the issue date, and not on its last day", () => {
    if (clause === undefined) throw new Error("fixture absente");
    expect(expiredSourcesOf(clause, fixtures.sources, "2026-12-31")).toEqual([]);
    expect(expiredSourcesOf(clause, fixtures.sources, "2027-01-01")).toEqual(["old-rule"]);
  });

  it("reports a source that expires within 60 days of the issue date, from the data and never from the clock", () => {
    if (clause === undefined) throw new Error("fixture absente");
    expect(expiringSourcesOf(clause, fixtures.sources, "2026-10-01")).toEqual([]);
    expect(expiringSourcesOf(clause, fixtures.sources, "2026-11-01")).toEqual([{ sourceId: "old-rule", validUntil: "2026-12-31", daysLeft: 60 }]);
  });

  it("an unknown source is a bug of the registry, not a pass", () => {
    expect(() => expiredSourcesOf({ sources: ["nope"] }, fixtures.sources, "2026-10-24")).toThrow(/nope/);
  });
});
