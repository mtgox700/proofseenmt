import { describe, expect, it } from "vitest";
import { CLIENT_KINDS, PublicProfileSchema, type PublicProfile } from "../src/identity";
import { renderProfilePage } from "../src/render";
import { reidentificationRisk } from "../src/risk";

const mission = (overrides: Record<string, unknown> = {}) => ({
  clientKind: "scaleup",
  role: { fr: "Développeur back-end", en: "Back-end developer" },
  durationMonths: 14,
  achievements: [
    { fr: "Migration de la base de données sans interruption de service", en: "Database migration with no downtime" },
    { fr: "Mise en place des tests de non-régression", en: "Set up the regression test suite" },
  ],
  stack: ["TypeScript", "PostgreSQL"],
  verifiedAt: "2026-09-15",
  evidence: ["facture", "contrat"],
  ...overrides,
});

const profile = (overrides: Record<string, unknown> = {}): PublicProfile =>
  PublicProfileSchema.parse({
    id: "FR-8F42K",
    handle: "Ayoub.H",
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills: ["TypeScript", "Node.js", "PostgreSQL"],
    sectors: ["SaaS B2B"],
    availability: { status: "available", updatedAt: "2026-09-21" },
    rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
    verifiedMissions: 3,
    missions: [mission()],
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
    ...overrides,
  });

const render = (p: PublicProfile): string => renderProfilePage({ profile: p, locale: "fr", baseUrl: "https://proofseen.example", intents: [], noindex: false });

describe("published missions", () => {
  it("publishes what was delivered, without naming the client and without a date range", () => {
    const html = render(profile());
    expect(html).toContain("Migration de la base de données sans interruption de service");
    expect(html).toContain("Scale-up");
    expect(html).toContain("1 an et 2 mois");
    expect(html).toContain("Vérifiée le 2026-09-15");
  });

  it("makes a client name impossible by construction rather than by heuristic", () => {
    expect(CLIENT_KINDS).not.toContain("autre");
    expect(() => profile({ missions: [mission({ clientKind: "Société Générale" })] })).toThrow();
  });

  it("refuses to publish more missions than the profile claims to have verified", () => {
    expect(() => profile({ verifiedMissions: 1, missions: [mission(), mission()] })).toThrow(/missions vérifiées/);
  });

  it("stays valid for a profile that publishes no mission detail", () => {
    const bare = profile({ missions: [] });
    expect(bare.missions).toEqual([]);
    expect(render(bare)).not.toContain("<ol class=\"missions\">");
  });

  it("scans mission text for the signals that de-anonymise", () => {
    const named = profile({ missions: [mission({ achievements: [{ fr: "Reprise du socle chez Stripe", en: "Rebuilt the platform at Stripe" }] })] });
    const risk = reidentificationRisk(named);
    expect(risk.reasons.map((r) => r.signal)).toContain("employeur nommé");
    expect(risk.suggestions.join(" ")).toMatch(/catégorie/);
  });

  it("charges exact dates hidden inside a mission, not only in the summary", () => {
    const dated = profile({ missions: [mission({ achievements: [{ fr: "Livraison en mars 2024", en: "Shipped in March 2024" }] })] });
    expect(reidentificationRisk(dated).reasons.map((r) => r.signal)).toContain("dates exactes");
  });

  it("charges a rare technology whether it sits in the skills or in a mission stack", () => {
    const rare = profile({ missions: [mission({ stack: ["COBOL"] })] });
    expect(reidentificationRisk(rare).reasons.map((r) => r.signal)).toContain("compétences rares");
  });

  it("writes a duration in months below a year and never a start date", () => {
    const short = profile({ missions: [mission({ durationMonths: 5 })] });
    expect(render(short)).toContain("5 mois");
    expect(render(short)).not.toMatch(/\b20\d\d\s*[-–]\s*20\d\d\b/);
  });
});
