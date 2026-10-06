import type { NextResponse } from "next/server";
import { applications, getDb } from "@proofseen/db";
import { caller, fail, ok } from "@/lib/api";

/** The signed-in freelance's applications, newest first, each with its status: an application never goes unanswered. */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    return ok(await applications(getDb()).listMine(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}
