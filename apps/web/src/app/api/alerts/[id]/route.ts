import type { NextResponse } from "next/server";
import { getDb, missionAlerts } from "@proofseen/db";
import { caller, fail, ok, sameOrigin } from "@/lib/api";

/** Deleting one of one's own mission alerts. Someone else's alert answers 404. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    return (await missionAlerts(getDb()).remove(who.actor, id)) ? ok({ deleted: id }) : fail("introuvable");
  } catch {
    return fail("erreur serveur");
  }
}
