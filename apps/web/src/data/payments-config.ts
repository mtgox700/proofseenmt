import { commissionTermsFromEnv, type CommissionTerms, type LegalSnapshot } from "@proofseen/db";
import { gatewayFromEnv, paymentsSandbox } from "@proofseen/payments";
import { isTestKey, publishableKey } from "../lib/stripe-public";

/*
 * Payment settings that belong to the founder, read from the environment and never defaulted here:
 *  - the commission rate (PROOFSEEN_COMMISSION_BP, in basis points: 1000 = 10 %) — a pricing decision. It is read here,
 *    at the application boundary, when a contract is created (`contractCommissionTerms`, handed to packages/db, which
 *    never reads the environment) and frozen on the contract: the payment route never reads it, so a change of
 *    configuration cannot alter a contract already signed. `checkoutOpen` only tells whether new contracts can be paid;
 *  - Proofseen's own legal identity, printed on commission invoices (PROOFSEEN_LEGAL_NAME, PROOFSEEN_SIRET,
 *    PROOFSEEN_VAT_NUMBER, PROOFSEEN_ADDRESS_LINE1, PROOFSEEN_ADDRESS_POSTAL_CODE, PROOFSEEN_ADDRESS_CITY,
 *    PROOFSEEN_ADDRESS_COUNTRY).
 * Missing settings close the payment routes with a clear answer instead of inventing a value.
 */

/** The commission terms to freeze on a contract created now, or `null` when no rate is configured (that contract cannot be paid). */
export const contractCommissionTerms = (env: Readonly<Record<string, string | undefined>> = process.env): CommissionTerms | null => commissionTermsFromEnv(env);

export const proofseenIdentity = (): LegalSnapshot | null => {
  const read = (name: string): string => (process.env[name] ?? "").trim();
  const legalName = read("PROOFSEEN_LEGAL_NAME");
  const siret = read("PROOFSEEN_SIRET").replace(/\s/g, "");
  const line1 = read("PROOFSEEN_ADDRESS_LINE1");
  const postalCode = read("PROOFSEEN_ADDRESS_POSTAL_CODE");
  const city = read("PROOFSEEN_ADDRESS_CITY");
  const country = read("PROOFSEEN_ADDRESS_COUNTRY");
  if (legalName === "" || !/^\d{14}$/.test(siret) || line1 === "" || postalCode === "" || city === "" || !/^[A-Z]{2}$/.test(country)) return null;
  // La commission est facturée avec TVA : sans numéro de TVA, la facture de commission ne serait pas valable.
  const vat = read("PROOFSEEN_VAT_NUMBER").replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(vat)) return null;
  return { legalName, siret, vatNumber: vat, address: { line1, postalCode, city, country }, vatRateBp: 2000 };
};

type Env = Readonly<Record<string, string | undefined>>;

/** What the payment screens may show: the public key, its mode, and whether a contract can be paid now. */
export interface PaymentsUi {
  readonly publishableKey: string;
  readonly testMode: boolean;
  /** The payment provider is ready on both sides. Whether a given contract can be paid also depends on its own rate: see `checkoutOpenFor`. */
  readonly checkoutOpen: boolean;
}

/**
 * Whether the checkout shows on a contract: the provider is ready AND the contract carries its frozen commission rate.
 * A contract born without a rate can never be paid, whatever the environment says today; one with a rate stays payable
 * if the variable later disappears.
 */
export const checkoutOpenFor = (ui: PaymentsUi | null, contractCommissionBp: number | null): boolean => ui?.checkoutOpen === true && contractCommissionBp !== null;

/**
 * The payment screens open only when the browser and the server agree: a well-formed publishable key
 * (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY), a server key the gateway accepts, and the same mode on both sides — a test
 * publishable key with a live server key (or the reverse) would fail at Stripe, so it closes the screens instead.
 * Only the publishable key leaves this function; the server key never does.
 */
export const paymentsUi = (env: Env = process.env): PaymentsUi | null => {
  const key = publishableKey(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  if (key === null) return null;
  let gatewayReady: boolean;
  try {
    gatewayReady = gatewayFromEnv(env) !== null;
  } catch {
    gatewayReady = false;
  }
  if (!gatewayReady || isTestKey(key) !== paymentsSandbox(env)) return null;
  return { publishableKey: key, testMode: isTestKey(key), checkoutOpen: true };
};
