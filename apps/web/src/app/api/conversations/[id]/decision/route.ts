import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, messaging } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * The freelance accepts or declines a company's contact; once accepted, either side may close the thread. All final.
 * Anyone else, or a decision already made, answers 404: the route does not tell a stranger that the conversation
 * exists, nor which way it went.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const DecisionSchema = z.object({ decision: z.enum(["accepted", "declined", "closed"]) });
const DECISION_RULE = { windowMs: 60_000, max: 30 };

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("decision", who.actor.userId, DECISION_RULE, new Date())) return fail("trop de demandes");

  const parsed = DecisionSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const repo = messaging(getDb());
    const { decision } = parsed.data;
    const decided = decision === "closed" ? await repo.close(who.actor, id) : await repo.decide(who.actor, id, decision, new Date());
    return decided ? ok({ status: parsed.data.decision }) : fail("introuvable");
  } catch {
    return fail("erreur serveur");
  }
}
