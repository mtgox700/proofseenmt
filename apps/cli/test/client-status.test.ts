import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commandClientStatus } from "../src/client-status";
import { commandClientInit } from "../src/client-init";

/*
 * Avec dix dossiers ouverts et une livraison due au 31/12, l'état d'un client ne peut pas se reconstituer en ouvrant
 * cinq fichiers. Ce tableau doit surtout dire **la prochaine action** : une étape oubliée sur un client qui a payé se
 * paie en remboursement.
 */

const NOW = new Date("2026-10-01T09:00:00Z");
const URL = "https://client.example/";

describe("où en est chaque client", () => {
  let dir: string;
  let clients: string;
  let runs: string;
  const logs: string[] = [];

  const status = () => commandClientStatus({ clientsDir: clients, runsDir: runs, reportDir: join(dir, "report"), now: () => NOW, log: (m) => void logs.push(m) });
  const open = (reference: string) =>
    commandClientInit({ reference, displayName: `Client ${reference}`, urls: URL, outDir: clients, log: () => undefined });

  const fill = async (reference: string, over: { verified?: boolean } = {}) => {
    const path = join(clients, reference, "identity.json");
    const identity = JSON.parse(await (await import("node:fs/promises")).readFile(path, "utf8")) as Record<string, unknown> & {
      ownedUrls: { verifiedAt: string | null }[];
    };
    identity.city = "Paris";
    identity.stack = ["TypeScript"];
    if (over.verified === true) identity.ownedUrls[0]!.verifiedAt = "2026-09-30T09:00:00.000Z";
    await writeFile(path, JSON.stringify(identity));
  };

  /** Même convention que la CLI : la trace porte le nom du fichier d'identité. */
  const checkSurface = (reference: string, checkedAt: string) =>
    writeFile(
      join(clients, reference, "identity.surface-check.json"),
      JSON.stringify({ identityId: reference, checkedAt, pages: [{ url: URL, outcome: "clean", kinds: [] }] }),
    );

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-status-"));
    clients = join(dir, "clients");
    runs = join(dir, "runs");
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("dit de remplir le dossier tant qu'il porte des champs en attente", async () => {
    await open("FR-AAAAA");
    const [row] = await status();
    expect(row!.next).toMatch(/remplir identity\.json/);
  });

  it("réclame la preuve de possession avant tout le reste", async () => {
    await open("FR-BBBBB");
    await fill("FR-BBBBB");
    const [row] = await status();
    expect(row!.possession).toBe("0/1");
    expect(row!.next).toMatch(/possession --verify/);
  });

  it("réclame le contrôle de surface une fois la possession prouvée", async () => {
    await open("FR-CCCCC");
    await fill("FR-CCCCC", { verified: true });
    const [row] = await status();
    expect(row!.next).toMatch(/surface-check \(jamais fait\)/);
  });

  it("réclame un nouveau contrôle quand le précédent est périmé", async () => {
    await open("FR-DDDDD");
    await fill("FR-DDDDD", { verified: true });
    await checkSurface("FR-DDDDD", "2026-08-01T09:00:00.000Z");
    const [row] = await status();
    expect(row!.surface).toBe("à refaire");
    expect(row!.next).toMatch(/surface-check/);
  });

  it("passe à la vague une fois la surface contrôlée", async () => {
    await open("FR-EEEEE");
    await fill("FR-EEEEE", { verified: true });
    await checkSurface("FR-EEEEE", "2026-09-30T09:00:00.000Z");
    const [row] = await status();
    expect(row!.surface).toMatch(/^ok/);
    expect(row!.next).toBe("client-wave");
  });

  it("voit un rapport déjà remis et ne réclame plus rien", async () => {
    await open("FR-FFFFF");
    await fill("FR-FFFFF", { verified: true });
    await checkSurface("FR-FFFFF", "2026-09-30T09:00:00.000Z");
    await writeFile(join(clients, "FR-FFFFF", "audit-FR-FFFFF-AUDIT.html"), "<html></html>");
    const [row] = await status();
    expect(row!.report).toBe("remis");
    expect(row!.next).toBe("rien : livré");
    expect(logs.join("\n")).toContain("1/1 rapport(s) remis.");
  });

  it("trouve le rapport là où `audit` l'écrit vraiment, pas seulement dans le dossier du client", async () => {
    // `audit` écrit dans --report-dir (par défaut `report/`). Chercher au seul endroit qui nous arrange ferait dire
    // « à livrer » à un client déjà livré, pour toujours.
    await open("FR-GGGGG");
    await fill("FR-GGGGG", { verified: true });
    await checkSurface("FR-GGGGG", "2026-09-30T09:00:00.000Z");
    await mkdir(join(dir, "report"), { recursive: true });
    await writeFile(join(dir, "report", "audit-FR-GGGGG-AUDIT-FR-GGGGG.html"), "<html></html>");
    const [row] = await status();
    expect(row!.report).toBe("remis");
    expect(row!.next).toBe("rien : livré");
  });

  it("ne confond pas le rapport d'un autre client", async () => {
    await open("FR-HHHHH");
    await fill("FR-HHHHH", { verified: true });
    await checkSurface("FR-HHHHH", "2026-09-30T09:00:00.000Z");
    await mkdir(join(dir, "report"), { recursive: true });
    await writeFile(join(dir, "report", "audit-FR-ZZZZZ-AUDIT-FR-ZZZZZ.html"), "<html></html>");
    const [row] = await status();
    expect(row!.report).toBe("—");
  });

  it("n'invente rien sur un dossier illisible", async () => {
    await mkdir(join(clients, "FR-CASSE"), { recursive: true });
    await writeFile(join(clients, "FR-CASSE", "identity.json"), "{ pas du json");
    const [row] = await status();
    expect(row!.next).toMatch(/illisible/);
    expect(row!.possession).toBe("?");
  });

  it("refuse de travailler sans dossier de clients plutôt que d'afficher un tableau vide", async () => {
    await expect(commandClientStatus({ clientsDir: join(dir, "absent"), runsDir: runs, reportDir: join(dir, "report"), now: () => NOW, log: () => undefined })).rejects.toThrow(
      /n'existe pas/,
    );
  });
});

