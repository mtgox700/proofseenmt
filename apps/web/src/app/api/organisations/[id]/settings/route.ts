import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, largeAccounts } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/** The owner sets how many distinct administrators must approve work before the freelancer is paid (1 or 2). */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 20 };
const SettingsSchema = z.object({ approvalLevels: z.union([z.literal(1), z.literal(2)]) });

export async function PUT(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("org-settings", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = SettingsSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    switch (await largeAccounts(getDb()).setApprovalLevels(who.actor, id, parsed.data.approvalLevels)) {
      case "saved":
        return ok({ approvalLevels: parsed.data.approvalLevels });
      case "single_admin":
        return fail("un seul administrateur");
      case "absent":
        return fail("introuvable");
    }
  } catch (error) {
    logError("organisation settings failed", error);
    return fail("erreur serveur");
  }
}
