import type { NextResponse } from "next/server";
import { z } from "zod";
import { applications, getDb } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * Moving an application forward: the company shortlists, declines or hires; the freelance withdraws. Each move is
 * only possible from the statuses that allow it, and only by the side it belongs to; anything else answers 404.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const MoveSchema = z.object({ status: z.enum(["shortlisted", "declined", "hired", "withdrawn"]) });
const MOVE_RULE = { windowMs: 60_000, max: 60 };

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("application-move", who.actor.userId, MOVE_RULE, new Date())) return fail("trop de demandes");
  const parsed = MoveSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  const { status } = parsed.data;
  try {
    const repo = applications(getDb());
    const moved = status === "withdrawn" ? await repo.withdraw(who.actor, id) : await repo.decide(who.actor, id, status);
    return moved ? ok({ status }) : fail("introuvable");
  } catch {
    return fail("erreur serveur");
  }
}
