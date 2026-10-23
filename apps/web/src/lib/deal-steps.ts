import type { ContractStatusName, PaymentStatusName } from "./pay-section";

/*
 * The thread of a deal (CONNECTED_PLAN §2.3), as a pure decision so it can be tested without a page: one line per step,
 * in order, each with its date when the database recorded one and never otherwise. Steps already done read in ink, the
 * step in progress in amber with who has to act, the next ones on a rule. Only the last one can be green, and only when
 * the verified mission exists in the database: funds paid out are not enough on their own.
 */

export type DealStepKey = "contact" | "quote" | "signed" | "escrow" | "approved" | "released" | "verified";

/** done: ink; current: amber, someone has to act; held: amber, funds waiting in escrow; stopped: the deal ended there. */
export type DealTone = "done" | "current" | "held" | "next" | "stopped" | "sealed";

export type DealActor = "company" | "freelance" | "proofseen";

/** Why a line reads the way it does, when its label alone would not say it. */
export type DealNote =
  | "contact_pending"
  | "contact_declined"
  | "quote_none"
  | "quote_sent"
  | "contract_missing"
  | "signature_company"
  | "signature_freelance"
  | "signature_both"
  | "cancelled"
  | "pay_due"
  | "pay_pending"
  | "pay_failed"
  | "held"
  | "refunding"
  | "refunded"
  | "disputed"
  | "approval_due"
  | "release_due"
  | "releasing"
  | "monthly";

export interface DealStep {
  readonly key: DealStepKey;
  readonly tone: DealTone;
  /** Recorded in the database, or `null`: never a date guessed from another one. */
  readonly at: Date | null;
  readonly actor: DealActor | null;
  readonly note: DealNote | null;
  /** Approvals given and needed, on the approval step of a contract. */
  readonly count?: { readonly done: number; readonly of: number };
}

export interface DealFacts {
  readonly conversation: { readonly status: "pending" | "accepted" | "declined" | "closed"; readonly decidedAt: Date | null } | null;
  /** On a contract, its quote was accepted by definition. */
  readonly quotes: { readonly sent: boolean; readonly accepted: boolean };
  readonly contract: {
    readonly status: ContractStatusName;
    readonly billing: "fixed" | "monthly";
    readonly signedByFreelanceAt: Date | null;
    readonly signedByCompanyAt: Date | null;
    readonly approvals: { readonly count: number; readonly required: number };
  } | null;
  /** The approvals that count, oldest first. */
  readonly approvedAt: readonly Date[];
  readonly payment: { readonly status: PaymentStatusName; readonly releasedAt: Date | null } | null;
  readonly verifiedAt: Date | null;
}

const step = (key: DealStepKey, tone: DealTone, extra: Partial<Omit<DealStep, "key" | "tone">> = {}): DealStep => ({ key, tone, at: null, actor: null, note: null, ...extra });

const later = (a: Date | null, b: Date | null): Date | null => (a === null || b === null ? null : a.getTime() >= b.getTime() ? a : b);

const contactStep = (f: DealFacts): DealStep => {
  const c = f.conversation;
  // A contract without its conversation (the quote was removed) was still born of an accepted contact.
  if (c === null) return step("contact", "done");
  if (c.status === "pending") return step("contact", "current", { actor: "freelance", note: "contact_pending" });
  if (c.status === "declined") return step("contact", "stopped", { at: c.decidedAt, note: "contact_declined" });
  return step("contact", "done", { at: c.decidedAt });
};

const quoteStep = (f: DealFacts): DealStep => {
  if (f.contract !== null || f.quotes.accepted) return step("quote", "done");
  if (f.quotes.sent) return step("quote", "current", { actor: "company", note: "quote_sent" });
  return step("quote", "current", { actor: "freelance", note: "quote_none" });
};

const signedStep = (f: DealFacts): DealStep => {
  const c = f.contract;
  if (c === null) return step("signed", "current", { actor: "company", note: "contract_missing" });
  if (c.status === "cancelled") return step("signed", "stopped", { note: "cancelled" });
  if (c.status !== "pending_signatures") return step("signed", "done", { at: later(c.signedByFreelanceAt, c.signedByCompanyAt) });
  const freelance = c.signedByFreelanceAt === null;
  const company = c.signedByCompanyAt === null;
  if (freelance && company) return step("signed", "current", { note: "signature_both" });
  return step("signed", "current", freelance ? { actor: "freelance", note: "signature_freelance" } : { actor: "company", note: "signature_company" });
};

const escrowStep = (f: DealFacts): DealStep => {
  const status = f.payment?.status ?? null;
  if (status === "released") return step("escrow", "done");
  if (status === "held" || status === "releasing") return step("escrow", "held", { note: "held" });
  if (status === "refunding") return step("escrow", "stopped", { actor: "proofseen", note: "refunding" });
  if (status === "refunded") return step("escrow", "stopped", { note: "refunded" });
  if (status === "disputed") return step("escrow", "stopped", { actor: "proofseen", note: "disputed" });
  if (status === "pending") return step("escrow", "current", { note: "pay_pending" });
  if (status === "failed" || status === "canceled") return step("escrow", "current", { actor: "company", note: "pay_failed" });
  return step("escrow", "current", { actor: "company", note: "pay_due" });
};

