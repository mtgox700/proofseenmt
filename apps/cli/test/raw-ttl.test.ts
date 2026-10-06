import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RAW_TTL_MS, parseKey, writeSealed } from "@proofseen/extract";
import { enforceRawTtl } from "../src/raw-ttl";

/*
 * La FAQ publique affirme : « les réponses brutes sont chiffrées puis supprimées au bout de 72 heures ». Jusqu'ici la
 * suppression n'existait que dans la commande `purge` — elle dépendait donc de quelqu'un qui y pense, à propos de
 * données personnelles annoncées comme effacées.
 */

const KEY = parseKey(Buffer.alloc(32, 7).toString("base64"))!;
const MEASURED = new Date("2026-10-24T09:00:00Z");
const AFTER_TTL = new Date(MEASURED.getTime() + RAW_TTL_MS + 60_000);
const BEFORE_TTL = new Date(MEASURED.getTime() + RAW_TTL_MS - 60_000);

describe("le délai de 72 h s'applique tout seul", () => {
  let dir: string;
  const logs: string[] = [];
  const sealedDir = (wave: string) => join(dir, wave, "sealed");
  const remaining = (wave: string) => readdir(sealedDir(wave));

  const seal = async (wave: string, id: string, at: Date) => {
    await mkdir(sealedDir(wave), { recursive: true });
    await writeSealed(sealedDir(wave), id, "réponse du moteur, masquée", KEY, at);
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-ttl-"));
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("supprime les réponses expirées sans qu'on le demande", async () => {
    await seal("J0", "d1", MEASURED);
    const purged = await enforceRawTtl(dir, AFTER_TTL, (m) => void logs.push(m));
    expect(purged).toBe(1);
    expect(await remaining("J0")).toEqual([]);
    expect(logs.join("\n")).toMatch(/72 h/);
  });

  it("ne touche pas une réponse encore dans le délai", async () => {
    await seal("J0", "d1", MEASURED);
    expect(await enforceRawTtl(dir, BEFORE_TTL, (m) => void logs.push(m))).toBe(0);
    expect(await remaining("J0")).toHaveLength(1);
  });

  it("balaie toutes les vagues, pas seulement la dernière", async () => {
    await seal("J0", "d1", MEASURED);
    await seal("AUDIT-FR-1AB2C", "d2", MEASURED);
    expect(await enforceRawTtl(dir, AFTER_TTL, (m) => void logs.push(m))).toBe(2);
  });

  it("reste silencieux quand il n'y a rien à faire : un message à chaque commande cesserait d'être lu", async () => {
    await seal("J0", "d1", MEASURED);
    await enforceRawTtl(dir, BEFORE_TTL, (m) => void logs.push(m));
    expect(logs).toEqual([]);
  });

  it("ne tombe pas quand aucune vague n'existe encore", async () => {
    await expect(enforceRawTtl(join(dir, "inexistant"), AFTER_TTL, (m) => void logs.push(m))).resolves.toBe(0);
  });
});
