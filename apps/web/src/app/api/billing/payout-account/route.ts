import type { NextResponse } from "next/server";
import { getDb, payments } from "@proofseen/db";
import { gatewayFromEnv } from "@proofseen/payments";
import { throttled } from "@/data/throttle";
import { caller, fail, ok, sameOrigin } from "@/lib/api";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * The freelancer's payout account: returns the payment provider's onboarding link, where they give their identity and
 * bank details to the provider directly — Proofseen never sees an IBAN. The account is created on first call; payouts
 * stay off until the provider confirms the account (`account.updated` webhook).
 */

export const runtime = "nodejs";

const RULE = { windowMs: 60 * 60_000, max: 10 };

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("payout-account", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  let gateway;
  try {
    gateway = gatewayFromEnv(process.env);
  } catch {
    gateway = null;
  }
  if (gateway === null) return fail("paiements non configurés");
  const base = publicBaseUrl(request);
  try {
    const result = await payments(getDb()).payoutAccount(who.actor, gateway, { returnUrl: `${base}/fr/app`, refreshUrl: `${base}/fr/app` });
    if (result.kind === "identity_missing") return fail("identité de facturation requise");
    return result.kind === "link" ? ok({ url: result.url }) : fail("profil requis");
  } catch (error) {
    console.error("payout account failed", error instanceof Error ? error.name : "unknown");
    return fail("erreur serveur");
  }
}
