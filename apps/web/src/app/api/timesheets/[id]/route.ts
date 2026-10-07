import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, timesheets } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/** A company administrator approves or rejects a submitted timesheet. Never the freelancer of the contract. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 60 };
const DecisionSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("timesheet-decision", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = DecisionSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const result = await timesheets(getDb()).decide(who.actor, id, parsed.data.decision, new Date());
    switch (result.kind) {
      case "decided":
        return ok(result.timesheet);
      case "absent":
        return fail("introuvable");
      case "over_cap":
        return fail("plafond de jours dépassé");
    }
  } catch (error) {
    logError("timesheet decision failed", error);
    return fail("erreur serveur");
  }
}
