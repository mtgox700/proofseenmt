import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, quotes } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/** Moving a quote: the freelancer sends a draft; the company accepts or declines a sent quote. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const ActionSchema = z.object({ action: z.enum(["send", "accept", "decline"]) });
const RULE = { windowMs: 60_000, max: 30 };

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("quote-move", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = ActionSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const repo = quotes(getDb());
    if (parsed.data.action === "send") {
      const sent = await repo.send(who.actor, id);
      return sent === null ? fail("introuvable") : ok(sent);
    }
    const result = await repo.decide(who.actor, id, parsed.data.action === "accept" ? "accepted" : "declined");
    if (result.kind === "already_accepted") return fail("déjà accepté");
    return result.kind === "ok" ? ok(result.quote) : fail("introuvable");
  } catch {
    return fail("erreur serveur");
  }
}
