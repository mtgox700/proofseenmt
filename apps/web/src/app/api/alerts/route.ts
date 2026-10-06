import type { NextResponse } from "next/server";
import { AlertFiltersSchema, getDb, missionAlerts } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/** The signed-in person's mission alerts (GET) and saving a new one from search filters (POST). */

export const runtime = "nodejs";

const RULE = { windowMs: 60 * 60_000, max: 30 };

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    return ok(await missionAlerts(getDb()).list(who.actor));
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("alerts", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = AlertFiltersSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  try {
    const result = await missionAlerts(getDb()).create(who.actor, parsed.data, new Date());
    return result.kind === "limit" ? fail("trop de demandes") : ok(result.alert, 201);
  } catch {
    return fail("erreur serveur");
  }
}
