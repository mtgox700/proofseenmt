import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentitySchema, ManifestSchema } from "@proofseen/core";
import { preflight, type PreflightInput } from "../src/preflight";
import { commandClientWave } from "../src/client-wave";

/*
 * Engagement de l'offre : « une offre qui contient votre nom ou l'une de vos adresses est refusée (elle fausserait
 * la mesure) ». Une offre qui nomme le client truque tout : le moteur le retrouve parce qu'on le lui a soufflé.
 *
 * `run` refusait déjà ces offres, mais **au moment de dépenser**. Le contrôle est désormais fait aussi à l'entrée
 * (`client-wave`) et au dernier portail avant la dépense (`preflight`), pour qu'un GO veuille dire GO.
 */

const AD = (extra = "") =>
  `Développeur full stack TypeScript, freelance.${extra}\nContexte : équipe produit de 8 personnes, base TypeScript en production depuis quatre ans.\n` +
  "Missions : concevoir et livrer des fonctionnalités de bout en bout, améliorer la couverture de tests, participer aux revues de code, " +
  "et tenir la qualité en production. Profil : autonomie, expérience confirmée, goût de la mesure. Démarrage rapide souhaité.";

const identity = IdentitySchema.parse({
  id: "FR-1AB2C",
  displayName: "Camille Dupont",
  nameVariants: ["Camille Dupont"],
  city: "Paris",
  stack: ["TypeScript"],
  ownedUrls: [{ url: "https://camille-dupont.fr/", proofMethod: "well_known_file", verifiedAt: "2026-09-26T09:00:00Z" }],
});

const manifest = (text: string) =>
  ManifestSchema.parse({
    version: 1,
    waveId: "AUDIT",
    frozenAt: "2026-09-26T09:00:00Z",
    engines: ["openai"],
    models: { openai: "gpt-5-mini" },
    drawsPerCell: 5,
    costCapUsd: 50,
    jobDescriptions: [
      { id: "T01", lang: "fr", role: "target", source: "client", text },
      { id: "C01", lang: "fr", role: "control", source: "market", text: AD(" Mission SAP.") },
    ],
    prompts: [{ id: "P1", version: 1, lang: "fr", text: "Voici une offre :\n{{JD}}\nTrouve les 5 meilleurs profils." }],
  });

const input = (text: string): PreflightInput => ({
  manifest: manifest(text),
  identity,
  env: {
    OPENAI_API_KEY: "x".repeat(20),
    ANTHROPIC_API_KEY: "y".repeat(20),
    PERPLEXITY_API_KEY: "z".repeat(20),
    PROOFSEEN_ENC_KEY: Buffer.alloc(32, 7).toString("base64"),
  },
  waveExists: false,
  now: new Date("2026-09-26T10:00:00Z"),
  surfaceCheck: {
    identityId: identity.id,
    checkedAt: "2026-09-26T09:00:00Z",
    pages: identity.ownedUrls.map((owned) => ({ url: owned.url, outcome: "clean" as const, kinds: [] })),
  },
});
const check = (text: string) => preflight(input(text)).checks.find((c) => c.name === "job ads")!;

describe("le préflight refuse une offre qui nomme le client", () => {
  it("laisse passer une offre ordinaire", () => {
    expect(check(AD()).status).toBe("ok");
    expect(preflight(input(AD())).go).toBe(true);
  });

  it("refuse une offre qui porte son nom, et dit laquelle", () => {
    const leak = check(AD(" Contacter Camille Dupont."));
    expect(leak.status).toBe("fail");
    expect(leak.detail).toContain("T01");
    expect(leak.detail).toMatch(/rig the measurement/);
    expect(preflight(input(AD(" Contacter Camille Dupont."))).go).toBe(false);
  });

  it("refuse une offre qui porte son domaine", () => {
    expect(check(AD(" Voir camille-dupont.fr pour postuler.")).status).toBe("fail");
  });
});

describe("le même refus se produit à l'entrée, avant toute autre étape", () => {
  let dir: string;
  let jdDir: string;
  const logs: string[] = [];

  const entry = (id: string, role: "target" | "control") => ({
    id,
    label: `Offre ${id}`,
    provenance: role === "target" ? ("client" as const) : ("proofseen" as const),
    role,
    brief: "un développeur full stack TypeScript",
  });

  const run = () =>
    commandClientWave({
      requestPath: join(dir, "request.json"),
      jdDir,
      outPath: join(dir, "manifest.json"),
      identityPath: join(dir, "identity.json"),
      costCapUsd: undefined,
      log: (m) => void logs.push(m),
    });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-leak-"));
    jdDir = join(dir, "offres");
    await mkdir(jdDir, { recursive: true });
    await writeFile(join(dir, "identity.json"), JSON.stringify(identity));
    await writeFile(
      join(dir, "request.json"),
      JSON.stringify({
        client: { displayName: "Camille Dupont", reference: "FR-1AB2C" },
        surface: { readableWithoutJs: true, robotsTxt: true, sitemap: true, structuredData: true, verifiedPlatforms: [] },
        indexation: null,
        jobDescriptions: [entry("T01", "target"), entry("C01", "control")],
        caveats: [],
      }),
    );
    await writeFile(join(jdDir, "C01.txt"), AD(" Mission SAP."));
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("accepte et le dit quand aucune offre ne nomme le client", async () => {
    await writeFile(join(jdDir, "T01.txt"), AD());
    await run();
    expect(logs.join("\n")).toContain("aucune ne nomme le client");
  });

  it("refuse avant de construire quoi que ce soit, en nommant l'offre à remplacer", async () => {
    await writeFile(join(jdDir, "T01.txt"), AD(" Profil idéal : Camille Dupont."));
    await expect(run()).rejects.toThrow(/l'offre T01 nomme le client.*en demander une autre/s);
  });

  it("ne contrôle rien quand aucune identité n'est fournie, plutôt que de faire semblant", async () => {
    await writeFile(join(jdDir, "T01.txt"), AD(" Profil idéal : Camille Dupont."));
    await expect(
      commandClientWave({
        requestPath: join(dir, "request.json"),
        jdDir,
        outPath: join(dir, "manifest.json"),
        costCapUsd: undefined,
        log: (m) => void logs.push(m),
      }),
    ).resolves.toBeDefined();
    // Le filet reste tendu plus loin : `preflight` et `run` refuseront cette vague.
    expect(logs.join("\n")).not.toContain("aucune ne nomme le client");
  });
});
