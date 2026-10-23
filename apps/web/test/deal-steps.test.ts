import { describe, expect, it } from "vitest";
import { contractFacts, conversationDeal, currentStep, dealSteps, type DealFacts } from "../src/lib/deal-steps";

/*
 * The thread of a deal (CONNECTED_PLAN §2.3, lot 4): one line per step, a date only when the database recorded one, the
 * step in progress with who has to act, and green only for the verified mission the database holds.
 */

const D = (iso: string): Date => new Date(iso);
const SIGNED = D("2026-11-20T10:00:00Z");

const contract = (over: Partial<NonNullable<DealFacts["contract"]>> = {}): NonNullable<DealFacts["contract"]> => ({
  status: "active",
  billing: "fixed",
  signedByFreelanceAt: SIGNED,
  signedByCompanyAt: D("2026-11-19T09:00:00Z"),
  approvals: { count: 0, required: 1 },
  ...over,
});

const facts = (over: Partial<DealFacts> = {}): DealFacts => ({
  conversation: { status: "accepted", decidedAt: D("2026-11-02T08:00:00Z") },
  quotes: { sent: true, accepted: true },
  contract: contract(),
  approvedAt: [],
  payment: null,
  verifiedAt: null,
  ...over,
});

const line = (f: DealFacts) => dealSteps(f).map((s) => `${s.key}:${s.tone}${s.actor === null ? "" : `@${s.actor}`}${s.at === null ? "" : `#${s.at.toISOString().slice(0, 10)}`}`);

describe("the thread of a deal", () => {
  it("before any agreement: the freelancer accepts the contact, the rest is to come", () => {
    expect(line(facts({ conversation: { status: "pending", decidedAt: null }, quotes: { sent: false, accepted: false }, contract: null }))).toEqual([
      "contact:current@freelance",
      "quote:next",
      "signed:next",
      "escrow:next",
      "approved:next",
      "released:next",
      "verified:next",
    ]);
  });

  it("a declined contact stops the thread there, with the day of the decision", () => {
    expect(line(facts({ conversation: { status: "declined", decidedAt: D("2026-11-03T08:00:00Z") }, contract: null }))).toEqual(["contact:stopped#2026-11-03"]);
  });

  it("says who acts on the quote and on the contract, and never dates the accepted quote (the base has no such date)", () => {
    expect(line(facts({ quotes: { sent: false, accepted: false }, contract: null })).slice(0, 2)).toEqual(["contact:done#2026-11-02", "quote:current@freelance"]);
    expect(line(facts({ quotes: { sent: true, accepted: false }, contract: null }))[1]).toBe("quote:current@company");
    expect(line(facts({ contract: null })).slice(1, 3)).toEqual(["quote:done", "signed:current@company"]);
  });

  it("dates the signature with the later of the two, and names the side that has not signed", () => {
    expect(line(facts())[2]).toBe("signed:done#2026-11-20");
    expect(line(facts({ contract: contract({ status: "pending_signatures", signedByFreelanceAt: null }) }))[2]).toBe("signed:current@freelance");
    expect(line(facts({ contract: contract({ status: "pending_signatures", signedByCompanyAt: null }) }))[2]).toBe("signed:current@company");
    expect(line(facts({ contract: contract({ status: "pending_signatures", signedByCompanyAt: null, signedByFreelanceAt: null }) }))[2]).toBe("signed:current");
    expect(line(facts({ contract: contract({ status: "cancelled", signedByCompanyAt: null }) }))).toEqual(["contact:done#2026-11-02", "quote:done", "signed:stopped"]);
  });

  it("asks the company to pay, and leaves the escrow undated once the funds are held", () => {
    expect(line(facts()).slice(3)).toEqual(["escrow:current@company", "approved:next", "released:next", "verified:next"]);
    const held = dealSteps(facts({ payment: { status: "held", releasedAt: null } }));
    expect(held.map((s) => `${s.key}:${s.tone}`).slice(3)).toEqual(["escrow:held", "approved:current", "released:next", "verified:next"]);
    expect(held[3]?.at).toBeNull();
    expect(held[4]).toMatchObject({ actor: "company", note: "approval_due", count: { done: 0, of: 1 } });
    expect(currentStep(held)?.key).toBe("approved");
  });

  it("retries a failed payment and stops on a refund or a dispute", () => {
    expect(dealSteps(facts({ payment: { status: "failed", releasedAt: null } }))[3]).toMatchObject({ tone: "current", note: "pay_failed", actor: "company" });
    expect(dealSteps(facts({ payment: { status: "pending", releasedAt: null } }))[3]).toMatchObject({ tone: "current", note: "pay_pending", actor: null });
    expect(line(facts({ payment: { status: "refunded", releasedAt: null } })).at(-1)).toBe("escrow:stopped");
    expect(line(facts({ payment: { status: "disputed", releasedAt: null } })).at(-1)).toBe("escrow:stopped@proofseen");
  });

  it("dates the approval with the one that reached the number required, and the payout with its own date", () => {
    const completed = contract({ status: "completed", approvals: { count: 2, required: 2 } });
    const approvedAt = [D("2026-12-01T09:00:00Z"), D("2026-12-03T09:00:00Z")];
    expect(line(facts({ contract: completed, approvedAt, payment: { status: "held", releasedAt: null } })).slice(3)).toEqual([
      "escrow:held",
      "approved:done#2026-12-03",
      "released:current@proofseen",
      "verified:next",
    ]);
    expect(line(facts({ contract: completed, approvedAt, payment: { status: "released", releasedAt: D("2026-12-04T10:00:00Z") } })).slice(3)).toEqual([
      "escrow:done",
      "approved:done#2026-12-03",
      "released:done#2026-12-04",
      "verified:next",
    ]);
  });

  it("is green only for the verified mission the database holds, with its date", () => {
    const paid = facts({ contract: contract({ status: "completed", approvals: { count: 1, required: 1 } }), approvedAt: [D("2026-12-01T09:00:00Z")], payment: { status: "released", releasedAt: D("2026-12-04T10:00:00Z") } });
    expect(dealSteps(paid).filter((s) => s.tone === "sealed")).toEqual([]);
    const sealed = dealSteps({ ...paid, verifiedAt: D("2026-12-04T10:00:01Z") });
    expect(sealed.filter((s) => s.tone === "sealed").map((s) => s.key)).toEqual(["verified"]);
    expect(sealed.at(-1)?.at?.toISOString()).toBe("2026-12-04T10:00:01.000Z");
    // A verified mission without its payout is not drawn: the thread stops at the step in progress.
    expect(dealSteps({ ...facts(), verifiedAt: D("2026-12-04T10:00:01Z") }).some((s) => s.tone === "sealed")).toBe(false);
  });

  it("follows no single escrow on a time-and-materials contract", () => {
    expect(line(facts({ contract: contract({ billing: "monthly" }) })).slice(3)).toEqual(["escrow:next", "verified:next"]);
  });

  it("reads a contract without its conversation as born of an accepted contact, undated", () => {
    const steps = dealSteps(contractFacts({ contract: contract(), dates: null }));
    expect(steps[0]).toMatchObject({ key: "contact", tone: "done", at: null });
  });
});

describe("the deal of a conversation", () => {
  const map = new Map([["q-old", "c-old"]]);
  it("is the accepted quote, else the quote waiting, else the latest past contract", () => {
    expect(conversationDeal([{ id: "q2", status: "accepted" }, { id: "q-old", status: "closed" }], new Map([["q2", "c2"], ...map]))).toEqual({ quotes: { sent: false, accepted: true }, contractId: "c2" });
    expect(conversationDeal([{ id: "q3", status: "sent" }, { id: "q-old", status: "closed" }], map)).toEqual({ quotes: { sent: true, accepted: false }, contractId: null });
    expect(conversationDeal([{ id: "q-old", status: "closed" }], map)).toEqual({ quotes: { sent: false, accepted: true }, contractId: "c-old" });
    expect(conversationDeal([{ id: "q4", status: "draft" }], map)).toEqual({ quotes: { sent: false, accepted: false }, contractId: null });
  });
});
