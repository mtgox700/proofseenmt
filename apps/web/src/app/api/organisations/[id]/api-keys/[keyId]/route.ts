import type { NextResponse } from "next/server";
import { apiKeys, getDb } from "@proofseen/db";
import { caller, fail, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/** Revokes one of the company's API keys, for good. Owners and administrators only. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string; readonly keyId: string }>;
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id, keyId } = await context.params;
  try {
    return (await apiKeys(getDb()).revoke(who.actor, id, keyId, new Date())) ? ok({ revoked: true }) : fail("introuvable");
  } catch (error) {
    logError("api key revoke failed", error);
    return fail("erreur serveur");
  }
}
