import { describe, expect, it } from "vitest";
import { IdentitySchema, ManifestSchema, PromptTemplateSchema, verifiedUrls } from "../src/schemas";
import { renderPrompt } from "../src/prompt";

const baseManifest = {
  version: 1,
  waveId: "J0",
  frozenAt: null,
  engines: ["openai", "anthropic", "perplexity"],
  models: { openai: "gpt-5-mini", anthropic: "claude-haiku-4-5", perplexity: "sonar" },
  drawsPerCell: 5,
  costCapUsd: 50,
  jobDescriptions: [
    { id: "T01", lang: "fr", role: "target", source: "market", text: "Senior Full Stack TypeScript, Paris, freelance" },
  ],
  prompts: [{ id: "P1", version: 1, lang: "fr", text: "Voici une offre :\n{{JD}}\nTrouve-moi les 5 meilleurs profils freelances. Nom, lien, pourquoi." }],
};

describe("ManifestSchema", () => {
  it("accepts a valid manifest", () => {
    expect(ManifestSchema.parse(baseManifest).drawsPerCell).toBe(5);
  });

  it("rejects an excluded engine such as gemini", () => {
    expect(() => ManifestSchema.parse({ ...baseManifest, engines: ["gemini"] })).toThrow();
  });

  it("rejects a cost cap that is missing or non-positive", () => {
    expect(() => ManifestSchema.parse({ ...baseManifest, costCapUsd: 0 })).toThrow();
  });

  it("rejects a prompt template without the {{JD}} placeholder", () => {
    const bad = { ...baseManifest, prompts: [{ id: "P1", version: 1, lang: "fr", text: "Trouve des profils" }] };
    expect(() => ManifestSchema.parse(bad)).toThrow();
  });

  it("rejects duplicate job description ids", () => {
    const jd = baseManifest.jobDescriptions[0];
    expect(() => ManifestSchema.parse({ ...baseManifest, jobDescriptions: [jd, jd] })).toThrow();
  });

  it("requires a model for every selected engine", () => {
    expect(() => ManifestSchema.parse({ ...baseManifest, models: { openai: "gpt-5-mini" } })).toThrow();
  });
});

describe("Identity helpers", () => {
  it("returns only verified URLs", () => {
    const identity = IdentitySchema.parse({
      id: "x",
      displayName: "X Y",
      nameVariants: ["X Y"],
      city: "Paris",
      stack: [],
      ownedUrls: [
        { url: "https://a.dev/", proofMethod: "dns_txt", verifiedAt: "2026-09-20T00:00:00Z" },
        { url: "https://b.dev/", proofMethod: "dns_txt", verifiedAt: null },
      ],
    });
    expect(verifiedUrls(identity).map((u) => u.url)).toEqual(["https://a.dev/"]);
  });
});

describe("renderPrompt", () => {
  it("injects only the job description text", () => {
    const out = renderPrompt(PromptTemplateSchema.parse(baseManifest.prompts[0]), { jd: "Offre X" });
    expect(out).toContain("Offre X");
    expect(out).not.toContain("{{JD}}");
  });

  it("injects the brief for short templates and refuses a missing brief", () => {
    const p2 = { id: "P2", version: 1, lang: "fr" as const, text: "Je cherche {{BRIEF}}. Qui me recommandes-tu ?" };
    expect(renderPrompt(p2, { jd: "x", brief: "un freelance React à Paris" })).toBe("Je cherche un freelance React à Paris. Qui me recommandes-tu ?");
    expect(() => renderPrompt(p2, { jd: "x" })).toThrow(/brief/);
  });
});

describe("ManifestSchema with {{BRIEF}}", () => {
  it("requires a brief on every JD when a template uses {{BRIEF}}", () => {
    const withBrief = { ...baseManifest, prompts: [...baseManifest.prompts, { id: "P2", version: 1, lang: "fr", text: "Je cherche {{BRIEF}}." }] };
    expect(() => ManifestSchema.parse(withBrief)).toThrow(/brief/);
    const ok = { ...withBrief, jobDescriptions: [{ ...baseManifest.jobDescriptions[0], brief: "un freelance TS à Paris" }] };
    expect(ManifestSchema.parse(ok).prompts).toHaveLength(2);
  });
});
