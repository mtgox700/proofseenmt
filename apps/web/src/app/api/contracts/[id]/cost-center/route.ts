import type { NextResponse } from "next/server";
import { z } from "zod";
import { CostCenterSchema, getDb, largeAccounts } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/** A company administrator assigns a contract to one of its cost centres (or clears it), until the mission is invoiced. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 60 };
const BodySchema = z.object({ costCenter: CostCenterSchema });

export async function PUT(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("cost-center", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = BodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    switch (await largeAccounts(getDb()).setCostCenter(who.actor, id, parsed.data.costCenter)) {
      case "saved":
        return ok({ costCenter: parsed.data.costCenter });
      case "invoiced":
        return fail("déjà facturé");
      case "absent":
        return fail("introuvable");
    }
  } catch (error) {
    logError("cost center failed", error);
    return fail("erreur serveur");
  }
}
