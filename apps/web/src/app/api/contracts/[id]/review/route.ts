import type { NextResponse } from "next/server";
import { getDb, ReviewInputSchema, reviews } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/** A company member reviews the freelancer of a completed, paid contract — once. Anything else answers 404. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 20 };

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("review", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = ReviewInputSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const result = await reviews(getDb()).write(who.actor, id, parsed.data);
    if (result.kind === "already_written") return fail("déjà accepté");
    return result.kind === "written" ? ok(result.review, 201) : fail("introuvable");
  } catch {
    return fail("erreur serveur");
  }
}
