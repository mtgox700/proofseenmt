import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, NOTIFICATION_KINDS, notifications } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/** Which e-mails the signed-in person receives (GET), and switching one kind on or off (PUT). */

export const runtime = "nodejs";

const PreferenceSchema = z.object({ kind: z.enum(NOTIFICATION_KINDS), email: z.boolean() });
const RULE = { windowMs: 60_000, max: 30 };

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    return ok(await notifications(getDb()).preferences(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("preferences", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = PreferenceSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  try {
    const repo = notifications(getDb());
    await repo.setPreference(who.actor, parsed.data.kind, parsed.data.email);
    return ok(await repo.preferences(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}
