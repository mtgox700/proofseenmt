import type { NextResponse } from "next/server";
import { companyApi, getDb } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { accountingExport } from "@/lib/accounting-export";
import { caller, fail } from "@/lib/api";
import { logError } from "@/lib/log";

/** The accounting CSV for a signed-in owner or administrator of the company; anyone else gets 404. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 30 };

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("accounting-export", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const { id } = await context.params;
  try {
    if (!(await companyApi(getDb()).isAdmin(who.actor, id))) return fail("introuvable");
  } catch (error) {
    logError("accounting export failed", error);
    return fail("erreur serveur");
  }
  return accountingExport(id, request);
}
