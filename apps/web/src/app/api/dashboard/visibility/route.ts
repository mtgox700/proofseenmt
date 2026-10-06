import type { NextResponse } from "next/server";
import { getDb, visibility } from "@proofseen/db";
import { caller, fail, ok } from "@/lib/api";

/*
 * The signed-in freelancer's measured AI visibility: for each recent wave, the funnel per engine (draws; page
 * retrieved, named, in the top five, cited with certainty) exactly as their audit report published it.
 */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    return ok(await visibility(getDb()).mine(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}
