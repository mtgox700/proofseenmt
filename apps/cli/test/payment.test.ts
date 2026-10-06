import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commandPayment } from "../src/payment";

/*
 * Le journal des paiements décide de la gate du 27/11 et de ce qui reste dû au 31/12. Ces tests portent sur la seule
 * chose que la CLI ajoute aux règles de `@proofseen/presale` : la lecture du fichier — c'est-à-dire l'endroit où on
 * peut perdre de l'argent déjà encaissé.
 */

let dir = "";
let journalPath = "";
const NOW = new Date("2026-10-01T10:00:00+02:00");
const run = (over: Partial<Parameters<typeof commandPayment>[0]>) =>
  commandPayment({ log: () => undefined, now: () => NOW, journalPath, reference: "pi_AAA", action: "record", offer: "audit", amountCents: 29000, ...over });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proofseen-payment-"));
  journalPath = join(dir, "journal.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("le premier paiement peut s'enregistrer", () => {
  it("traite un journal absent comme un journal vide", async () => {
    const journal = await run({});
    expect(journal.payments).toHaveLength(1);
    expect(existsSync(journalPath)).toBe(true);
  });
});

describe("un journal illisible ne se remplace jamais", () => {
  it("refuse d'écrire par-dessus plutôt que de repartir de zéro", async () => {
    // Repartir d'un journal vide ici effacerait tous les paiements déjà encaissés — la pire perte possible.
    await writeFile(journalPath, '{"version":1,"payments":[ TRONQUÉ');
    await expect(run({})).rejects.toThrow(/illisible/);
  });

  it("laisse le fichier intact après le refus", async () => {
    const corrompu = '{"version":1,"payments":[ TRONQUÉ';
    await writeFile(journalPath, corrompu);
    await expect(run({})).rejects.toThrow();
    expect(await readFile(journalPath, "utf8")).toBe(corrompu);
  });
});

describe("ce que la commande exige avant d'écrire", () => {
  it("refuse d'enregistrer sans offre ni montant", async () => {
    await expect(run({ offer: undefined })).rejects.toThrow(/--offer/);
    await expect(run({ amountCents: undefined })).rejects.toThrow(/--amount-cents/);
  });

  it("ne pose la renonciation que si elle est demandée", async () => {
    // Sans demande expresse écrite, le paiement reste rétractable 14 jours : le poser d'office l'acquerrait à tort.
    expect((await run({})).payments[0]!.earlyStartRequestedAt).toBeNull();
    await rm(journalPath);
    expect((await run({ earlyStart: true })).payments[0]!.earlyStartRequestedAt).toBe(NOW.toISOString());
  });
});
