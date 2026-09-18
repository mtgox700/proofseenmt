import { describe, expect, it } from "vitest";
import { assertJdFreeOfIdentity, sanitizeJobDescription } from "../src/jd";
import { IdentitySchema } from "../src/schemas";

const identity = IdentitySchema.parse({
  id: "ayoub",
  displayName: "Ayoub Hammoudi",
  nameVariants: ["Ayoub Hammoudi", "A. Hammoudi"],
  city: "Paris",
  stack: ["TypeScript", "Next.js"],
  ownedUrls: [
    { url: "https://ayoub-hammoudi.dev/", proofMethod: "well_known_file", verifiedAt: "2026-09-25T10:00:00Z" },
    { url: "https://github.com/Ayoubhm07", proofMethod: "profile_token", verifiedAt: null },
  ],
});

describe("sanitizeJobDescription", () => {
  it("removes e-mails, phone numbers and URLs", () => {
    const raw = "Senior dev React. Écrire à jobs@acme.io ou +33 6 12 34 56 78. Voir https://acme.io/jobs/42 pour postuler.";
    const out = sanitizeJobDescription(raw);
    expect(out).not.toMatch(/@acme\.io/);
    expect(out).not.toMatch(/12 34 56 78/);
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).toContain("Senior dev React");
  });

  it("removes recruiter contact lines in French and English", () => {
    const raw = ["Mission : Tech Lead Node.js", "Contact : Marie Dupont", "Recruiter: John Smith", "Remote possible"].join("\n");
    const out = sanitizeJobDescription(raw);
    expect(out).not.toMatch(/Marie Dupont/);
    expect(out).not.toMatch(/John Smith/);
    expect(out).toContain("Tech Lead Node.js");
    expect(out).toContain("Remote possible");
  });

  it("resists adversarial 20 000-character inputs (no catastrophic backtracking)", () => {
    ["1 ".repeat(10_000), "+".repeat(20_000), `${"a".repeat(19_990)}@`].forEach((attack) => {
      const start = performance.now();
      sanitizeJobDescription(attack);
      expect(performance.now() - start).toBeLessThan(500);
    });
  });

  it("normalises whitespace and is idempotent", () => {
    const once = sanitizeJobDescription("  a   b \n\n\n c ");
    expect(sanitizeJobDescription(once)).toBe(once);
  });
});

describe("assertJdFreeOfIdentity", () => {
  it("accepts a JD without the client's identity", () => {
    expect(() => assertJdFreeOfIdentity("Senior Full Stack TypeScript à Paris", identity)).not.toThrow();
  });

  it("rejects a JD containing a client name variant (case and accent insensitive)", () => {
    expect(() => assertJdFreeOfIdentity("profil type ayoub HAMMOUDI recherché", identity)).toThrow(/identity/i);
  });

  it("rejects a JD containing a client-owned host", () => {
    expect(() => assertJdFreeOfIdentity("inspiré de ayoub-hammoudi.dev", identity)).toThrow(/identity/i);
  });
});
