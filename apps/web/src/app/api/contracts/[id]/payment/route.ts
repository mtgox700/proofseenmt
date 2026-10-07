import type { NextResponse } from "next/server";
import { getDb, payments } from "@proofseen/db";
import { gatewayFromEnv } from "@proofseen/payments";
import { commissionBp, repeatCommissionBp } from "@/data/payments-config";
import { throttled } from "@/data/throttle";
import { caller, fail, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * The escrowed payment of a contract: its status (GET, both parties — the commission only to the freelancer) and its
 * opening by the company (POST), which returns the client secret the checkout form needs. Nothing opens while the
 * commission rate or the payment provider is not configured.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 10 };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const status = await payments(getDb()).find(who.actor, id);
    return status === null ? fail("introuvable") : ok(status);
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("payment-open", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const rate = commissionBp();
  let gateway;
  try {
    gateway = gatewayFromEnv(process.env);
  } catch {
    gateway = null;
  }
  if (rate === null || gateway === null) return fail("paiements non configurés");
  const { id } = await context.params;
  try {
    const result = await payments(getDb()).open(who.actor, id, gateway, rate, repeatCommissionBp());
    if (result.kind === "already_paid") return fail("déjà payé");
    if (result.kind === "amount_too_small") return fail("montant trop faible");
    if (result.kind === "absent") return fail("introuvable");
    if (result.kind === "monthly_contract") return fail("paiement par relevé mensuel");
    return ok({ paymentId: result.paymentId, clientSecret: result.clientSecret, amountCents: result.amountCents }, result.kind === "opened" ? 201 : 200);
  } catch (error) {
    logError("payment open failed", error);
    return fail("erreur serveur");
  }
}
