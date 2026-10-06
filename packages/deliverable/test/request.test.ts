import { describe, expect, it } from "vitest";
import { AuditRequestSchema } from "../src/request";

const base = {
  client: { displayName: "Camille Dupont", reference: "FR-1AB2C" },
  surface: { readableWithoutJs: true, robotsTxt: true, sitemap: true, structuredData: true, verifiedPlatforms: ["github.com"] },
  indexation: { pagesDeclared: 4, pagesIndexed: 4, checkedAt: "2026-10-24" },
  jobDescriptions: [{ id: "T01", label: "Développeur full stack TypeScript", provenance: "client" }],
  caveats: [],
};
const parse = (over: Record<string, unknown>) => AuditRequestSchema.safeParse({ ...base, ...over });

describe("la référence du client entre dans un nom de fichier", () => {
  it("refuse tout ce qui pourrait faire sortir l'écriture du dossier de rapport", () => {
    for (const reference of ["../../evil", "FR/1AB2C", "FR\\1AB2C", "FR 1AB2C", "."]) {
      expect(parse({ client: { ...base.client, reference } }).success, reference).toBe(false);
    }
  });

  it("accepte un identifiant public ordinaire", () => {
    expect(parse({ client: { ...base.client, reference: "FR-7H2XK" } }).success).toBe(true);
  });
});

describe("les textes libres ne doivent pas pouvoir remodeler le rapport", () => {
  it("refuse un saut de ligne dans un libellé d'offre : il permettrait d'injecter un faux titre", () => {
    expect(parse({ jobDescriptions: [{ id: "T01", label: "Développeur\n## Résultat garanti", provenance: "client" }] }).success).toBe(false);
  });

  it("refuse un saut de ligne dans une réserve et dans le nom affiché", () => {
    expect(parse({ caveats: ["Réserve\n# Conclusion officielle"] }).success).toBe(false);
    expect(parse({ client: { ...base.client, displayName: "Camille\nDupont" } }).success).toBe(false);
  });

  it("refuse un caractère de contrôle même sans saut de ligne", () => {
    expect(parse({ caveats: ["Réserve\u0007avec cloche"] }).success).toBe(false);
  });
});

describe("bornes", () => {
  it("refuse une demande sans offre et une demande démesurée", () => {
    expect(parse({ jobDescriptions: [] }).success).toBe(false);
    expect(parse({ jobDescriptions: [...Array(51)].map((_, i) => ({ id: `T${i}`, label: "Offre", provenance: "proofseen" })) }).success).toBe(false);
  });

  it("refuse plus de pages indexées que déclarées", () => {
    expect(parse({ indexation: { pagesDeclared: 2, pagesIndexed: 3, checkedAt: "2026-10-24" } }).success).toBe(false);
  });

  it("refuse un domaine donné sous forme d'URL", () => {
    expect(parse({ surface: { ...base.surface, verifiedPlatforms: ["https://github.com/x"] } }).success).toBe(false);
  });
});
