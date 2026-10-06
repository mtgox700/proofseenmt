import { describe, expect, it } from "vitest";
import { ManifestSchema, type Manifest } from "../src/schemas";
import { AUDIT_PROTOCOL, buildAuditManifest, followUpManifest } from "../src/protocol";

const jd = (id: string, role: "target" | "control") => ({
  id,
  lang: "fr" as const,
  role,
  source: "client" as const,
  text: "x".repeat(400),
  brief: "un développeur full stack TypeScript",
});
const reference: Manifest = {
  ...buildAuditManifest({ waveId: "J0", jobDescriptions: [jd("T01", "target"), jd("C01", "control")] }),
  frozenAt: "2026-09-23T17:28:29Z",
};

const follow = (over: Partial<Manifest> = {}) => followUpManifest({ reference: { ...reference, ...over }, waveId: "J30" });

describe("une re-mesure ne change que son identifiant", () => {
  it("reprend mot pour mot les offres, les formulations, les moteurs et les modèles", () => {
    const { manifest } = follow();
    expect(manifest.jobDescriptions).toEqual(reference.jobDescriptions);
    expect(manifest.prompts).toEqual(reference.prompts);
    expect(manifest.engines).toEqual(reference.engines);
    expect(manifest.models).toEqual(reference.models);
    expect(manifest.drawsPerCell).toBe(reference.drawsPerCell);
  });

  it("porte le nouvel identifiant et reste valide au schéma", () => {
    const { manifest } = follow();
    expect(manifest.waveId).toBe("J30");
    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
  });

  it("repart non figée : figer reste un acte délibéré", () => {
    expect(follow().manifest.frozenAt).toBeNull();
  });

  it("refuse de se comparer à elle-même", () => {
    expect(() => followUpManifest({ reference, waveId: "J0" })).toThrow(/même identifiant/i);
  });

  it("refuse une référence qui n'a jamais été figée : elle ne prouve pas ce qui a été mesuré", () => {
    expect(() => follow({ frozenAt: null })).toThrow(/figé/i);
  });
});

describe("ce qui menace la comparabilité est nommé, jamais avalé", () => {
  it("ne signale rien quand la référence suit le protocole courant", () => {
    expect(follow().divergences).toEqual([]);
  });

  it("signale un modèle qui a changé depuis la référence", () => {
    const { divergences } = follow({ models: { ...reference.models, openai: "gpt-5-mini-ancien" } });
    expect(divergences.join(" ")).toMatch(/openai/);
    expect(divergences.join(" ")).toMatch(/gpt-5-mini-ancien/);
  });

  it("signale une formulation qui a changé depuis la référence", () => {
    const changed = reference.prompts.map((prompt, index) => (index === 0 ? { ...prompt, text: `${prompt.text} Et sois bref.` } : prompt));
    expect(follow({ prompts: changed }).divergences.join(" ")).toMatch(/formulation|P1/i);
  });

  it("signale un moteur du protocole courant que la référence n’a pas mesuré", () => {
    const fewer = reference.engines.filter((engine) => engine !== "perplexity");
    const models = Object.fromEntries(Object.entries(reference.models).filter(([engine]) => engine !== "perplexity"));
    expect(follow({ engines: fewer, models }).divergences.join(" ")).toMatch(/perplexity/);
  });

  it("garde quand même la référence : c'est elle qui fait foi, pas le protocole d'aujourd'hui", () => {
    const old = { ...reference.models, openai: "gpt-5-mini-ancien" };
    const { manifest, divergences } = follow({ models: old });
    expect(manifest.models).toEqual(old);
    expect(divergences.length).toBeGreaterThan(0);
  });
});

describe("le protocole courant existe toujours pour les nouvelles mesures", () => {
  it("n'est pas modifié par une re-mesure", () => {
    follow({ models: { ...reference.models, openai: "autre" } });
    expect(AUDIT_PROTOCOL.models.openai).toBe("gpt-5-mini");
  });
});
