/*
 * Who sees what in the payment block of a contract, as pure decisions so they can be tested without a page:
 *  - the "pay into escrow" form, for an owner or administrator of the buying company only (the database refuses
 *    anyone else anyway), on an active fixed-price contract with nothing paid yet, and only when payments are open;
 *  - "secure payment opens soon", for the company side while payments are not open;
 *  - after the return from Stripe, a status that follows the webhook, the only source of truth.
 */

export type ContractStatusName = "pending_signatures" | "active" | "completed" | "cancelled";
export type PaymentStatusName = "pending" | "held" | "releasing" | "released" | "refunding" | "refunded" | "disputed" | "failed" | "canceled";

export interface PayContext {
  readonly contractStatus: ContractStatusName;
  readonly side: "freelance" | "company";
  readonly role: "owner" | "admin" | "member" | null;
  readonly billing: "fixed" | "monthly";
  /** The latest payment's status, `null` when the contract was never paid. */
  readonly paymentStatus: PaymentStatusName | null;
  /** Payments are configured end to end and the commission rate is set. */
  readonly checkoutOpen: boolean;
}

/** A payment that can still be (re)started: never paid, abandoned, failed or canceled. Stripe resumes a pending one. */
const PAYABLE: ReadonlySet<PaymentStatusName | null> = new Set([null, "pending", "failed", "canceled"]);

export const isPayer = (ctx: Pick<PayContext, "side" | "role">): boolean => ctx.side === "company" && (ctx.role === "owner" || ctx.role === "admin");

/** The "Payer sous séquestre" form is shown. */
export const showPayForm = (ctx: PayContext): boolean =>
  ctx.checkoutOpen && isPayer(ctx) && ctx.contractStatus === "active" && ctx.billing === "fixed" && PAYABLE.has(ctx.paymentStatus);

/** "Secure payment opens soon": the company side of an unpaid contract, while payments are not open. */
export const showPayClosed = (ctx: PayContext): boolean => !ctx.checkoutOpen && ctx.side === "company" && ctx.paymentStatus === null;

/** What the page says after Stripe sends the person back, read from the payment the webhook updated. */
export type ReturnState = "held" | "processing" | "failed";

export const returnState = (status: PaymentStatusName | null): ReturnState => {
  if (status === "failed" || status === "canceled") return "failed";
  if (status === null || status === "pending") return "processing";
  return "held";
};

/** Stripe's own word on the redirect (`redirect_status`), kept only when it is one of its known values. */
export const redirectStatus = (raw: string | undefined): "succeeded" | "processing" | "failed" | null =>
  raw === "succeeded" || raw === "processing" || raw === "failed" ? raw : null;

export type PayoutState = "none" | "incomplete" | "ready";

/** The freelancer's payout account: not opened, opened but not confirmed by Stripe, or able to receive payouts. */
export const payoutState = (identity: { readonly payoutAccountOpened: boolean; readonly payoutsReady: boolean } | null): PayoutState => {
  if (identity === null) return "none";
  if (identity.payoutsReady) return "ready";
  return identity.payoutAccountOpened ? "incomplete" : "none";
};

/**
 * The theme the payment form takes when it mounts, as the page's tokens decide it: an explicit `data-theme` on the root
 * wins, otherwise the system preference, dark by default (the brand).
 */
export const appearanceTheme = (dataTheme: string | undefined, prefersLight: boolean): "dark" | "light" => {
  if (dataTheme === "dark" || dataTheme === "light") return dataTheme;
  return prefersLight ? "light" : "dark";
};
