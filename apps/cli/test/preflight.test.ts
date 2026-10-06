import { describe, expect, it } from "vitest";
import { IdentitySchema, ManifestSchema } from "@proofseen/core";
import { preflight, type PreflightInput } from "../src/preflight";

/** A job ad long enough to be a real one: the corpus check refuses anything shorter than 300 characters. */
const realJd = (headline: string): string =>
  `${headline}\nContexte : équipe produit de 8 personnes, base de code TypeScript en production depuis quatre ans.\n` +
  "Missions : concevoir et livrer des fonctionnalités de bout en bout, améliorer la couverture de tests, participer aux revues de code, " +
  "travailler avec les équipes design et data, et tenir la qualité en production (observabilité, correctifs, astreinte légère).\n" +
  "Profil recherché : autonomie, expérience confirmée, goût du travail soigné et de la mesure. Démarrage rapide souhaité.";

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
      { id: "T01", lang: "fr", role: "target", source: "market", text: realJd("Senior Full Stack TypeScript, Paris, freelance 6 mois renouvelables.") },
      { id: "C01", lang: "fr", role: "control", source: "market", text: realJd("Développeur Java Spring Boot, Lyon, sur site, mission de 12 mois.") },
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
  surfaceCheck: {
    identityId: identity().id,
    checkedAt: "2026-09-27T07:00:00Z",
    pages: identity().ownedUrls.map((owned) => ({ url: owned.url, outcome: "clean" as const, kinds: [] })),
  },
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

  it("refuses a corpus that is still the template, rather than counting placeholders as ready", () => {
    const templated = manifest({
      jobDescriptions: [
        { id: "T01", lang: "fr", role: "target", source: "market", text: "[À COLLER] Texte intégral de l'offre T01, copié à la main depuis sa source publique." },
        { id: "C01", lang: "fr", role: "control", source: "market", text: realJd("Développeur Java Spring Boot, Lyon.") },
      ],
    });
    const check = find(preflight(input({ manifest: templated })), "corpus");
    expect(check.status).toBe("fail");
    expect(check.detail).toMatch(/not collected yet: T01/);
    expect(preflight(input({ manifest: templated })).go).toBe(false);
  });

  it("refuses a job description too short to measure anything", () => {
    const tooShort = manifest({
      jobDescriptions: [
        { id: "T01", lang: "fr", role: "target", source: "market", text: "Dev TypeScript Paris." },
        { id: "C01", lang: "fr", role: "control", source: "market", text: realJd("Développeur Java.") },
      ],
    });
    expect(find(preflight(input({ manifest: tooShort })), "corpus").detail).toMatch(/shorter than 300 characters: T01/);
  });

  it("refuses the same ad pasted twice, which would inflate one cell", () => {
    const duplicated = manifest({
      jobDescriptions: [
        { id: "T01", lang: "fr", role: "target", source: "market", text: realJd("Senior Full Stack TypeScript, Paris.") },
        { id: "T02", lang: "fr", role: "target", source: "market", text: `  ${realJd("Senior Full Stack TypeScript, Paris.")}  ` },
        { id: "C01", lang: "fr", role: "control", source: "market", text: realJd("Développeur Java.") },
      ],
    });
    expect(find(preflight(input({ manifest: duplicated })), "corpus").detail).toMatch(/duplicated: T02=T01/);
  });

  it("warns on a thin corpus and on resuming an existing wave", () => {
    expect(find(preflight(input()), "corpus").status).toBe("warn");
    expect(find(preflight(input({ waveExists: true })), "wave folder").status).toBe("warn");
    expect(preflight(input({ waveExists: true })).go).toBe(true);
  });

  it("refuses a dossier still carrying the fields client-init left to fill in", () => {
    // Un brief non rempli partirait tel quel dans les formulations : on paierait pour demander « je cherche À RENSEIGNER ».
    const blank = manifest({
      jobDescriptions: [
        { id: "T01", lang: "fr", role: "target", source: "client", text: realJd("Développeur TypeScript."), brief: "À RENSEIGNER : la mission" },
        { id: "C01", lang: "fr", role: "control", source: "market", text: realJd("Développeur SAP ABAP.") },
      ],
    });
    const report = preflight(input({ manifest: blank }));
    expect(find(report, "placeholders").status).toBe("fail");
    expect(find(report, "placeholders").detail).toContain("T01");
    expect(report.go).toBe(false);
  });

  it("refuses an identity left as the skeleton produced it", () => {
    const report = preflight(input({ identity: identity({ city: "À RENSEIGNER" }) }));
    expect(find(report, "placeholders").status).toBe("fail");
    expect(find(report, "placeholders").detail).toMatch(/identity/);
  });

  it("refuses to measure without a surface check: the promise cannot be skipped by forgetting it", () => {
    const report = preflight(input({ surfaceCheck: null }));
    expect(find(report, "surface check").status).toBe("fail");
    expect(report.go).toBe(false);
  });

  it("refuses a stale surface check, and one that found a manipulation", () => {
    const stale = { identityId: identity().id, checkedAt: "2026-01-01T07:00:00Z", pages: [{ url: identity().ownedUrls[0]!.url, outcome: "clean" as const, kinds: [] }] };
    expect(find(preflight(input({ surfaceCheck: stale })), "surface check").status).toBe("fail");

    const dirty = {
      identityId: identity().id,
      checkedAt: "2026-09-27T07:00:00Z",
      pages: identity().ownedUrls.map((owned) => ({ url: owned.url, outcome: "manipulated" as const, kinds: ["hidden_text"] })),
    };
    const report = preflight(input({ surfaceCheck: dirty }));
    expect(find(report, "surface check").detail).toMatch(/hidden_text/);
    expect(report.go).toBe(false);
  });

  it("judges a client audit on its own shape, not on the reference protocol", () => {
    // 3 + 1 est la forme vendue. La comparer aux seuils de la vague de référence ferait sonner l'avertissement à
    // chaque client — et un avertissement qui sonne toujours cesse d'être lu.
    const clientAudit = manifest({
      jobDescriptions: [
        { id: "T01", lang: "fr", role: "target", source: "client", text: realJd("Développeur Node.js / TypeScript, freelance.") },
        { id: "T02", lang: "fr", role: "target", source: "client", text: realJd("Développeur full stack TypeScript, Angular, NestJS.") },
        { id: "T03", lang: "fr", role: "target", source: "client", text: realJd("Développeur fullstack TypeScript, remote partiel.") },
        { id: "C01", lang: "fr", role: "control", source: "market", text: realJd("Développeur SAP ABAP senior, sur site.") },
      ],
    });
    const check = find(preflight(input({ manifest: clientAudit })), "corpus");
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("client audit");
  });

  it("still holds a client audit to its own minimum", () => {
    const tooThin = manifest({
      jobDescriptions: [
        { id: "T01", lang: "fr", role: "target", source: "client", text: realJd("Développeur Node.js / TypeScript, freelance.") },
        { id: "C01", lang: "fr", role: "control", source: "market", text: realJd("Développeur SAP ABAP senior, sur site.") },
      ],
    });
    expect(find(preflight(input({ manifest: tooThin })), "corpus").status).toBe("warn");
  });
});
