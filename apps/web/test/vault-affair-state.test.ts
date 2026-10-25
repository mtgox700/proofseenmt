import { describe, expect, it } from "vitest";
import { affairState, canPrepare, firstAcceptance, type AffairContract } from "../src/lib/vault/affair-state";

/*
 * L1.6, T3: the state of the « Documents » tab of an affair (storyboard §4 E1), a table of cases in the storyboard's
 * order. Example contracts only.
 */

const at = (day: string) => new Date(`${day}T10:00:00Z`);
const base: AffairContract = { status: "pending_signatures", billing: "fixed", scope: "Refonte du site d'exemple", side: "company", signedByFreelanceAt: null, signedByCompanyAt: null };
const state = (contract: Partial<AffairContract> = {}, documents: readonly unknown[] | "error" = [], vaultOpen = true) => affairState({ vaultOpen, contract: { ...base, ...contract }, documents });
const DOC = [{ id: "d1" }];

describe("the state of the Documents tab (E1), in the storyboard's order", () => {
  it.each([
    ["S0 closed, before anything else, even with documents and a read error", state({}, "error", false), "closed"],
    ["S6 read error", state({}, "error"), "error"],
    ["S5 a list as soon as there is a document", state({}, DOC), "list"],
    ["S1 monthly billing, the D8 gate, before the empty states", state({ billing: "monthly" }), "monthly"],
    ["S1b cancelled, without documents", state({ status: "cancelled" }), "cancelled"],
    ["S2a no scope, accepted by a party", state({ scope: null, signedByFreelanceAt: at("2026-10-21") }), "no-scope-accepted"],
    ["S2a no scope, contract active", state({ scope: null, status: "active" }), "no-scope-accepted"],
    ["S2a no scope, contract completed", state({ scope: null, status: "completed" }), "no-scope-accepted"],
    ["S2b no scope, to accept, nobody accepted", state({ scope: null }), "no-scope-pending"],
    ["S3 empty, can prepare", state(), "empty-preparable"],
    ["S4 empty, accepted already", state({ signedByCompanyAt: at("2026-10-25") }), "empty-late"],
  ] as const)("%s", (_, result, kind) => {
    expect(result.kind).toBe(kind);
  });

  it("puts monthly billing before the empty states, and a list before monthly billing", () => {
    expect(state({ billing: "monthly", scope: null }).kind).toBe("monthly");
    expect(state({ billing: "monthly" }, DOC)).toEqual({ kind: "list", canPrepare: false, acceptance: null, cancelled: false });
  });

  it("lists a cancelled contract's documents without the action to prepare", () => {
    expect(state({ status: "cancelled" }, DOC)).toEqual({ kind: "list", canPrepare: false, acceptance: null, cancelled: true });
  });

  it("offers to prepare only while the contract waits, nobody accepted, with a scope, at a fixed price", () => {
    expect(canPrepare(base)).toBe(true);
    expect(canPrepare({ ...base, signedByFreelanceAt: at("2026-10-24") })).toBe(false);
    expect(canPrepare({ ...base, scope: null })).toBe(false);
    expect(canPrepare({ ...base, billing: "monthly" })).toBe(false);
    expect(canPrepare({ ...base, status: "active" })).toBe(false);
    expect(state({}, DOC)).toEqual({ kind: "list", canPrepare: true, acceptance: null, cancelled: false });
  });

  it("names the first acceptance: you, or the other side by its role, with its date", () => {
    expect(firstAcceptance(base)).toBeNull();
    expect(firstAcceptance({ ...base, signedByCompanyAt: at("2026-10-25"), signedByFreelanceAt: at("2026-10-24") })).toEqual({ by: "freelance", at: at("2026-10-24") });
    expect(firstAcceptance({ ...base, signedByCompanyAt: at("2026-10-25") })).toEqual({ by: "you", at: at("2026-10-25") });
    expect(firstAcceptance({ ...base, side: "freelance", signedByCompanyAt: at("2026-10-25") })).toEqual({ by: "company", at: at("2026-10-25") });
    expect(state({ signedByCompanyAt: at("2026-10-25") })).toEqual({ kind: "empty-late", acceptance: { by: "you", at: at("2026-10-25") } });
  });

  it("never invents an acceptance date: a scope past acceptance without a recorded one stays without", () => {
    expect(state({ status: "active" })).toEqual({ kind: "empty-late", acceptance: null });
  });
});
