import type { ContractDetail } from "@proofseen/db";

/*
 * The state of the « Documents » tab of an affair (storyboard L1.6, §4 E1), computed once, from facts read in the
 * database, in the order of the storyboard's table. Pure: no clock, no I/O.
 *
 * S0 closed · S6 read error · S5 list · S1 monthly · S1b cancelled · S2a no scope, accepted · S2b no scope, to accept
 * · S3 empty, can prepare · S4 empty, too late.
 *
 * A list (S5) is checked before the empty states: a contract that has documents shows them, whatever else is true; it
 * only loses the action to prepare a new version. Monthly billing comes before the empty states, because its template
 * refuses every monthly contract until the founder's decision D8 (L1-134): no form is offered that can only fail.
 */

/** The facts of the contract the state reads. */
export type AffairContract = Pick<ContractDetail, "status" | "billing" | "scope" | "side" | "signedByFreelanceAt" | "signedByCompanyAt">;

/** Who accepted first, and when: « vous », or the other side named by its role. */
export interface FirstAcceptance {
  readonly by: "you" | "company" | "freelance";
  readonly at: Date;
}

export type AffairState =
  | { readonly kind: "closed" }
  | { readonly kind: "error" }
  | { readonly kind: "list"; readonly canPrepare: boolean; readonly acceptance: FirstAcceptance | null; readonly cancelled: boolean }
  | { readonly kind: "monthly" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "no-scope-accepted" }
  | { readonly kind: "no-scope-pending" }
  | { readonly kind: "empty-preparable" }
  | { readonly kind: "empty-late"; readonly acceptance: FirstAcceptance | null };

export interface AffairFacts {
  readonly vaultOpen: boolean;
  readonly contract: AffairContract;
  /** The documents of the affair, or « error » when they could not be read. */
  readonly documents: readonly unknown[] | "error";
}

/** The earliest acceptance of the contract, if any party has accepted. */
export function firstAcceptance(contract: AffairContract): FirstAcceptance | null {
  const marks: { side: "company" | "freelance"; at: Date }[] = [];
  if (contract.signedByFreelanceAt !== null) marks.push({ side: "freelance", at: contract.signedByFreelanceAt });
  if (contract.signedByCompanyAt !== null) marks.push({ side: "company", at: contract.signedByCompanyAt });
  const first = marks.sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  if (first === undefined) return null;
  return { by: first.side === contract.side ? "you" : first.side, at: first.at };
}

/**
 * Whether a new version may be prepared: the contract waits for acceptance and nobody has accepted, it has a scope, and
 * it is billed at a fixed price (the same rule as `refusalFor` in packages/db, plus the monthly gate of D8).
 */
export function canPrepare(contract: AffairContract): boolean {
  return contract.status === "pending_signatures" && firstAcceptance(contract) === null && contract.scope !== null && contract.billing === "fixed";
}

export function affairState({ vaultOpen, contract, documents }: AffairFacts): AffairState {
  if (!vaultOpen) return { kind: "closed" };
  if (documents === "error") return { kind: "error" };
  const acceptance = firstAcceptance(contract);
  if (documents.length > 0) return { kind: "list", canPrepare: canPrepare(contract), acceptance, cancelled: contract.status === "cancelled" };
  if (contract.billing === "monthly") return { kind: "monthly" };
  if (contract.status === "cancelled") return { kind: "cancelled" };
  if (contract.scope === null) {
    const settled = acceptance !== null || contract.status === "active" || contract.status === "completed";
    return { kind: settled ? "no-scope-accepted" : "no-scope-pending" };
  }
  if (acceptance === null && contract.status === "pending_signatures") return { kind: "empty-preparable" };
  // A scope, no document, and the contract is past acceptance: nothing is written after the fact (L1-019, L1-030). An
  // acceptance date may be missing on an old contract: the state says so without inventing one.
  return { kind: "empty-late", acceptance };
}
