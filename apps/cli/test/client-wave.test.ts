import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUDIT_PROTOCOL, ManifestSchema } from "@proofseen/core";
import { commandClientWave } from "../src/client-wave";
import { commandFollowUp } from "../src/follow-up";

const AD = (title: string) =>
  `${title}\nContexte : équipe produit de 8 personnes, base TypeScript en production depuis quatre ans.\n` +
  "Missions : concevoir et livrer des fonctionnalités de bout en bout, améliorer la couverture de tests, participer aux revues, " +
  "tenir la qualité en production. Profil : autonomie, expérience confirmée, goût de la mesure. Démarrage rapide souhaité.";

const entry = (id: string, provenance: "client" | "proofseen", role: "target" | "control") => ({
  id,
  label: `Offre ${id}`,
  provenance,
  role,
  brief: "un développeur full stack TypeScript à Paris",
});

const request = {
  client: { displayName: "Camille Dupont", reference: "FR-1AB2C" },
  surface: { readableWithoutJs: true, robotsTxt: true, sitemap: true, structuredData: true, verifiedPlatforms: [] },
  indexation: null,
  jobDescriptions: [entry("T01", "client", "target"), entry("T02", "client", "target"), entry("T03", "client", "target"), entry("C01", "proofseen", "control")],
  caveats: [],
};

describe("monter la vague d'un client", () => {
  let dir: string;
  let jdDir: string;
  let requestPath: string;
  let outPath: string;
  const logs: string[] = [];

  const run = (over: Record<string, unknown> = {}) =>
    writeFile(requestPath, JSON.stringify({ ...request, ...over })).then(() =>
      commandClientWave({ requestPath, jdDir, outPath, costCapUsd: undefined, log: (m) => void logs.push(m) }),
    );
  const written = async () => ManifestSchema.parse(JSON.parse(await readFile(outPath, "utf8")));

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-wave-"));
    jdDir = join(dir, "offres");
    await mkdir(jdDir, { recursive: true });
    for (const id of ["T01", "T02", "T03", "C01"]) await writeFile(join(jdDir, `${id}.txt`), AD(`Offre ${id}`));
    requestPath = join(dir, "request.json");
    outPath = join(dir, "manifest.json");
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("donne à ce client le même instrument qu'à tous les autres", async () => {
    await run();
    const manifest = await written();
    expect(manifest.prompts.map((p) => p.id)).toEqual(AUDIT_PROTOCOL.prompts.map((p) => p.id));
    expect(manifest.engines).toEqual([...AUDIT_PROTOCOL.engines]);
    expect(manifest.models).toEqual({ ...AUDIT_PROTOCOL.models });
  });

  it("trace l'offre témoin comme venant de nous, pas du client", async () => {
    // Faux serait doublement gênant : c'est aussi ce champ qui distingue un audit client d'une vague de référence.
    await run();
    const manifest = await written();
    expect(manifest.jobDescriptions.find((jd) => jd.id === "C01")?.source).toBe("market");
    expect(manifest.jobDescriptions.find((jd) => jd.id === "T01")?.source).toBe("client");
  });

  it("plafonne le coût au-dessus du pire cas, pas de la moyenne", async () => {
    // Un plafond calculé sur la moyenne arrêterait la vague en cours de route : vague tronquée, donc inexploitable.
    await run();
    const manifest = await written();
    const worst = 240 * (0.08 + 0.12 + 0.03) / 3 + 240 * 0.006;
    expect(manifest.costCapUsd).toBeGreaterThan(worst);
  });

  it("sort non figée, et le dit", async () => {
    await run();
    expect((await written()).frozenAt).toBeNull();
    expect(logs.join("\n")).toContain("non figé");
  });

  it("refuse une vague sans offre témoin", async () => {
    await expect(run({ jobDescriptions: request.jobDescriptions.filter((jd) => jd.role === "target") })).rejects.toThrow(/témoin/i);
  });

  it("refuse une offre dont le texte n'a pas été fourni", async () => {
    await expect(run({ jobDescriptions: [...request.jobDescriptions, entry("T09", "client", "target")] })).rejects.toThrow(/T09 introuvable/);
  });

  it("lit aussi une offre en .md, comme jd-import", async () => {
    // Deux commandes qui lisent les mêmes fichiers ne doivent pas se comporter différemment : l'opérateur
    // apprendrait une règle qui ne vaut qu'une fois sur deux.
    await rm(join(jdDir, "T03.txt"));
    await writeFile(join(jdDir, "T03.md"), AD("Offre T03"));
    await expect(run()).resolves.toBeDefined();
  });

  it("refuse un fichier d'offre vide au lieu de le laisser filer jusqu'au préflight", async () => {
    await writeFile(join(jdDir, "T02.txt"), "   \n  ");
    await expect(run()).rejects.toThrow(/est vide/);
  });

  it("refuse une offre sans rôle ni brief, au lieu d'en inventer un", async () => {
    const sansRole = { id: "T01", label: "Offre T01", provenance: "client" as const };
    await expect(run({ jobDescriptions: [sansRole, entry("C01", "proofseen", "control")] })).rejects.toThrow(/role/);
  });
});

describe("re-mesurer une vague", () => {
  let dir: string;
  let referencePath: string;
  let outPath: string;
  const logs: string[] = [];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-follow-"));
    referencePath = join(dir, "reference.json");
    outPath = join(dir, "j30.json");
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const reference = async (over: Record<string, unknown> = {}) => {
    const jdDir = join(dir, "offres");
    await mkdir(jdDir, { recursive: true });
    for (const id of ["T01", "T02", "T03", "C01"]) await writeFile(join(jdDir, `${id}.txt`), AD(`Offre ${id}`));
    const path = join(dir, "request.json");
    await writeFile(path, JSON.stringify(request));
    await commandClientWave({ requestPath: path, jdDir, outPath: referencePath, costCapUsd: undefined, log: () => undefined });
    const manifest = JSON.parse(await readFile(referencePath, "utf8")) as Record<string, unknown>;
    await writeFile(referencePath, JSON.stringify({ ...manifest, frozenAt: "2026-09-24T08:00:00Z", ...over }));
  };

  it("produit une vague identique à sa référence, sauf l'identifiant", async () => {
    await reference();
    await commandFollowUp({ referencePath, waveId: "J30", outPath, log: (m) => void logs.push(m) });
    const before = JSON.parse(await readFile(referencePath, "utf8")) as Record<string, unknown>;
    const after = JSON.parse(await readFile(outPath, "utf8")) as Record<string, unknown>;
    const differing = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    expect(differing.sort()).toEqual(["frozenAt", "waveId"]);
  });

  it("refuse une référence jamais figée : elle ne prouve pas ce qui a été mesuré", async () => {
    await reference({ frozenAt: null });
    await expect(commandFollowUp({ referencePath, waveId: "J30", outPath, log: () => undefined })).rejects.toThrow(/figé/i);
  });

  it("nomme les écarts avec le protocole courant au lieu de les avaler", async () => {
    await reference({ models: { ...AUDIT_PROTOCOL.models, openai: "gpt-5-mini-de-septembre" } });
    await commandFollowUp({ referencePath, waveId: "J30", outPath, log: (m) => void logs.push(m) });
    const out = logs.join("\n");
    expect(out).toContain("Écarts avec le protocole courant");
    expect(out).toContain("gpt-5-mini-de-septembre");
  });
});
