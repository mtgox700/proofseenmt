import type { NextResponse } from "next/server";
import { z } from "zod";
import { ContractDraftSchema, contracts, getDb } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/** The signed-in person's contracts (GET) and a contract created from an accepted quote (POST, either party). */

export const runtime = "nodejs";

const CreateSchema = z.object({ quoteId: z.uuid(), draft: ContractDraftSchema });
const RULE = { windowMs: 60 * 60_000, max: 20 };

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    return ok(await contracts(getDb()).listMine(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("contracts", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = CreateSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  try {
    const result = await contracts(getDb()).createFromQuote(who.actor, parsed.data.quoteId, {
      startsOn: parsed.data.draft.startsOn.toISOString().slice(0, 10),
      endsOn: parsed.data.draft.endsOn === null ? null : parsed.data.draft.endsOn.toISOString().slice(0, 10),
    });
    switch (result.kind) {
      case "created":
        return ok(result.contract, 201);
      case "seller_identity_missing":
      case "buyer_identity_missing":
        return fail("identité de facturation requise");
      case "already_exists":
        return fail("déjà accepté");
      case "absent":
        return fail("introuvable");
    }
  } catch {
    return fail("erreur serveur");
  }
}
