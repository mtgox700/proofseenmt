import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, MissionInputSchema, missions } from "@proofseen/db";
import { notifyMissionChanged } from "@/data/indexnow";
import { hasDatabase } from "@/data/intake-sink";
import { throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * One mission: public read when it is open (GET), edits by a member of its company (PATCH), and its two transitions
 * (POST { action: "publish" | "close" }). A mission the caller may not touch answers 404.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const ActionSchema = z.object({ action: z.enum(["publish", "close"]) });
const EDIT_RULE = { windowMs: 60_000, max: 30 };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  if (!hasDatabase()) return fail("non-configuré");
  const { id } = await context.params;
  try {
    const mission = await missions(getDb()).findPublic(id);
    return mission === null ? fail("introuvable") : ok(mission);
  } catch {
    return fail("erreur serveur");
  }
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("missions-edit", who.actor.userId, EDIT_RULE, new Date())) return fail("trop de demandes");
  const parsed = MissionInputSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  const { id } = await context.params;
  try {
    const result = await missions(getDb()).update(who.actor, id, parsed.data);
    if (result.kind === "locked") return fail("mission verrouillée");
    if (result.kind !== "ok") return fail("introuvable");
    if (result.mission.status === "open") notifyMissionChanged(id);
    return ok(result.mission);
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("missions-edit", who.actor.userId, EDIT_RULE, new Date())) return fail("trop de demandes");
  const parsed = ActionSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const repo = missions(getDb());
    const now = new Date();
    const done = parsed.data.action === "publish" ? await repo.publish(who.actor, id, now) : await repo.close(who.actor, id, now);
    if (!done) return fail("introuvable");
    // Published or closed: either way the engines should come back to this page.
    notifyMissionChanged(id);
    return ok({ action: parsed.data.action });
  } catch {
    return fail("erreur serveur");
  }
}
