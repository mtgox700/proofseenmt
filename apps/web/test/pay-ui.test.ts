import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutOpenFor, contractCommissionTerms, paymentsUi } from "../src/data/payments-config";
import { contrastRatio, PALETTE } from "@proofseen/brand";
import { isPayer, payoutState, redirectStatus, returnState, showPayClosed, showPayForm, type PayContext } from "../src/lib/pay-section";
import { stripeAppearance } from "../src/lib/stripe-appearance";
import { isStripeOnboardingUrl, isTestKey, publishableKey, STRIPE_JS_URL } from "../src/lib/stripe-public";
import { billingEn } from "../src/i18n/market/billing-en";
import { billingFr } from "../src/i18n/market/billing-fr";
import { dealsEn } from "../src/i18n/market/deals-en";
import { dealsFr } from "../src/i18n/market/deals-fr";

/*
 * The payment screens (C24): who sees the escrow form, the payout account's states, the test-mode note, the switch
 * that keeps everything closed without a publishable key, and the guard that no Stripe secret can reach the browser.
 */

const OPEN: PayContext = { contractStatus: "active", side: "company", role: "owner", billing: "fixed", paymentStatus: null, checkoutOpen: true };

describe("escrow payment section", () => {
  it("shows for an owner or an administrator of the buying company, on an active unpaid contract, payments open", () => {
    expect(showPayForm(OPEN)).toBe(true);
    expect(showPayForm({ ...OPEN, role: "admin" })).toBe(true);
  });

  it("is hidden for the freelancer and for plain members", () => {
    expect(showPayForm({ ...OPEN, side: "freelance", role: null })).toBe(false);
    expect(showPayForm({ ...OPEN, role: "member" })).toBe(false);
    expect(showPayForm({ ...OPEN, role: null })).toBe(false);
    expect(isPayer({ side: "freelance", role: "owner" })).toBe(false);
  });

  it("is hidden while payments are not configured, and says they open soon to the company only", () => {
    const closed = { ...OPEN, checkoutOpen: false };
    expect(showPayForm(closed)).toBe(false);
    expect(showPayClosed(closed)).toBe(true);
    expect(showPayClosed({ ...closed, side: "freelance", role: null })).toBe(false);
    expect(showPayClosed(OPEN)).toBe(false);
  });

  it("is hidden once paid, before signature, after completion, and for monthly contracts", () => {
    for (const status of ["held", "releasing", "released", "refunding", "refunded", "disputed"] as const) expect(showPayForm({ ...OPEN, paymentStatus: status })).toBe(false);
    expect(showPayForm({ ...OPEN, contractStatus: "pending_signatures" })).toBe(false);
    expect(showPayForm({ ...OPEN, contractStatus: "completed" })).toBe(false);
    expect(showPayForm({ ...OPEN, billing: "monthly" })).toBe(false);
  });

  it("can be taken up again after an abandoned, failed or canceled payment", () => {
    for (const status of ["pending", "failed", "canceled"] as const) expect(showPayForm({ ...OPEN, paymentStatus: status })).toBe(true);
  });

  it("reads the return from Stripe from the stored status, not from the redirect", () => {
    expect(returnState(null)).toBe("processing");
    expect(returnState("pending")).toBe("processing");
    expect(returnState("held")).toBe("held");
    expect(returnState("failed")).toBe("failed");
    expect(returnState("canceled")).toBe("failed");
    expect(redirectStatus("succeeded")).toBe("succeeded");
    expect(redirectStatus("<script>")).toBeNull();
    expect(redirectStatus(undefined)).toBeNull();
  });
});

describe("payout account section", () => {
  it("is none, incomplete or ready", () => {
    expect(payoutState(null)).toBe("none");
    expect(payoutState({ payoutAccountOpened: false, payoutsReady: false })).toBe("none");
    expect(payoutState({ payoutAccountOpened: true, payoutsReady: false })).toBe("incomplete");
    expect(payoutState({ payoutAccountOpened: true, payoutsReady: true })).toBe("ready");
  });

  it("only follows a Stripe address", () => {
    expect(isStripeOnboardingUrl("https://connect.stripe.com/setup/e/acct_1/abc")).toBe(true);
    expect(isStripeOnboardingUrl("http://connect.stripe.com/setup")).toBe(false);
    expect(isStripeOnboardingUrl("https://stripe.com.evil.example/setup")).toBe(false);
    expect(isStripeOnboardingUrl("javascript:alert(1)")).toBe(false);
    expect(isStripeOnboardingUrl(42)).toBe(false);
  });
});

