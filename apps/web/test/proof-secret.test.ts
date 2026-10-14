import { describe, expect, it } from "vitest";
import { proofSecret } from "../src/lib/proof-secret";

const LONG = "a".repeat(32);
const OTHER = "b".repeat(48);

describe("le secret des preuves de possession", () => {
  it("prend PROOFSEEN_PROOF_SECRET tel quel quand il est défini, comme la CLI", () => {
    expect(proofSecret({ PROOFSEEN_PROOF_SECRET: OTHER, PROOFSEEN_ACCESS_SECRET: LONG })).toBe(OTHER);
  });

  it("sinon le dérive du secret d'accès sous une étiquette propre : jamais la même clé", () => {
    const derived = proofSecret({ PROOFSEEN_ACCESS_SECRET: LONG });
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).not.toBe(LONG);
    expect(proofSecret({ PROOFSEEN_ACCESS_SECRET: LONG })).toBe(derived);
    expect(proofSecret({ PROOFSEEN_ACCESS_SECRET: OTHER })).not.toBe(derived);
  });

  it("refuse un secret trop court plutôt que d'émettre des jetons devinables", () => {
    expect(proofSecret({})).toBeNull();
    expect(proofSecret({ PROOFSEEN_ACCESS_SECRET: "court" })).toBeNull();
    // Un secret dédié trop court n'est pas remplacé en silence par le secret d'accès.
    expect(proofSecret({ PROOFSEEN_PROOF_SECRET: "court", PROOFSEEN_ACCESS_SECRET: LONG })).toBeNull();
  });
});
