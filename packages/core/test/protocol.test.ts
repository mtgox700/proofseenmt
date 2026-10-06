import { describe, expect, it } from "vitest";
import { ManifestSchema, PromptTemplateSchema, type JobDescription } from "../src/schemas";
import { AUDIT_PROTOCOL, PROTOCOL_VERSION, buildAuditManifest, drawsOf, estimatedCostUsd } from "../src/protocol";

const jd = (id: string, role: "target" | "control", source: "client" | "market" = "client"): JobDescription => ({
  id,
  lang: "fr",
  role,
  source,
  text: "x".repeat(400),
  brief: "un développeur full stack TypeScript à Paris",
});
const targets = [jd("T01", "target"), jd("T02", "target"), jd("T03", "target")];
const control = jd("C01", "control", "market");
const build = (over: Partial<Parameters<typeof buildAuditManifest>[0]> = {}) =>
  buildAuditManifest({ waveId: "AUDIT-FR-1AB2C", jobDescriptions: [...targets, control], ...over });

describe("l'instrument est le même pour tout le monde", () => {
  it("produit un manifeste valide au schéma", () => {
    expect(() => ManifestSchema.parse(build())).not.toThrow();
  });

  it("reprend les moteurs, les modèles, les formulations et les tirages du protocole, sans les redemander", () => {
    const manifest = build();
    expect(manifest.engines).toEqual([...AUDIT_PROTOCOL.engines]);
    expect(manifest.models).toEqual({ ...AUDIT_PROTOCOL.models });
    expect(manifest.drawsPerCell).toBe(AUDIT_PROTOCOL.drawsPerCell);
    expect(manifest.prompts.map((p) => p.id)).toEqual(AUDIT_PROTOCOL.prompts.map((p) => p.id));
  });

  it("donne le même instrument à deux clients différents", () => {
    const a = build({ waveId: "AUDIT-AAA" });
    const z = build({ waveId: "AUDIT-ZZZ" });
    expect(a.prompts).toEqual(z.prompts);
    expect(a.engines).toEqual(z.engines);
    expect(a.models).toEqual(z.models);
  });

  it("laisse le manifeste non figé : figer est un acte délibéré, pas un effet de bord", () => {
    expect(build().frozenAt).toBeNull();
  });
});

describe("les formulations sont celles du protocole, pas des variantes", () => {
  it("valide chaque formulation au schéma", () => {
    for (const prompt of AUDIT_PROTOCOL.prompts) expect(() => PromptTemplateSchema.parse(prompt)).not.toThrow();
  });

  it("couvre les deux langues et demande un lien de profil à chaque fois", () => {
    expect(new Set(AUDIT_PROTOCOL.prompts.map((p) => p.lang))).toEqual(new Set(["fr", "en"]));
    for (const prompt of AUDIT_PROTOCOL.prompts) expect(prompt.text.toLowerCase()).toMatch(/lien vers (leur|son) profil|link to their profile/);
  });

  it("ne nomme jamais personne : le nom du client ne peut pas atteindre un moteur", () => {
    for (const prompt of AUDIT_PROTOCOL.prompts) expect(prompt.text).toMatch(/\{\{JD\}\}|\{\{BRIEF\}\}/);
  });
});

describe("ce que la vague va coûter, avant de la lancer", () => {
  it("compte les tirages comme offres × formulations × moteurs × tirages par cellule", () => {
    expect(drawsOf(build())).toBe(4 * AUDIT_PROTOCOL.prompts.length * AUDIT_PROTOCOL.engines.length * AUDIT_PROTOCOL.drawsPerCell);
  });

  it("propose un plafond qui couvre la vague entière, jamais moins", () => {
    const manifest = build();
    expect(manifest.costCapUsd).toBeGreaterThan(estimatedCostUsd(manifest));
  });

  it("accepte un plafond imposé par l'opérateur", () => {
    expect(build({ costCapUsd: 12 }).costCapUsd).toBe(12);
  });
});

describe("ce que le manifeste refuse", () => {
  it("refuse une vague sans offre témoin : rien ne dirait plus si le moteur cite au hasard", () => {
    expect(() => build({ jobDescriptions: targets })).toThrow(/témoin/i);
  });

  it("refuse une vague sans offre cible", () => {
    expect(() => build({ jobDescriptions: [control] })).toThrow(/cible/i);
  });

  it("refuse un identifiant de vague que le schéma rejetterait", () => {
    expect(() => build({ waveId: "audit/../evil" })).toThrow();
  });

  it("refuse deux offres portant le même identifiant", () => {
    expect(() => build({ jobDescriptions: [...targets, jd("T01", "control", "market")] })).toThrow();
  });

  it("refuse une formulation qui réclame un brief quand une offre n'en a pas", () => {
    const sansBrief = { ...jd("T04", "target"), brief: undefined };
    expect(() => build({ jobDescriptions: [...targets, control, sansBrief] })).toThrow();
  });

  it("marque la version du protocole, pour qu'une vague dise avec quel instrument elle a été faite", () => {
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
    expect(AUDIT_PROTOCOL.version).toBe(PROTOCOL_VERSION);
  });
});
