import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commandGate } from "../src/gate";

const AFTER = new Date("2026-11-28T09:00:00Z");
const BEFORE = new Date("2026-10-15T09:00:00Z");

const payment = (reference: string, over: Record<string, unknown> = {}) => ({
  reference,
  paidAt: "2026-10-01T12:00:00Z",
  offer: "audit",
  amountCents: 4900,
  status: "paid",
  ...over,
});

describe("décompte de la gate, depuis le journal", () => {
  let dir: string;
  let path: string;
  const logs: string[] = [];

  const run = (payments: unknown[], now = AFTER) =>
    writeFile(path, JSON.stringify({ version: 1, payments })).then(() =>
      commandGate({ journalPath: path, log: (m) => void logs.push(m), now: () => now }),
    );

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-gate-"));
    path = join(dir, "journal.json");
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("dit clairement la gate franchie, avec le produit encaissé", async () => {
    await run([...Array(10)].map((_, i) => payment(`p${i}`)));
    const out = logs.join("\n");
    expect(out).toContain("GATE FRANCHIE");
    expect(out).toContain("10/10");
    expect(out).toContain("490,00 €");
  });

  it("dit la gate non franchie et liste ce qu'il faut rembourser", async () => {
    await run([payment("A"), payment("B")]);
    const out = logs.join("\n");
    expect(out).toContain("GATE NON FRANCHIE");
    expect(out).toMatch(/2 paiement\(s\) à rembourser/);
    expect(out).toContain("  A");
    expect(out).toContain("  B");
  });

  it("ne tranche rien avant l'échéance, même si la cible est dépassée", async () => {
    await run([...Array(12)].map((_, i) => payment(`p${i}`)), BEFORE);
    const out = logs.join("\n");
    expect(out).toContain("Échéance non atteinte");
    expect(out).toContain("La cible serait atteinte aujourd'hui");
    expect(out).not.toContain("GATE FRANCHIE");
    expect(out).not.toMatch(/à rembourser/);
  });

  it("montre les provisoires à part, et refuse de les compter", async () => {
    // Un pré-paiement encore rétractable est réel, mais pas acquis : le décompte donne les deux nombres.
    const payments = [...[...Array(9)].map((_, i) => payment(`p${i}`)), payment("frais", { paidAt: "2026-11-27T12:00:00Z" })];
    await run(payments, new Date("2026-11-27T23:30:00Z"));
    const out = logs.join("\n");
    expect(out).toContain("acquis        : 9/10");
    expect(out).toMatch(/provisoires\s+: 1/);
  });

  it("exclut et signale les remboursés, les contestés et les hors délai", async () => {
    await run([
      payment("ok"),
      payment("rendu", { status: "refunded" }),
      payment("conteste", { status: "disputed" }),
      payment("tard", { paidAt: "2026-12-01T12:00:00Z" }),
    ]);
    const out = logs.join("\n");
    for (const label of ["remboursés", "contestés", "hors délai"]) expect(out, label).toContain(label);
  });

  it("montre l'état des livraisons AVANT l'échéance de la gate, pas seulement après", async () => {
    // L'alerte « échéance qui approche » ne sert que tant qu'il reste le temps de livrer.
    await run([payment("A", { deliveredAt: "2026-10-05T12:00:00Z" }), payment("B")], BEFORE);
    const out = logs.join("\n");
    expect(out).toContain("LIVRAISON");
    expect(out).toContain("livrées       : 1/2");
  });

  it("réclame les remboursements dus pour non-livraison une fois le 31/12 passé", async () => {
    await run([payment("A"), payment("B", { deliveredAt: "2026-12-01T12:00:00Z" })], new Date("2027-01-05T12:00:00Z"));
    const out = logs.join("\n");
    expect(out).toContain("ÉCHÉANCE DÉPASSÉE");
    expect(out).toMatch(/sans démarche du client/);
    expect(out).toContain("49,00 € à rembourser : A");
  });

  it("ne parle pas de livraison quand rien n'a été encaissé", async () => {
    await run([], BEFORE);
    expect(logs.join("\n")).not.toContain("LIVRAISON");
  });

  it("refuse un journal invalide plutôt que de compter faux", async () => {
    await writeFile(path, JSON.stringify({ version: 1, payments: [{ reference: "A", paidAt: "hier", offer: "audit", amountCents: 4900, status: "paid" }] }));
    await expect(commandGate({ journalPath: path, log: (m) => void logs.push(m), now: () => AFTER })).rejects.toThrow();
  });
});