const approvedStep = (f: DealFacts, count: { readonly done: number; readonly of: number }): DealStep => {
  // The approval that completed the work is the one that reached the number the company requires.
  if (f.contract?.status === "completed") return step("approved", "done", { at: f.approvedAt[count.of - 1] ?? null, count });
  return step("approved", "current", { actor: "company", note: "approval_due", count });
};

const releasedStep = (f: DealFacts): DealStep => {
  if (f.payment?.status === "released") return step("released", "done", { at: f.payment.releasedAt });
  return step("released", "current", { actor: "proofseen", note: f.payment?.status === "releasing" ? "releasing" : "release_due" });
};

const verifiedStep = (f: DealFacts): DealStep => (f.verifiedAt === null ? step("verified", "next") : step("verified", "sealed", { at: f.verifiedAt }));

const NEXT_AFTER: readonly DealStepKey[] = ["contact", "quote", "signed", "escrow", "approved", "released", "verified"];

/** Steps up to the one in progress, then the remaining ones on a rule. A step that stopped the deal ends the list. */
const close = (reached: readonly DealStep[]): readonly DealStep[] => {
  const last = reached.at(-1);
  if (last === undefined || last.tone === "stopped" || last.tone === "sealed") return reached;
  const rest = NEXT_AFTER.slice(NEXT_AFTER.indexOf(last.key) + 1).map((key) => step(key, "next"));
  return [...reached, ...rest];
};

export const dealSteps = (f: DealFacts): readonly DealStep[] => {
  const contact = contactStep(f);
  if (contact.tone !== "done") return close([contact]);
  const quote = quoteStep(f);
  if (quote.tone !== "done") return close([contact, quote]);
  const signed = signedStep(f);
  if (signed.tone !== "done" || f.contract === null) return close([contact, quote, signed]);
  const head = [contact, quote, signed];
  if (f.contract.billing === "monthly") {
    // Paid month by month on approved timesheets: there is no single escrow to follow here.
    return [...head, step("escrow", "next", { note: "monthly" }), verifiedStep(f)];
  }
  const escrow = escrowStep(f);
  if (escrow.tone !== "done" && escrow.tone !== "held") return close([...head, escrow]);
  const count = { done: Math.min(f.contract.approvals.count, f.contract.approvals.required), of: f.contract.approvals.required };
  const approved = approvedStep(f, count);
  if (approved.tone !== "done") return close([...head, escrow, approved]);
  const released = releasedStep(f);
  if (released.tone !== "done") return close([...head, escrow, approved, released]);
  return [...head, escrow, approved, released, verifiedStep(f)];
};

/** The step someone has to act on, if any: what the head of a page can point to. */
export const currentStep = (steps: readonly DealStep[]): DealStep | null => steps.find((s) => s.tone === "current") ?? null;

/** What the contract page and the conversation both know of a contract, in the shape of the thread. */
export interface ContractFactsInput {
  readonly contract: NonNullable<DealFacts["contract"]>;
  readonly dates: {
    readonly conversation: DealFacts["conversation"];
    readonly approvedAt: readonly Date[];
    readonly payment: DealFacts["payment"];
    readonly verifiedAt: Date | null;
  } | null;
}

/** The facts of a contract: its quote was accepted by definition, everything else is read in the database. */
export const contractFacts = ({ contract, dates }: ContractFactsInput): DealFacts => ({
  conversation: dates?.conversation ?? null,
  quotes: { sent: true, accepted: true },
  contract: {
    status: contract.status,
    billing: contract.billing,
    signedByFreelanceAt: contract.signedByFreelanceAt,
    signedByCompanyAt: contract.signedByCompanyAt,
    approvals: contract.approvals,
  },
  approvedAt: dates?.approvedAt ?? [],
  payment: dates?.payment ?? null,
  verifiedAt: dates?.verifiedAt ?? null,
});

export interface QuoteLike {
  readonly id: string;
  readonly status: "draft" | "sent" | "accepted" | "declined" | "superseded" | "closed";
}

/**
 * The deal a conversation is about, its quotes newest first: the accepted quote (and its contract once created), else a
 * quote waiting for the company, else the latest past deal that has its contract (its quote is closed once the contract
 * is over), else nothing agreed yet.
 */
export const conversationDeal = (quotes: readonly QuoteLike[], contractOf: ReadonlyMap<string, string>): { readonly quotes: DealFacts["quotes"]; readonly contractId: string | null } => {
  const sent = quotes.some((q) => q.status === "sent");
  const accepted = quotes.find((q) => q.status === "accepted");
  if (accepted !== undefined) return { quotes: { sent, accepted: true }, contractId: contractOf.get(accepted.id) ?? null };
  if (sent) return { quotes: { sent, accepted: false }, contractId: null };
  const past = quotes.find((q) => contractOf.has(q.id));
  if (past !== undefined) return { quotes: { sent: false, accepted: true }, contractId: contractOf.get(past.id) ?? null };
  return { quotes: { sent: false, accepted: false }, contractId: null };
};
