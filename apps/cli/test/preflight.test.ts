import { describe, expect, it } from "vitest";
import { IdentitySchema, ManifestSchema } from "@proofseen/core";
import { preflight, type PreflightInput } from "../src/preflight";

const manifest = (overrides: Record<string, unknown> = {}) =>
  ManifestSchema.parse({
    version: 1,
    waveId: "J0",
    frozenAt: "2026-09-27T18:00:00Z",
    engines: ["openai", "anthropic", "perplexity"],
    models: { openai: "gpt-5-mini", anthropic: "claude-sonnet-5", perplexity: "perplexity/sonar" },
    drawsPerCell: 5,
    costCapUsd: 50,
    jobDescriptions: [
      { id: "T01", lang: "fr", role: "target", source: "market", text: "Senior Full Stack TypeScript, Paris, freelance." },
      { id: "C01", lang: "fr", role: "control", source: "market", text: "Développeur Java Spring Boot, Lyon, sur site." },
    ],
    prompts: [{ id: "P1", version: 1, lang: "fr", text: "Voici une offre :\n{{JD}}\nTrouve les 5 meilleurs profils." }],
    ...overrides,
  });

const identity = (overrides: Record<string, unknown> = {}) =>
  IdentitySchema.parse({
    id: "ayoub",
    displayName: "Ayoub Hammoudi",
    nameVariants: ["Ayoub Hammoudi"],
    city: "Paris",
    stack: ["TypeScript"],
    ownedUrls: [{ url: "https://ayoub-hammoudi.dev/", proofMethod: "well_known_file", verifiedAt: "2026-09-25T10:00:00Z" }],
    ...overrides,
  });

const env = {
  OPENAI_API_KEY: "x".repeat(20),
  ANTHROPIC_API_KEY: "y".repeat(20),
  PERPLEXITY_API_KEY: "z".repeat(20),
  PROOFSEEN_ENC_KEY: Buffer.alloc(32, 7).toString("base64"),
};

const input = (o: Partial<PreflightInput> = {}): PreflightInput => ({
  manifest: manifest(),
  identity: identity(),
  env,
  waveExists: false,
  now: new Date("2026-09-28T07:00:00Z"),
  ...o,
});

const find = (report: ReturnType<typeof preflight>, name: string) => report.checks.find((c) => c.name === name)!;

describe("preflight (before spending a cent on J0)", () => {
  it("says GO when everything is ready, and never prints a key", () => {
    const report = preflight(input());
    expect(report.go).toBe(true);
    expect(report.checks.every((c) => c.status !== "fail")).toBe(true);
    const text = JSON.stringify(report);
    [env.OPENAI_API_KEY, env.ANTHROPIC_API_KEY, env.PERPLEXITY_API_KEY, env.PROOFSEEN_ENC_KEY].forEach((secret) =>
      expect(text).not.toContain(secret),
    );
  });

  it("refuses an unfrozen manifest and a manifest frozen in the future", () => {
    expect(find(preflight(input({ manifest: manifest({ frozenAt: null }) })), "manifest frozen").status).toBe("fail");
    expect(preflight(input({ manifest: manifest({ frozenAt: null }) })).go).toBe(false);
    expect(find(preflight(input({ manifest: manifest({ frozenAt: "2026-10-01T00:00:00Z" }) })), "manifest frozen").status).toBe("fail");
  });

  it("names every missing secret without revealing any value", () => {
    const report = preflight(input({ env: { ...env, PERPLEXITY_API_KEY: "  " } }));
    const check = find(report, "API keys");
    expect(check.status).toBe("fail");
    expect(check.detail).toContain("PERPLEXITY_API_KEY");
    expect(report.go).toBe(false);
  });

  it("refuses an encryption key that is not 32 bytes", () => {
    expect(find(preflight(input({ env: { ...env, PROOFSEEN_ENC_KEY: "dG9vIHNob3J0" } })), "encryption key").status).toBe("fail");
  });

  it("warns when the budget cap would stop the wave before the end", () => {
    const check = find(preflight(input({ manifest: manifest({ costCapUsd: 1 }) })), "budget");
    expect(check.status).toBe("warn");
    expect(check.detail).toMatch(/worst case/);
  });

  it("fails when no owned URL is verified: no match could ever be counted", () => {
    const noProof = identity({ ownedUrls: [{ url: "https://ayoub-hammoudi.dev/", proofMethod: "well_known_file", verifiedAt: null }] });
    expect(find(preflight(input({ identity: noProof })), "possession proof").status).toBe("fail");
  });

  it("leaves to the schema what the schema already guarantees (a prompt carries the job description)", () => {
    expect(() => manifest({ prompts: [{ id: "P1", version: 1, lang: "fr", text: "Trouve les 5 meilleurs profils." }] })).toThrow();
  });

  it("warns on a thin corpus and on resuming an existing wave", () => {
    expect(find(preflight(input()), "corpus").status).toBe("warn");
    expect(find(preflight(input({ waveExists: true })), "wave folder").status).toBe("warn");
    expect(preflight(input({ waveExists: true })).go).toBe(true);
  });
});
