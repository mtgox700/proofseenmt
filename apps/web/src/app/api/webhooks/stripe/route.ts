import { getDb, payments, type PaymentEvent } from "@proofseen/db";
import { gatewayFromEnv, toPaymentEvent, verifyStripeSignatureWithAny, type WebhookEvent } from "@proofseen/payments";
import { hasDatabase } from "@/data/intake-sink";
import { logError } from "@/lib/log";

/*
 * Stripe webhook. The raw body is verified against the destination secrets before anything is read from it: the
 * platform's (STRIPE_WEBHOOK_SECRET: payments, refunds, disputes), the connected accounts' v1 snapshots
 * (STRIPE_CONNECT_WEBHOOK_SECRET: `account.updated`) and the v2 thin events of payout accounts
 * (STRIPE_ACCOUNTS_WEBHOOK_SECRET: `v2.core.account[...]`). All three destinations point here. An unsigned, tampered or
 * stale event answers 400 and changes nothing.
 *
 * A payout account event carries no state we trust: thin events only reference the account, and a v1 snapshot of a v2
 * account does not show the `stripe_transfers` capability. The account is read back from Stripe (Accounts v2) and that
 * state is what gets recorded.
 *
 * A verified event that concerns no tracked payment answers 200: replying with an error would make Stripe retry it for
 * days. Duplicates answer 200 too — the event ledger has already counted them once.
 */

export const runtime = "nodejs";

const MAX_BODY_BYTES = 512 * 1024;

const SECRET_NAMES = ["STRIPE_WEBHOOK_SECRET", "STRIPE_CONNECT_WEBHOOK_SECRET", "STRIPE_ACCOUNTS_WEBHOOK_SECRET"] as const;

/** The event to record: a payout account signal becomes `account.updated` with the state Stripe holds right now. */
const resolve = async (event: WebhookEvent): Promise<PaymentEvent> => {
  if (event.type !== "account.signal") return event;
  const gateway = gatewayFromEnv(process.env);
  if (gateway === null) throw new Error("paiements non configurés");
  return { id: event.id, type: "account.updated", accountId: event.accountId, payoutsEnabled: await gateway.payoutAccountReady(event.accountId) };
};

export async function POST(request: Request): Promise<Response> {
  const secrets = SECRET_NAMES.map((name) => (process.env[name] ?? "").trim()).filter((s) => s !== "");
  if (secrets.length === 0 || !hasDatabase()) return new Response("non configuré", { status: 503 });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return new Response("trop volumineux", { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("trop volumineux", { status: 413 });

  const verified = verifyStripeSignatureWithAny(raw, request.headers.get("stripe-signature"), secrets, Date.now());
  if (!verified.ok) return new Response(verified.reason, { status: 400 });

  const event = toPaymentEvent(verified.payload);
  if (event === null) return Response.json({ received: true, applied: "ignored" });
  try {
    const applied = await payments(getDb()).applyEvent(await resolve(event), new Date());
    return Response.json({ received: true, applied });
  } catch (error) {
    // 500 makes Stripe retry later, which is what a transient database or Stripe failure needs.
    logError("stripe webhook failed", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
