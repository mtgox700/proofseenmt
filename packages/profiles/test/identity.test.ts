import { describe, expect, it } from "vitest";
import {
  PrivateIdentitySchema,
  PublicProfileSchema,
  RISK_BLOCK,
  buildPublicProfile,
  findLeaks,
  reidentificationRisk,
  type PrivateIdentity,
} from "../src";

const privateIdentity = (overrides: Record<string, unknown> = {}): PrivateIdentity =>
  PrivateIdentitySchema.parse({
    profileId: "FR-8F42K",
    realName: "Ayoub Hammoudi",
    email: "ayoub@example.com",
    phone: "+33600000000",
    links: ["https://www.linkedin.com/in/ayoub-hammoudi", "https://github.com/ayoubhm"],
    legalId: "90123456700012",
    consent: { givenAt: "2026-09-20", scope: "public_pseudonymous_profile", irreversibilityAcknowledged: true },
    ...overrides,
  });

const publicDraft = (overrides: Record<string, unknown> = {}) => ({
  id: "FR-8F42K",
  handle: "Ayoub.H",
  headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
  seniority: "7+ ans",
  area: "Paris / Île-de-France",
  skills: ["TypeScript", "Node.js", "React"],
  sectors: ["SaaS B2B"],
  availability: { status: "available", updatedAt: "2026-09-20" },
  rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
  verifiedMissions: 4,
  summary: { fr: "Construit des applications TypeScript en production.", en: "Builds production TypeScript applications." },
  ...overrides,
});

describe("Identity Firewall: the public side cannot carry the private side", () => {
  it("builds a public profile that keeps only public fields", () => {
    const profile = buildPublicProfile(privateIdentity(), publicDraft());
    expect(profile.handle).toBe("Ayoub.H");
    expect(profile.id).toBe("FR-8F42K");
    expect(JSON.stringify(profile)).not.toContain("Ayoub Hammoudi");
    expect(JSON.stringify(profile)).not.toContain("linkedin");
    expect(Object.keys(profile)).not.toContain("realName");
  });

  it("refuses a public draft that repeats the real identity anywhere", () => {
    const id = privateIdentity();
    expect(() => buildPublicProfile(id, publicDraft({ handle: "Ayoub Hammoudi" }))).toThrow(/identité/i);
    expect(() =>
      buildPublicProfile(id, publicDraft({ summary: { fr: "Voir github.com/ayoubhm", en: "See github.com/ayoubhm" } })),
    ).toThrow(/identité/i);
    expect(() => buildPublicProfile(id, publicDraft({ sectors: ["Contact : ayoub@example.com"] }))).toThrow(/identité/i);
  });

  it("refuses to publish without a recorded consent", () => {
    expect(() => PrivateIdentitySchema.parse({ ...privateIdentity(), consent: null })).toThrow();
  });

  it("refuses a public profile whose id does not match the private identity", () => {
    expect(() => buildPublicProfile(privateIdentity(), publicDraft({ id: "FR-99999" }))).toThrow(/ne correspond pas/);
  });

  it("works for an identity without phone, without legal id and with an unparsable link", () => {
    const light = privateIdentity({ phone: null, legalId: null, links: ["https://perso.example/ayoub-hammoudi-dev"] });
    expect(buildPublicProfile(light, publicDraft()).id).toBe("FR-8F42K");
    // Le nom réel est aussi dans l'URL : le détecteur signale les deux, c'est ce qu'on veut.
    expect(findLeaks(light, "voir perso.example/ayoub-hammoudi-dev").sort()).toEqual(["link", "realName"]);
    expect(findLeaks(light, "aucun contact ici")).toEqual([]);
  });

  it("accepts the optional public fields in every shape (no rate, available from, unavailable)", () => {
    const id = privateIdentity();
    expect(buildPublicProfile(id, publicDraft({ rate: null })).rate).toBeNull();
    const soon = buildPublicProfile(id, publicDraft({ availability: { status: "available_from", from: "2026-11-02", updatedAt: "2026-09-20" } }));
    expect(soon.availability.from).toBe("2026-11-02");
    expect(buildPublicProfile(id, publicDraft({ availability: { status: "unavailable", updatedAt: "2026-09-20" } })).availability.from).toBeNull();
  });

  it("finds a leak in any rendered text, whatever the case or spacing", () => {
    const id = privateIdentity();
    expect(findLeaks(id, "<p>Contact : AYOUB HAMMOUDI</p>")).toEqual(["realName"]);
    expect(findLeaks(id, "<a href='https://GitHub.com/AyoubHM'>code</a>")).toEqual(["link"]);
    expect(findLeaks(id, "SIRET 901 234 567 00012")).toEqual(["legalId"]);
    expect(findLeaks(id, "<p>Ingénieur full stack, Paris</p>")).toEqual([]);
  });
});

describe("Re-identification risk", () => {
  it("scores a generic profile as low risk and publishes it", () => {
    const risk = reidentificationRisk(PublicProfileSchema.parse(publicDraft()));
    expect(risk.score).toBeLessThan(RISK_BLOCK);
    expect(risk.blocking).toBe(false);
  });

  it("blocks a profile whose combination points at one person", () => {
    const risk = reidentificationRisk(
      PublicProfileSchema.parse(
        publicDraft({
          area: "Saint-Junien",
          seniority: "17 ans",
          skills: ["COBOL", "OpenVMS", "Rust", "Zig", "Erlang", "Elixir"],
          sectors: ["Nucléaire civil", "Assurance maritime"],
          summary: { fr: "Ex-Google, promotion 2009 de l'X, auteur de la librairie Zig-Nuke.", en: "Ex-Google, X 2009, author of Zig-Nuke." },
        }),
      ),
    );
    expect(risk.blocking).toBe(true);
    expect(risk.reasons.map((r) => `${r.signal} ${r.detail}`).join(" ")).toMatch(/employeur|rare|zone/i);
  });

  it("explains every point it charges, and proposes a generalisation", () => {
    const risk = reidentificationRisk(
      PublicProfileSchema.parse(publicDraft({ summary: { fr: "5 ans chez Stripe, de janvier 2021 à mars 2026.", en: "5 years at Stripe, January 2021 to March 2026." } })),
    );
    expect(risk.reasons.length).toBeGreaterThan(0);
    risk.reasons.forEach((r) => expect(r.points).toBeGreaterThan(0));
    expect(risk.suggestions.join(" ")).toMatch(/scale-up|5\+ ans|généralis/i);
  });

  it("charges a long skill list and spares a single-word sector list", () => {
    const many = reidentificationRisk(
      PublicProfileSchema.parse(
        publicDraft({
          skills: ["TypeScript", "Node.js", "React", "Next.js", "NestJS", "Kafka", "Docker", "AWS", "GraphQL", "Redis", "Postgres", "Vue", "Svelte"],
          sectors: ["SaaS", "Finance"],
        }),
      ),
    );
    expect(many.reasons.map((r) => r.signal)).toContain("liste de compétences très longue");
    expect(many.reasons.map((r) => r.signal)).not.toContain("secteurs très spécifiques");
  });

  it("spares a seniority given as a range", () => {
    const risk = reidentificationRisk(PublicProfileSchema.parse(publicDraft({ seniority: "5 à 10 ans" })));
    expect(risk.reasons.map((r) => r.signal)).not.toContain("séniorité au chiffre près");
  });

  it("is deterministic: the same profile always gives the same score", () => {
    const profile = PublicProfileSchema.parse(publicDraft());
    expect(reidentificationRisk(profile)).toEqual(reidentificationRisk(profile));
  });
});
