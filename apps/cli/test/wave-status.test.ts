import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ManifestSchema } from "@proofseen/core";
import { renderWaveStatus } from "../src/wave-status";
import type { ArmRecord, StoredDraw } from "../src/records";

const FORMATS = join(__dirname, "..", "..", "..", ".war-room", "experiment0", "formats");

const draw = (i: number, over: Partial<StoredDraw> = {}): StoredDraw =>
  ({
    id: `d${i}`,
    engine: "openai",
    status: "ok",
    costUsd: 0.02,
    retrieved: false,
    timestamp: "2026-09-23T17:33:52.965Z",
    ...over,
  }) as unknown as StoredDraw;

const status = (draws: StoredDraw[], over: Partial<Parameters<typeof renderWaveStatus>[0]> = {}): string =>
  renderWaveStatus({
    waveId: "J0",
    draws,
    matches: [],
    arms: [],
    sealedFiles: draws.length,
    expected: 780,
    now: new Date("2026-09-24T09:00:00Z"),
    ...over,
  });

describe("wave status", () => {
  it("shows progress, cost per draw and the split per engine", () => {
    const out = status([draw(1), draw(2, { engine: "anthropic", costUsd: 0.03 }), draw(3, { status: "error", costUsd: 0 })]);
    expect(out).toContain("tirages : 3/780 (0.4 %) · 1 en erreur");
    expect(out).toContain("dépensé : 0.05 $ (0.0250 $ par tirage)");
    expect(out).toContain("anthropic   1 ok, 0 erreur(s), 0.03 $");
    expect(out).toContain("openai      1 ok, 1 erreur(s), 0.02 $");
  });

  it("counts a cost per draw on successful draws only, so errors do not make it look cheaper", () => {
    const out = status([draw(1), draw(2, { status: "error", costUsd: 0 })]);
    expect(out).toContain("(0.0200 $ par tirage)");
  });

  it("announces the 72 h purge deadline and the time left", () => {
    const out = status([draw(1)]);
    expect(out).toContain("PURGE DES BRUTS : 2026-09-26T17:33:52.965Z");
    expect(out).toMatch(/56 h \d+ min restantes/);
    expect(out).toContain("lancer `extract` avant cette heure");
  });

  it("says plainly when the deadline is gone, instead of showing a negative countdown", () => {
    const out = status([draw(1)], { now: new Date("2026-09-27T09:00:00Z") });
    expect(out).toContain("DÉPASSÉE");
    expect(out).toContain("trop tard pour ré-extraire");
  });

  it("reports the arms of a three-arm wave when there are any", () => {
    const arms = [
      { drawId: "d1", armId: "arm-A", retrieved: false, cited: false, type: null, rank: null, needsReview: false },
      { drawId: "d1", armId: "arm-B", retrieved: false, cited: true, type: null, rank: null, needsReview: false },
    ] as ArmRecord[];
    expect(status([draw(1)], { arms })).toContain("test à 3 bras : 2 lignes, 2 bras");
    expect(status([draw(1)])).not.toContain("test à 3 bras");
  });
});

describe("wave formats", () => {
  const drawsOf = (m: { engines: unknown[]; jobDescriptions: unknown[]; prompts: unknown[]; drawsPerCell: number }): number =>
    m.engines.length * m.jobDescriptions.length * m.prompts.length * m.drawsPerCell;

  it("keeps the client audit at 150 draws, well under its cap", async () => {
    const m = ManifestSchema.parse(JSON.parse(await readFile(join(FORMATS, "audit-client.json"), "utf8")));
    expect(drawsOf(m)).toBe(150);
    expect(drawsOf(m) * 0.0206).toBeLessThan(m.costCapUsd);
    expect(m.frozenAt).toBeNull();
  });

  it("keeps the cluster panel at 180 draws, shared by every freelancer of the cluster", async () => {
    const m = ManifestSchema.parse(JSON.parse(await readFile(join(FORMATS, "panel-cluster.json"), "utf8")));
    expect(drawsOf(m)).toBe(180);
    expect(m.jobDescriptions.filter((j) => j.role === "control")).toHaveLength(1);
  });
});

describe("après la purge", () => {
  it("ne propose plus d'extraire quand les réponses scellées ont disparu", () => {
    const out = status([draw(1)], { sealedFiles: 0 });
    expect(out).toContain("réponses scellées : aucune (purgées)");
    expect(out).not.toContain("PURGE DES BRUTS");
    expect(out).not.toMatch(/lancer `extract`/);
    expect(out).toContain("les résultats déjà écrits");
  });
});
