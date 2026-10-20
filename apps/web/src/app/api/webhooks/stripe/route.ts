import { getDb, payments } from "@proofseen/db";
import { toPaymentEvent, verifyStripeSignatureWithAny } from "@proofseen/payments";
import { hasDatabase } from "@/data/intake-sink";
import { logError } from "@/lib/log";

/*
 * Stripe webhook. The raw body is verified against the endpoint secrets before anything is read from it: the platform's
 * (STRIPE_WEBHOOK_SECRET: payments, refunds, disputes) and the connected accounts' (STRIPE_CONNECT_WEBHOOK_SECRET: a
 * freelancer's payout account becoming ready). Both endpoints point here. An unsigned, tampered or stale event answers
 * 400 and changes nothing.
 *
 * A verified event that concerns no tracked payment answers 200: replying with an error would make Stripe retry it for
 * days. Duplicates answer 200 too — the event ledger has already counted them once.
 */

export const runtime = "nodejs";

const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: Request): Promise<Response> {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].map((s) => (s ?? "").trim()).filter((s) => s !== "");
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
    const applied = await payments(getDb()).applyEvent(event, new Date());
    return Response.json({ received: true, applied });
  } catch (error) {
    // 500 makes Stripe retry later, which is what a transient database failure needs.
    logError("stripe webhook failed", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
