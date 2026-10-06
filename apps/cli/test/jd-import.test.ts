import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commandJdImport } from "../src/commands";

const AD = [
  "Senior Full Stack TypeScript — freelance, Paris, 6 mois renouvelables.",
  "",
  'Contexte : nous cherchons un "renfort" sur une équipe produit de 8 personnes, base TypeScript en production depuis 4 ans.',
  "Missions : livrer des fonctionnalités de bout en bout, améliorer la couverture de tests, participer aux revues de code,",
  "travailler avec les équipes design et data, tenir la qualité en production (observabilité, correctifs).",
  "Profil : autonomie, expérience confirmée, goût de la mesure. Démarrage rapide souhaité. TJM selon profil.",
].join("\n");

const manifest = (ids: { id: string; role: "target" | "control" }[]) => ({
  version: 1,
  waveId: "J0",
  frozenAt: null,
  engines: ["openai"],
  models: { openai: "gpt-5-mini" },
  drawsPerCell: 5,
  costCapUsd: 70,
  jobDescriptions: ids.map(({ id, role }) => ({ id, lang: "fr", role, source: "market", text: "[À COLLER] Texte intégral de l'offre." })),
  prompts: [{ id: "P1", version: 1, lang: "fr", text: "Voici une offre :\n{{JD}}\nTrouve les 5 meilleurs profils." }],
});

const identity = {
  id: "ayoub",
  displayName: "Ayoub Hammoudi",
  nameVariants: ["Ayoub Hammoudi", "A. Hammoudi"],
  city: "Paris",
  stack: ["TypeScript"],
  ownedUrls: [{ url: "https://ayoub-hammoudi.dev/", proofMethod: "well_known_file", verifiedAt: "2026-09-25T10:00:00Z" }],
};

let dir: string;
let ads: string;
const logs: string[] = [];
const options = () => ({
  log: (m: string) => void logs.push(m),
  manifestPath: join(dir, "manifest.json"),
  identityPath: join(dir, "identity.json"),
  dir: ads,
  outPath: join(dir, "manifest.filled.json"),
});
const filled = async () => JSON.parse(await readFile(join(dir, "manifest.filled.json"), "utf8")) as { jobDescriptions: { id: string; text: string }[] };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proofseen-jd-"));
  ads = join(dir, "offres");
  await mkdir(ads);
  await writeFile(join(dir, "identity.json"), JSON.stringify(identity));
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest([{ id: "T01", role: "target" }, { id: "C01", role: "control" }])));
  logs.length = 0;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("importing the collected job ads", () => {
  it("reads one file per ad, keeping newlines and quotes as they are", async () => {
    await writeFile(join(ads, "T01.txt"), `${AD}\n`);
    await writeFile(join(ads, "C01.md"), AD.replace("TypeScript", "Java Spring Boot"));
    expect(await commandJdImport(options())).toBe(2);
    const jds = (await filled()).jobDescriptions;
    expect(jds.find((j) => j.id === "T01")!.text).toBe(AD);
    expect(jds.find((j) => j.id === "T01")!.text).toContain('"renfort"');
    expect(jds.find((j) => j.id === "C01")!.text).toContain("Java Spring Boot");
  });

  it("says which ads are still missing instead of silently leaving placeholders", async () => {
    await writeFile(join(ads, "T01.txt"), AD);
    expect(await commandJdImport(options())).toBe(1);
    expect(logs.join("\n")).toMatch(/manquantes.*C01/);
    expect((await filled()).jobDescriptions.find((j) => j.id === "C01")!.text).toContain("[À COLLER]");
  });

  it("refuses an ad that names the client, which would inflate his own rank", async () => {
    await writeFile(join(ads, "T01.txt"), `${AD}\nContact : Ayoub Hammoudi.`);
    await expect(commandJdImport(options())).rejects.toThrow(/identité du client/);
  });

  it("refuses an empty file rather than importing nothing", async () => {
    await writeFile(join(ads, "T01.txt"), "   \n");
    await expect(commandJdImport(options())).rejects.toThrow(/est vide/);
  });

  it("never writes over the source manifest unless asked", async () => {
    await writeFile(join(ads, "T01.txt"), AD);
    await commandJdImport(options());
    const source = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as { jobDescriptions: { text: string }[] };
    expect(source.jobDescriptions[0]!.text).toContain("[À COLLER]");
  });
});
