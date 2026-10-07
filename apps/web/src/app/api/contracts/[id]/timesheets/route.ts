import type { NextResponse } from "next/server";
import { getDb, TimesheetInputSchema, timesheets } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * Monthly timesheets of a time-and-materials contract. GET lists them for both parties; POST is the freelancer
 * declaring or correcting a month (before the decision, or after a rejection). Anyone else gets 404.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 30 };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const list = await timesheets(getDb()).list(who.actor, id);
    return list === null ? fail("introuvable") : ok(list);
  } catch (error) {
    logError("timesheets list failed", error);
    return fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("timesheet", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = TimesheetInputSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  const { id } = await context.params;
  try {
    const result = await timesheets(getDb()).submit(who.actor, id, parsed.data, new Date());
    switch (result.kind) {
      case "submitted":
        return ok(result.timesheet, 201);
      case "absent":
        return fail("introuvable");
      case "out_of_period":
        return fail("hors de la période du contrat");
      case "locked":
        return fail("relevé déjà validé");
      case "implausible":
        return fail("relevé invraisemblable");
    }
  } catch (error) {
    logError("timesheet submission failed", error);
    return fail("erreur serveur");
  }
}
