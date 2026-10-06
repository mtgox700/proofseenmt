import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentitySchema, PLACEHOLDER_MARKER } from "@proofseen/core";
import { AuditRequestSchema } from "@proofseen/deliverable";
import { commandClientInit } from "../src/client-init";

/*
 * Un squelette de dossier client ne doit jamais ressembler à un dossier prêt. Les champs qu'on ne peut pas deviner
 * sortent marqués, et ces marques font échouer les portails — sans quoi un brief non rempli partirait tel quel dans
 * les formulations envoyées aux moteurs.
 */

describe("ouvrir le dossier d'un client", () => {
  let dir: string;
  const logs: string[] = [];
  const open = (over: Partial<Parameters<typeof commandClientInit>[0]> = {}) =>
    commandClientInit({
      reference: "FR-9K3PM",
      displayName: "Camille Dupont",
      urls: "https://camille-dupont.fr/",
      outDir: dir,
      log: (m) => void logs.push(m),
      ...over,
    });
  const read = async (...parts: string[]) => JSON.parse(await readFile(join(dir, "FR-9K3PM", ...parts), "utf8"));

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-init-"));
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("écrit une identité et une demande valides à leur schéma", async () => {
    await open();
    const identity = IdentitySchema.parse(await read("identity.json"));
    expect(identity.id).toBe("FR-9K3PM");
    expect(identity.ownedUrls).toHaveLength(1);
  });

  it("déduit la méthode de preuve de l'hôte : manuelle sur LinkedIn, automatique ailleurs", async () => {
    await open({ urls: "https://camille-dupont.fr/,https://www.linkedin.com/in/camille" });
    const identity = IdentitySchema.parse(await read("identity.json"));
    expect(identity.ownedUrls.map((owned) => owned.proofMethod)).toEqual(["well_known_file", "profile_token"]);
    expect(logs.join("\n")).toMatch(/1 à vérifier à la main/);
  });

  it("ne date aucune vérification : rien n'est prouvé à l'ouverture", async () => {
    await open();
    const identity = IdentitySchema.parse(await read("identity.json"));
    expect(identity.ownedUrls.every((owned) => owned.verifiedAt === null)).toBe(true);
  });

  it("déclare la surface entièrement fausse : le contrôle dira la vérité, pas ce fichier", async () => {
    await open();
    const request = await read("request.json");
    expect(Object.values(request.surface).filter((v: unknown) => typeof v === "boolean")).toEqual([false, false, false, false]);
    expect(request.indexation).toBeNull();
  });

  it("produit une demande que le schéma REFUSE tant qu'elle n'est pas remplie", async () => {
    // C'est la propriété centrale : un squelette qui franchirait un portail serait pire que pas de squelette.
    await open();
    const parsed = AuditRequestSchema.safeParse(await read("request.json"));
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain(PLACEHOLDER_MARKER);
  });

  it("prépare le bon nombre d'offres, cibles et témoin", async () => {
    await open();
    const request = await read("request.json");
    expect(request.jobDescriptions.filter((jd: { role: string }) => jd.role === "target")).toHaveLength(3);
    expect(request.jobDescriptions.filter((jd: { role: string }) => jd.role === "control")).toHaveLength(1);
  });

  it("explique dans le dossier des offres ce qu'on y dépose et ce qui est refusé", async () => {
    await open();
    const readme = await readFile(join(dir, "FR-9K3PM", "offres", "LISEZ-MOI.md"), "utf8");
    expect(readme).toMatch(/ne doit contenir le nom du client/);
    expect(readme).toMatch(/300 caractères minimum/);
    expect(readme).toMatch(/jamais republiés/);
  });

  it("n'écrase jamais le dossier d'un client en cours", async () => {
    await open();
    await expect(open()).rejects.toThrow(/existe déjà/);
    // Et le dossier d'origine est intact.
    expect(await readdir(join(dir, "FR-9K3PM"))).toContain("identity.json");
  });

  it("refuse une référence qui ne peut pas servir de nom de dossier", async () => {
    for (const reference of ["../evil", "FR 9K3PM", ""]) await expect(open({ reference })).rejects.toThrow();
  });

  it("refuse un client sans aucune URL : il n'y aurait rien à mesurer", async () => {
    await expect(open({ urls: "  ,  " })).rejects.toThrow(/rien à mesurer/);
  });
});
