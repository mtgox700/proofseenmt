import type { NextResponse } from "next/server";
import { getDb, invoices } from "@proofseen/db";
import { caller, fail, ok } from "@/lib/api";

/** Invoices the signed-in person may see: commission invoices are shown to the freelancer only. */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    return ok(await invoices(getDb()).listMine(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}
