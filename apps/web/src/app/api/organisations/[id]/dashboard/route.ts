import type { NextResponse } from "next/server";
import { dashboards, getDb } from "@proofseen/db";
import { caller, fail, ok } from "@/lib/api";

/** A company's dashboard, for its members only: missions, applications, contracts, spend and mission invoices. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const board = await dashboards(getDb()).company(who.actor, id);
    return board === null ? fail("introuvable") : ok(board);
  } catch {
    return fail("erreur serveur");
  }
}
