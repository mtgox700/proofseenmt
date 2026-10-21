import type { NextResponse } from "next/server";
import { getDb, payments } from "@proofseen/db";
import { gatewayFromEnv } from "@proofseen/payments";
import { throttled } from "@/data/throttle";
import { isLang } from "@/i18n";
import { caller, fail, ok, sameOrigin } from "@/lib/api";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * The freelancer's payout account: returns the payment provider's onboarding link, where they give their identity and
 * bank details to the provider directly — Proofseen never sees an IBAN. The account is created on first call (Stripe
 * Accounts v2, `recipient` configuration) and the link is a v2 Account Link; payouts stay off until Stripe reports the
 * `stripe_transfers` capability active (read back on the billing page, before each release, and on account webhooks).
 *
 * Stripe sends the person back to the billing page (`?lang=en` keeps the English one): `versement=retour` when they
 * leave the form, `versement=expire` when the link went stale and a new one must be asked for.
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
  const requested = new URL(request.url).searchParams.get("lang") ?? "fr";
  const page = `${publicBaseUrl(request)}/${isLang(requested) ? requested : "fr"}/app/facturation`;
  try {
    const result = await payments(getDb()).payoutAccount(who.actor, gateway, { returnUrl: `${page}?versement=retour`, refreshUrl: `${page}?versement=expire` });
    if (result.kind === "identity_missing") return fail("identité de facturation requise");
    return result.kind === "link" ? ok({ url: result.url }) : fail("profil requis");
  } catch (error) {
    logError("payout account failed", error);
    return fail("erreur serveur");
  }
}