describe("un fichier illisible est nommé, pas confondu avec un fichier absent", () => {
  let dir = "";
  let clients = "";
  let runs = "";
  const logs: string[] = [];
  const NOW2 = new Date("2026-10-01T09:00:00Z");
  const URL2 = "https://client.example/";

  const status = () => commandClientStatus({ clientsDir: clients, runsDir: runs, reportDir: join(dir, "report"), now: () => NOW2, log: (m) => void logs.push(m) });

  const identity = (reference: string) => ({
    id: reference,
    displayName: `Client ${reference}`,
    nameVariants: [`Client ${reference}`],
    city: "Paris",
    stack: ["TypeScript"],
    ownedUrls: [{ url: URL2, proofMethod: "well_known_file", verifiedAt: "2026-09-30T09:00:00.000Z" }],
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-status-unreadable-"));
    clients = join(dir, "clients");
    runs = join(dir, "runs");
    await mkdir(clients, { recursive: true });
    logs.length = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("affiche « illisible » et refuse de proposer client-wave sur un manifeste corrompu", async () => {
    // Le cœur du défaut : « absente » aurait mené à `client-wave`, qui aurait réécrit par-dessus `frozenAt`.
    const reference = "FR-1AB2C";
    await mkdir(join(clients, reference), { recursive: true });
    await writeFile(join(clients, reference, "identity.json"), JSON.stringify(identity(reference)));
    await writeFile(
      join(clients, reference, "identity.surface-check.json"),
      JSON.stringify({ identityId: reference, checkedAt: "2026-09-28T09:00:00.000Z", pages: [{ url: URL2, outcome: "clean", kinds: [] }] }),
    );
    await writeFile(join(clients, reference, "manifest.json"), '{"waveId":"AUDIT-FR-1AB2C", TRONQUÉ');

    const [row] = await status();
    expect(row!.wave).toBe("illisible");
    expect(row!.next).toBe("manifest.json illisible : réparer ou supprimer à la main");
    expect(row!.next).not.toContain("client-wave");
    expect(logs.join("\n")).toContain("FR-1AB2C : fichier(s) illisible(s) — manifest.json");
  });

  it("distingue une trace de contrôle corrompue d'un contrôle jamais fait", async () => {
    const reference = "FR-2CD3E";
    await mkdir(join(clients, reference), { recursive: true });
    await writeFile(join(clients, reference, "identity.json"), JSON.stringify(identity(reference)));
    await writeFile(join(clients, reference, "identity.surface-check.json"), "{ pas du json");

    const [row] = await status();
    expect(row!.surface).toBe("illisible");
    expect(row!.next).toBe("surface-check (trace illisible)");
  });

  it("dit quels dossiers attendent le client, pour ne pas attendre sans le savoir", async () => {
    const reference = "FR-3EF4G";
    await mkdir(join(clients, reference), { recursive: true });
    await writeFile(join(clients, reference, "identity.json"), JSON.stringify({ ...identity(reference), city: "À RENSEIGNER" }));

    await status();
    expect(logs.join("\n")).toContain("1 dossier(s) attendent le client : FR-3EF4G.");
  });

  it("ne réclame rien quand il n'y a aucun dossier", async () => {
    expect(await status()).toEqual([]);
    expect(logs.join("\n")).toContain("Aucun client dans");
  });
});