describe("payment configuration", () => {
  const ENV = { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_51Abc", STRIPE_SECRET_KEY: "rk_test_51Secret", PROOFSEEN_COMMISSION_BP: "1000" };

  it("opens in test mode with a test key on both sides, and hands out only the publishable key", () => {
    const ui = paymentsUi(ENV);
    expect(ui).toEqual({ publishableKey: "pk_test_51Abc", testMode: true, checkoutOpen: true });
    expect(JSON.stringify(ui)).not.toContain("Secret");
  });

  it("stays closed without a publishable key, with a malformed one, or without a server key", () => {
    expect(paymentsUi({ ...ENV, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined })).toBeNull();
    expect(paymentsUi({ ...ENV, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "" })).toBeNull();
    expect(paymentsUi({ ...ENV, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "sk_test_51Abc" })).toBeNull();
    expect(paymentsUi({ ...ENV, STRIPE_SECRET_KEY: undefined })).toBeNull();
  });

  it("stays closed when the two keys are not in the same mode", () => {
    expect(paymentsUi({ ...ENV, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_51Abc" })).toBeNull();
    expect(paymentsUi({ ...ENV, STRIPE_SECRET_KEY: "rk_live_51Secret" })).toBeNull();
    expect(paymentsUi({ ...ENV, STRIPE_SECRET_KEY: "rk_live_51Secret", PROOFSEEN_PAYMENTS_LIVE: "GO" })).toBeNull();
  });

  it("does not read the commission rate from the environment: the contract's frozen rate decides whether it can be paid", () => {
    expect(paymentsUi({ ...ENV, PROOFSEEN_COMMISSION_BP: undefined })).toEqual({ publishableKey: "pk_test_51Abc", testMode: true, checkoutOpen: true });
    expect(paymentsUi({ ...ENV, PROOFSEEN_COMMISSION_BP: "2500" })).toEqual(paymentsUi(ENV));
    const ui = paymentsUi(ENV);
    expect(checkoutOpenFor(ui, 1000)).toBe(true);
    // A contract born without a rate can never be paid: no Pay button, whatever the environment says today.
    expect(checkoutOpenFor(ui, null)).toBe(false);
    // And a contract with a rate stays payable if the variable later disappears.
    expect(checkoutOpenFor(paymentsUi({ ...ENV, PROOFSEEN_COMMISSION_BP: undefined }), 1000)).toBe(true);
    expect(checkoutOpenFor(null, 1000)).toBe(false);
  });

  it("hands the environment's commission terms to the code that creates contracts, nowhere else", () => {
    expect(contractCommissionTerms({ PROOFSEEN_COMMISSION_BP: "1000" })).toEqual({ commissionBp: 1000, repeatCommissionBp: 500 });
    expect(contractCommissionTerms({})).toBeNull();
    for (const file of ["app/api/contracts/route.ts", "app/[lang]/app/messages/quote-actions.ts"]) {
      expect(readFileSync(join(SRC, file), "utf8")).toContain("commissionTerms: () => contractCommissionTerms()");
    }
    // The contract page opens the checkout from the contract's own rate.
    expect(readFileSync(join(SRC, "app/[lang]/app/contrats/[id]/page.tsx"), "utf8")).toContain("checkoutOpenFor(ui, contract.commissionBp)");
    // The payment route reads the contract, never the environment, for the rate.
    const payment = readFileSync(join(SRC, "app/api/contracts/[id]/payment/route.ts"), "utf8");
    expect(payment).not.toMatch(/COMMISSION_BP|commissionTermsFromEnv|contractCommissionTerms/);
  });

  it("detects test mode from the publishable key prefix", () => {
    expect(isTestKey("pk_test_51Abc")).toBe(true);
    expect(isTestKey("pk_live_51Abc")).toBe(false);
    expect(publishableKey(" pk_live_51Abc ")).toBe("pk_live_51Abc");
    expect(STRIPE_JS_URL).toBe("https://js.stripe.com/v3");
  });
});

describe("payment strings", () => {
  it("carry the test-mode notes in both languages", () => {
    expect(dealsFr.contracts.pay.client.testMode).toBe("Mode test\u202f: aucune somme réelle n'est débitée.");
    expect(dealsEn.contracts.pay.client.testMode).toContain("Test mode");
    expect(billingFr.payouts.testMode).toContain("Mode test");
    expect(billingEn.payouts.testMode).toContain("Test mode");
    expect(dealsFr.contracts.payClosed).toContain("ouvre bientôt");
  });

  it("hand the client components plain strings only: a function cannot cross into a client component", () => {
    const plain = (value: unknown): boolean => typeof value === "string" || (typeof value === "object" && value !== null && Object.values(value).every(plain));
    for (const deals of [dealsFr, dealsEn]) {
      expect(plain(deals.contracts.pay.client)).toBe(true);
      expect(plain(deals.contracts.pay.returned)).toBe(true);
      expect(deals.contracts.pay.client.amountDue).toContain("{amount}");
    }
    for (const billing of [billingFr, billingEn]) expect(plain(billing.payouts)).toBe(true);
  });
});

describe("the Stripe form in the page's colours", () => {
  const set = stripeAppearance();

  it("draws its one set from the dark palette, never the proof green", () => {
    const p = PALETTE.dark;
    const { variables, rules } = set;
    expect(variables).toMatchObject({ colorBackground: p.bg, colorText: p.text, colorDanger: p.danger, borderRadius: "6px", fontSizeBase: "16px" });
    expect(rules[".Input"]?.border).toBe(`1px solid ${p.lineStrong}`);
    expect(rules[".Input:focus"]?.boxShadow).toBe(`0 0 0 2px ${p.focus}`);
    expect(JSON.stringify(set).toLowerCase()).not.toContain(p.proof.toLowerCase());
    // Edges of the fields at 3:1, text and labels at 4.5:1, the focus ring at 3:1 on the form's background.
    expect(contrastRatio(p.lineStrong, p.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.focus, p.bg)).toBeGreaterThanOrEqual(3);
    for (const fg of [p.text, p.muted, p.faint, p.danger]) expect(contrastRatio(fg, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(set.theme).toBe("night");
  });

  it("is handed to the form as plain strings, so the palette never ships to the browser", () => {
    const plain = (value: unknown): boolean => typeof value === "string" || (typeof value === "object" && value !== null && Object.values(value).every(plain));
    expect(plain(set)).toBe(true);
    const form = readFileSync(join(__dirname, "..", "src", "components", "market", "EscrowPayment.tsx"), "utf8");
    expect(form).not.toMatch(/from ["']@proofseen\/brand["']/);
    expect(form).toMatch(/import type \{ StripeAppearance \} from "@\/lib\/stripe-appearance"/);
  });

  it("mounts dark whatever the system asks: no theme is read in the browser", () => {
    const form = readFileSync(join(__dirname, "..", "src", "components", "market", "EscrowPayment.tsx"), "utf8");
    expect(form).not.toMatch(/prefers-color-scheme|dataset\.theme|data-theme/);
    expect(form).toContain("locale: lang, appearance });");
  });
});

/** Every file that runs in the browser: client components, and what they import from `src/lib`. */
const SRC = join(__dirname, "..", "src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
const CLIENT = files(SRC).filter((file) => /^["']use client["']/.test(readFileSync(file, "utf8").trimStart()));
const BROWSER = [...CLIENT, ...["stripe-public.ts", "stripe-js.ts", "pay-section.ts"].map((name) => join(SRC, "lib", name))];

describe("no Stripe secret in the browser", () => {
  it("finds the payment client components", () => {
    const names = CLIENT.map((file) => file.replace(/\\/g, "/"));
    for (const name of ["EscrowPayment.tsx", "PaymentReturn.tsx", "PayoutAccountButton.tsx"]) expect(names.some((file) => file.endsWith(name))).toBe(true);
  });

  for (const file of BROWSER) {
    it(`${file.slice(SRC.length + 1).replace(/\\/g, "/")} holds no secret key and no server-side payment module`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("STRIPE_SECRET_KEY");
      expect(source).not.toContain("WEBHOOK_SECRET");
      expect(source).not.toMatch(/\b(sk|rk)_(test|live)/);
      expect(source).not.toMatch(/from ["'](@proofseen\/payments|@\/data\/payments-config)["']/);
      expect(source.match(/process\.env\.\w+/g)?.filter((name) => !name.startsWith("process.env.NEXT_PUBLIC_")) ?? []).toEqual([]);
    });
  }
});
