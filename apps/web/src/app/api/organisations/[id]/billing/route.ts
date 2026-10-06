import type { NextResponse } from "next/server";
import { billing, BillingIdentitySchema, getDb } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";

/** A company's legal identity for invoices. Owners and admins only; anyone else gets 404. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 20 };

export async function PUT(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("billing", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = BillingIdentitySchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  const { id } = await context.params;
  try {
    return (await billing(getDb()).setOrganisationIdentity(who.actor, id, parsed.data)) ? ok({ saved: true }) : fail("introuvable");
  } catch {
    return fail("erreur serveur");
  }
}
