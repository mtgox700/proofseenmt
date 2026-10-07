import type { NextResponse } from "next/server";
import { z } from "zod";
import { contracts, getDb, payments } from "@proofseen/db";
import { gatewayFromEnv } from "@proofseen/payments";
import { proofseenIdentity } from "@/data/payments-config";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * One contract: read by its parties (GET); signed by either side, cancelled before both signed, or completed by the
 * company (POST). Completing releases the escrowed funds when everything needed is configured; otherwise the funds stay
 * held — nothing is lost — and the answer says why.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const ActionSchema = z.object({ action: z.enum(["sign", "complete", "cancel"]) });
const RULE = { windowMs: 60_000, max: 30 };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const contract = await contracts(getDb()).find(who.actor, id);
    return contract === null ? fail("introuvable") : ok(contract);
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("contract-move", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = ActionSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  const db = getDb();
  try {
    const repo = contracts(db);
    if (parsed.data.action === "sign") {
      const signed = await repo.sign(who.actor, id, new Date());
      switch (signed.kind) {
        case "signed":
          return ok(signed.contract);
        case "registry_ceased":
          return fail("entreprise fermée");
        case "vigilance_required":
          return fail("attestation de vigilance requise");
        case "absent":
          return fail("introuvable");
      }
    }
    if (parsed.data.action === "cancel") {
      const cancelled = await repo.cancel(who.actor, id);
      return cancelled === null ? fail("introuvable") : ok(cancelled);
    }
    const completed = await repo.complete(who.actor, id);
    if (completed.kind === "not_paid") return fail("pas encore payé");
    if (completed.kind === "absent") return fail("introuvable");
    // The release is attempted now and retried by the periodic job if it cannot go through yet. The company is told
    // only that the work is approved: whether the freelancer's payout account is ready is not its business.
    const gateway = gatewayFromEnv(process.env);
    const identity = proofseenIdentity();
    if (gateway !== null && identity !== null) {
      await payments(db)
        .release(id, gateway, identity, new Date())
        .catch((error: unknown) => logError("release deferred", error));
    }
    return ok({ contract: completed.contract });
  } catch (error) {
    logError("contract action failed", error);
    return fail("erreur serveur");
  }
}
