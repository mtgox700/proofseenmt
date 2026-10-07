import type { NextResponse } from "next/server";
import { getDb, largeAccounts } from "@proofseen/db";
import { caller, fail, ok } from "@/lib/api";
import { logError } from "@/lib/log";

/**
 * The company's private talent pool: freelancers it already worked with and paid, described by facts, most recent
 * first, never scored. Members of the company only; anyone else gets 404.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const pool = await largeAccounts(getDb()).talentPool(who.actor, id);
    return pool === null ? fail("introuvable") : ok(pool);
  } catch (error) {
    logError("talent pool failed", error);
    return fail("erreur serveur");
  }
}
