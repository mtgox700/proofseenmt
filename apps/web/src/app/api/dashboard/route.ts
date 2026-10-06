import type { NextResponse } from "next/server";
import { dashboards, getDb } from "@proofseen/db";
import { caller, fail, ok } from "@/lib/api";

/** The signed-in freelancer's dashboard: counted facts only — applications, contracts, money received and held. */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    return ok(await dashboards(getDb()).freelance(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}
