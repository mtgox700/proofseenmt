import type { NextResponse } from "next/server";
import { billing, BillingIdentitySchema, getDb } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/** The freelancer's private billing identity, frozen into every contract and invoice when they are created. */

export const runtime = "nodejs";

const RULE = { windowMs: 60 * 60_000, max: 20 };

export async function PUT(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("billing", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = BillingIdentitySchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  try {
    return (await billing(getDb()).setFreelanceIdentity(who.actor, parsed.data)) ? ok({ saved: true }) : fail("profil requis");
  } catch {
    return fail("erreur serveur");
  }
}
