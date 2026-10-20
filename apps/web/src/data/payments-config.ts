import { MAX_COMMISSION_BP, type LegalSnapshot } from "@proofseen/db";
import { gatewayFromEnv, paymentsSandbox } from "@proofseen/payments";
import { isTestKey, publishableKey } from "../lib/stripe-public";

/*
 * Payment settings that belong to the founder, read from the environment and never defaulted here:
 *  - the commission rate (PROOFSEEN_COMMISSION_BP, in basis points: 1000 = 10 %) — a pricing decision;
 *  - Proofseen's own legal identity, printed on commission invoices (PROOFSEEN_LEGAL_NAME, PROOFSEEN_SIRET,
 *    PROOFSEEN_VAT_NUMBER, PROOFSEEN_ADDRESS_LINE1, PROOFSEEN_ADDRESS_POSTAL_CODE, PROOFSEEN_ADDRESS_CITY,
 *    PROOFSEEN_ADDRESS_COUNTRY).
 * Missing settings close the payment routes with a clear answer instead of inventing a value.
 */

const commissionBpFrom = (env: Readonly<Record<string, string | undefined>>): number | null => {
  const raw = (env.PROOFSEEN_COMMISSION_BP ?? "").trim();
  const value = Number(raw);
  return raw !== "" && Number.isInteger(value) && value >= 1 && value <= MAX_COMMISSION_BP ? value : null;
};

export const commissionBp = (): number | null => commissionBpFrom(process.env);

/** Default loyalty rate (War Room decision, 2026-10-07): 5 % once the company already paid this freelancer. */
const DEFAULT_REPEAT_COMMISSION_BP = 500;

/**
 * The loyalty rate (PROOFSEEN_REPEAT_COMMISSION_BP), applied only when lower than the standard rate. A malformed value
 * falls back to the default rather than to the standard rate: a typo must not silently remove a published discount.
 */
export const repeatCommissionBp = (): number => {
  const raw = (process.env.PROOFSEEN_REPEAT_COMMISSION_BP ?? "").trim();
  const value = Number(raw);
  return raw !== "" && Number.isInteger(value) && value >= 1 && value <= MAX_COMMISSION_BP ? value : DEFAULT_REPEAT_COMMISSION_BP;
};

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
  /** The commission rate is set: the company can pay a contract. Without it, only the payout account opens. */
  readonly checkoutOpen: boolean;
}

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
  return { publishableKey: key, testMode: isTestKey(key), checkoutOpen: commissionBpFrom(env) !== null };
};
